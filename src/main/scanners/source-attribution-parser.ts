import type {
  DockerPortBinding,
  LaunchdJob,
} from "./process-identity.ts";

export function parseLaunchctlList(output: string): LaunchdJob[] {
  const jobs: LaunchdJob[] = [];

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+|-)\s+-?\d+\s+(.+?)\s*$/);
    if (!match?.[2] || match[2] === "Label") continue;
    const parsedPid =
      match[1] === "-" ? undefined : Number.parseInt(match[1] ?? "", 10);
    jobs.push({
      pid: Number.isInteger(parsedPid) ? parsedPid : undefined,
      label: match[2],
    });
  }

  return jobs;
}

interface DockerPsRecord {
  ID?: string;
  Image?: string;
  Names?: string;
  Ports?: string;
}

function parseDockerPort(
  value: string,
): Omit<DockerPortBinding, "containerId" | "containerName" | "image"> | null {
  const mapping = value.trim().match(
    /^(.*):(\d+)->(\d+)\/(tcp|udp)$/i,
  );
  if (!mapping) return null;

  const hostPort = Number.parseInt(mapping[2] ?? "", 10);
  const containerPort = Number.parseInt(mapping[3] ?? "", 10);
  if (!Number.isInteger(hostPort) || !Number.isInteger(containerPort)) {
    return null;
  }

  return {
    hostAddress: (mapping[1] ?? "").replace(/^\[(.*)]$/, "$1") || "*",
    hostPort,
    containerPort,
    protocol: (mapping[4] ?? "tcp").toLowerCase() as "tcp" | "udp",
  };
}

export function parseDockerPsJsonLines(output: string): DockerPortBinding[] {
  const bindings: DockerPortBinding[] = [];

  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) continue;

    let record: DockerPsRecord;
    try {
      record = JSON.parse(line) as DockerPsRecord;
    } catch {
      continue;
    }

    for (const portText of record.Ports?.split(",") ?? []) {
      const port = parseDockerPort(portText);
      if (!port) continue;
      bindings.push({
        containerId: record.ID ?? "unknown",
        containerName: record.Names ?? record.ID ?? "unknown",
        image: record.Image ?? "unknown",
        ...port,
      });
    }
  }

  return bindings.sort((left, right) => {
    if (left.hostPort !== right.hostPort) return left.hostPort - right.hostPort;
    return left.containerName.localeCompare(right.containerName);
  });
}
