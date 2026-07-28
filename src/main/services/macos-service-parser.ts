import { basename } from "node:path";
import type {
  ServiceKind,
  ServiceScope,
  ServiceStatus,
  StartupBehavior,
} from "../../shared/services.ts";

export interface LaunchctlServiceJob {
  label: string;
  pid?: number;
  lastExitStatus?: number;
}

export interface LaunchdPlistRecord {
  label: string;
  program?: string;
  arguments: string[];
  runAtLoad?: boolean;
  keepAlive?: boolean;
  disabled?: boolean;
}

export interface ConfiguredPlist {
  path: string;
  kind: ServiceKind;
  scope: ServiceScope;
  record: LaunchdPlistRecord;
  parseError?: boolean;
}

export interface HomebrewServiceRecord {
  name: string;
  status: string;
  user?: string;
  file?: string;
  exitCode?: number;
}

export function unreadableConfiguredPlist(
  path: string,
  kind: ServiceKind,
  scope: ServiceScope,
): ConfiguredPlist {
  return {
    path,
    kind,
    scope,
    parseError: true,
    record: {
      label: basename(path, ".plist"),
      arguments: [],
    },
  };
}

function optionalInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  return undefined;
}

export function parseLaunchctlServiceList(
  output: string,
): LaunchctlServiceJob[] {
  const jobs: LaunchctlServiceJob[] = [];

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+|-)\s+(-?\d+)\s+(.+?)\s*$/);
    if (!match?.[3] || match[3] === "Label") continue;
    const pid =
      match[1] === "-" ? undefined : Number.parseInt(match[1] ?? "", 10);
    const lastExitStatus = Number.parseInt(match[2] ?? "", 10);
    jobs.push({
      label: match[3],
      pid: Number.isInteger(pid) ? pid : undefined,
      lastExitStatus: Number.isInteger(lastExitStatus)
        ? lastExitStatus
        : undefined,
    });
  }

  return jobs.sort((left, right) => left.label.localeCompare(right.label));
}

export function parseLaunchctlDisabled(output: string): Map<string, boolean> {
  const disabled = new Map<string, boolean>();
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*"([^"]+)"\s*=>\s*(true|false)\s*$/);
    if (match?.[1] && match[2]) {
      disabled.set(match[1], match[2] === "true");
    }
  }
  return disabled;
}

export function parseLaunchctlPrint(
  output: string,
  label: string,
): LaunchctlServiceJob {
  const pid = optionalInteger(output.match(/^\s*pid\s*=\s*(-?\d+)\s*$/m)?.[1]);
  const lastExitStatus = optionalInteger(
    output.match(/^\s*last exit code\s*=\s*(-?\d+)\s*$/m)?.[1],
  );

  return { label, pid, lastExitStatus };
}

export function parseLaunchdPlistJson(
  output: string,
  fallbackPath: string,
): LaunchdPlistRecord | null {
  let value: unknown;
  try {
    value = JSON.parse(output);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const label =
    typeof record.Label === "string" && record.Label.trim()
      ? record.Label.trim()
      : basename(fallbackPath, ".plist");
  const rawArguments = Array.isArray(record.ProgramArguments)
    ? record.ProgramArguments.filter(
        (argument): argument is string => typeof argument === "string",
      )
    : [];
  const program =
    typeof record.Program === "string"
      ? record.Program
      : rawArguments[0];
  const keepAlive =
    typeof record.KeepAlive === "boolean"
      ? record.KeepAlive
      : record.KeepAlive && typeof record.KeepAlive === "object"
        ? true
        : undefined;

  return {
    label,
    program,
    arguments: rawArguments,
    runAtLoad:
      typeof record.RunAtLoad === "boolean" ? record.RunAtLoad : undefined,
    keepAlive,
    disabled:
      typeof record.Disabled === "boolean" ? record.Disabled : undefined,
  };
}

export function parseHomebrewServicesJson(
  output: string,
): HomebrewServiceRecord[] {
  let value: unknown;
  try {
    value = JSON.parse(output);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];

  return value
    .flatMap((entry): HomebrewServiceRecord[] => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const record = entry as Record<string, unknown>;
      const name =
        typeof record.name === "string"
          ? record.name
          : typeof record.Name === "string"
            ? record.Name
            : undefined;
      if (!name) return [];
      const statusValue = record.status ?? record.Status;
      return [{
        name,
        status:
          typeof statusValue === "string" ? statusValue.toLowerCase() : "unknown",
        user:
          typeof record.user === "string"
            ? record.user
            : typeof record.User === "string"
              ? record.User
              : undefined,
        file:
          typeof record.file === "string"
            ? record.file
            : typeof record.File === "string"
              ? record.File
              : undefined,
        exitCode: optionalInteger(
          record.exit_code ?? record.exitCode ?? record["Exit Code"],
        ),
      }];
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function normalizeLaunchdStatus(
  job: LaunchctlServiceJob | undefined,
  disabled: boolean,
  configured: boolean,
): ServiceStatus {
  if (disabled) return "disabled";
  if (job?.pid !== undefined) return "running";
  if (job && (job.lastExitStatus ?? 0) > 0) return "failed";
  if (job) return "loaded";
  if (configured) return "stopped";
  return "unknown";
}

export function normalizeHomebrewStatus(
  record: HomebrewServiceRecord,
): ServiceStatus {
  if (["started", "running"].includes(record.status)) return "running";
  if (["scheduled", "loaded"].includes(record.status)) return "loaded";
  if (["stopped", "none"].includes(record.status)) return "stopped";
  if (["error", "failed"].includes(record.status)) return "failed";
  return "unknown";
}

export function deriveStartupBehavior(input: {
  disabled: boolean;
  runAtLoad?: boolean;
  keepAlive?: boolean;
  homebrewFile?: string;
}): StartupBehavior {
  if (input.disabled) return "disabled";
  if (input.runAtLoad || input.keepAlive || input.homebrewFile) {
    return "automatic";
  }
  if (input.runAtLoad === false || input.keepAlive === false) {
    return "on-demand";
  }
  return "unknown";
}
