import type {
  GlobalPackage,
  RuntimeInstallation,
  RuntimeSnapshot,
} from "./runtimes";

export interface RuntimeSummaryLabels {
  title: string;
  packageName: string;
  version: string;
  manager: string;
  runtime: string;
  managerExecutable: string;
  environment: string;
  installPath: string;
  executables: string;
  observation: string;
  collectedAt: string;
  evidence: string;
  unknown: string;
  disclaimer: string;
}

const englishLabels: RuntimeSummaryLabels = {
  title: "HostLens Ports · Runtime package observation",
  packageName: "Package",
  version: "Version",
  manager: "Package manager",
  runtime: "Runtime",
  managerExecutable: "Package manager executable",
  environment: "Environment",
  installPath: "Install path",
  executables: "Provided executables",
  observation: "Observation",
  collectedAt: "Collected at",
  evidence: "Evidence",
  unknown: "Unknown",
  disclaimer:
    "Point-in-time local inventory only. This is not a vulnerability or security verdict.",
};

function sanitizeRuntimeText(value: string): string {
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
    .replace(/\b(Authorization:\s*Bearer\s+)[^\s]+/gi, "$1<redacted>")
    .replace(
      /([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/gi,
      "$1<redacted>@",
    );
}

function projected(value: string | undefined, sanitized: boolean): string {
  if (!value) return "";
  return sanitized ? sanitizeRuntimeText(value) : value;
}

export function createRuntimePackageSummary(
  pkg: GlobalPackage,
  runtime: RuntimeInstallation | undefined,
  snapshot: RuntimeSnapshot,
  options: {
    sanitized?: boolean;
    labels?: RuntimeSummaryLabels;
  } = {},
): string {
  const sanitized = options.sanitized ?? false;
  const labels = options.labels ?? englishLabels;
  const runtimeDescription = runtime
    ? `${runtime.kind} ${runtime.version} · ${projected(runtime.executable, sanitized)}`
    : labels.unknown;
  const lines = [
    labels.title,
    "",
    `${labels.packageName}: ${pkg.name}`,
    `${labels.version}: ${pkg.version}`,
    `${labels.manager}: ${pkg.manager}`,
    `${labels.runtime}: ${runtimeDescription}`,
    `${labels.managerExecutable}: ${projected(pkg.managerExecutable, sanitized)}`,
    `${labels.environment}: ${projected(pkg.environmentPath ?? runtime?.environmentPath, sanitized) || labels.unknown}`,
    `${labels.installPath}: ${projected(pkg.installPath, sanitized) || labels.unknown}`,
    `${labels.executables}: ${pkg.executables.join(", ") || labels.unknown}`,
    `${labels.observation}: ${pkg.observationStatus}`,
    `${labels.collectedAt}: ${snapshot.scannedAt}`,
    "",
    `${labels.evidence}:`,
  ];

  for (const item of pkg.evidence) {
    lines.push(
      `- [${item.kind}/${item.confidence}] ${item.source}: ${projected(item.detail, sanitized)}`,
    );
  }
  lines.push("", labels.disclaimer);
  return lines.join("\n");
}
