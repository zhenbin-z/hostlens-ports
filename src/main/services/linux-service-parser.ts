import { basename } from "node:path";
import type {
  ServiceDefinition,
  ServiceStatus,
  StartupBehavior,
} from "../../shared/services.ts";

type UnitProperties = Record<string, string>;

function statusFor(properties: UnitProperties): ServiceStatus {
  if (properties.ActiveState === "failed") return "failed";
  if (properties.ActiveState === "active") return "running";
  if (
    properties.ActiveState === "activating" ||
    properties.ActiveState === "reloading"
  ) {
    return "loaded";
  }
  if (
    properties.UnitFileState === "masked" ||
    properties.UnitFileState === "disabled"
  ) {
    return "disabled";
  }
  if (properties.ActiveState === "inactive") return "stopped";
  return "unknown";
}

function startupFor(value: string | undefined): StartupBehavior {
  if (!value) return "unknown";
  if (value.startsWith("enabled")) return "automatic";
  if (value === "disabled" || value === "masked") return "disabled";
  if (
    value === "static" ||
    value === "indirect" ||
    value === "generated" ||
    value === "transient"
  ) {
    return "on-demand";
  }
  return "unknown";
}

function execStart(properties: UnitProperties): {
  program?: string;
  arguments: string[];
} {
  const value = properties.ExecStart ?? "";
  const path = value.match(/\bpath=([^ ;}]+)/)?.[1];
  const argv = value.match(/\bargv\[\]=([^ ;}](?:.*?))\s*;/)?.[1];
  return {
    program: path,
    arguments: argv ? argv.trim().split(/\s+/) : [],
  };
}

export function parseSystemdUnits(
  output: string,
  collectedAt: string,
): ServiceDefinition[] {
  const blocks = output
    .split(/\r?\n\r?\n+/)
    .map((block) => block.trim())
    .filter(Boolean);
  const services: ServiceDefinition[] = [];

  for (const block of blocks) {
    const properties: UnitProperties = {};
    for (const line of block.split(/\r?\n/)) {
      const separator = line.indexOf("=");
      if (separator <= 0) continue;
      properties[line.slice(0, separator)] = line.slice(separator + 1);
    }
    const label = properties.Id;
    if (!label?.endsWith(".service")) continue;
    const pid = Number.parseInt(properties.MainPID ?? "0", 10);
    const command = execStart(properties);
    const status = statusFor(properties);
    const startup = startupFor(properties.UnitFileState);
    const fragmentPath = properties.FragmentPath || undefined;
    const program = command.program;

    services.push({
      id: `service:${label}`,
      label,
      displayName:
        properties.Description?.trim() ||
        basename(label, ".service").replace(/[-_]+/g, " "),
      manager: "systemd",
      kind: "system-daemon",
      scope: "system",
      ownership: "third-party",
      status,
      startup,
      pid: pid > 0 ? pid : undefined,
      program,
      arguments: command.arguments,
      plistPath: fragmentPath,
      relatedProcessIds: [],
      relatedProcesses: [],
      relatedListenerIds: [],
      observationStatus: fragmentPath ? "complete" : "partial",
      unavailableFields: [
        ...(!program ? (["program"] as const) : []),
        ...(!fragmentPath ? (["plistPath"] as const) : []),
      ],
      confidence: "high",
      evidence: [
        {
          kind: "observed",
          source: "systemctl show",
          detail: `${label}: ${properties.LoadState || "unknown"}/${properties.ActiveState || "unknown"}/${properties.SubState || "unknown"}`,
          collectedAt,
          confidence: "high",
          fields: [
            "label",
            "manager",
            "status",
            "startup",
            ...(pid > 0 ? (["pid"] as const) : []),
            ...(program ? (["program", "arguments"] as const) : []),
            ...(fragmentPath ? (["plistPath"] as const) : []),
          ],
        },
      ],
    });
  }

  return services.sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  );
}
