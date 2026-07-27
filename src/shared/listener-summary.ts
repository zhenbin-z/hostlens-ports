import type { PortListener, PortSnapshot } from "./ports";

export interface SummaryLabels {
  title: string;
  process: string;
  socket: string;
  exposure: string;
  source: string;
  automaticStart: string;
  confidence: string;
  collectedAt: string;
  project: string;
  workingDirectory: string;
  executable: string;
  command: string;
  evidence: string;
  unknown: string;
  yes: string;
  no: string;
  disclaimer: string;
}

const englishLabels: SummaryLabels = {
  title: "HostLens Ports · Current-state observation",
  process: "Process",
  socket: "Listening socket",
  exposure: "Binding scope",
  source: "Launch source",
  automaticStart: "Starts automatically",
  confidence: "Identity confidence",
  collectedAt: "Collected at",
  project: "Project",
  workingDirectory: "Working directory",
  executable: "Executable",
  command: "Command",
  evidence: "Evidence",
  unknown: "Unknown",
  yes: "Yes",
  no: "No",
  disclaimer:
    "Point-in-time observation only. This is not a security certification.",
};

export function sanitizeHostText(value: string): string {
  return value
    .replace(/\/Users\/[^/\s"']+/g, "~")
    .replace(/\/home\/[^/\s"']+/g, "~")
    .replace(
      /(--(?:password|passwd|token|api[-_]?key|secret|client[-_]?secret|access[-_]?token)(?:=|\s+))("[^"]*"|'[^']*'|[^\s]+)/gi,
      "$1<redacted>",
    )
    .replace(
      /\b((?:PASSWORD|PASSWD|TOKEN|API_KEY|APIKEY|SECRET|CLIENT_SECRET|ACCESS_TOKEN|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY)=)("[^"]*"|'[^']*'|[^\s]+)/g,
      "$1<redacted>",
    )
    .replace(
      /\b(Authorization:\s*Bearer\s+)[^\s]+/gi,
      "$1<redacted>",
    )
    .replace(
      /([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/gi,
      "$1<redacted>@",
    );
}

function maybeSanitize(
  value: string | undefined,
  sanitized: boolean,
): string | undefined {
  if (!value) return value;
  return sanitized ? sanitizeHostText(value) : value;
}

function automaticLabel(
  value: PortListener["launchSource"]["automatic"],
  labels: SummaryLabels,
): string {
  if (value === "yes") return labels.yes;
  if (value === "no") return labels.no;
  return labels.unknown;
}

export function createListenerSummary(
  listener: PortListener,
  snapshot: PortSnapshot,
  options: {
    sanitized?: boolean;
    labels?: SummaryLabels;
  } = {},
): string {
  const sanitized = options.sanitized ?? false;
  const labels = options.labels ?? englishLabels;
  const project = listener.identity.project;
  const evidence = [
    ...listener.identity.evidence,
    ...listener.launchSource.evidence,
  ];
  const lines = [
    labels.title,
    "",
    `${labels.process}: ${listener.identity.displayName} (${listener.processName})`,
    `${labels.socket}: ${listener.protocol.toUpperCase()} ${listener.address}:${listener.port}`,
    `${labels.exposure}: ${listener.exposure}`,
    `${labels.source}: ${listener.launchSource.label}`,
    `${labels.automaticStart}: ${automaticLabel(listener.launchSource.automatic, labels)}`,
    `${labels.confidence}: ${listener.identity.confidence}`,
    `${labels.collectedAt}: ${snapshot.scannedAt}`,
  ];

  if (project) {
    lines.push(
      `${labels.project}: ${project.name}${project.tool ? ` · ${project.tool}` : ""}`,
    );
  }
  if (listener.workingDirectory) {
    lines.push(
      `${labels.workingDirectory}: ${maybeSanitize(listener.workingDirectory, sanitized)}`,
    );
  }
  if (listener.executable) {
    lines.push(
      `${labels.executable}: ${maybeSanitize(listener.executable, sanitized)}`,
    );
  }
  if (listener.command) {
    lines.push(
      `${labels.command}: ${maybeSanitize(listener.command, sanitized)}`,
    );
  }

  lines.push("", `${labels.evidence}:`);
  for (const item of evidence) {
    lines.push(
      `- [${item.kind}/${item.confidence}] ${item.source}: ${maybeSanitize(item.detail, sanitized)}`,
    );
  }
  lines.push("", labels.disclaimer);
  return lines.join("\n");
}
