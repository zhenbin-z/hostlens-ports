import { execFile } from "node:child_process";
import { access, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import type { PortListener } from "../../shared/ports.ts";
import type {
  ServiceDefinition,
  ServiceEvidence,
  ServiceKind,
  ServiceOwnership,
  ServiceScanner,
  ServiceScope,
  ServiceSnapshot,
} from "../../shared/services.ts";
import {
  parsePsCommands,
  parsePsProcessTable,
} from "../scanners/macos-parser.ts";
import {
  deriveStartupBehavior,
  normalizeHomebrewStatus,
  normalizeLaunchdStatus,
  parseHomebrewServicesJson,
  parseLaunchctlDisabled,
  parseLaunchctlPrint,
  parseLaunchctlServiceList,
  parseLaunchdPlistJson,
  unreadableConfiguredPlist,
  type ConfiguredPlist,
  type HomebrewServiceRecord,
  type LaunchctlServiceJob,
} from "./macos-service-parser.ts";
import {
  relateServicesToListeners,
  type ServiceProcessCandidate,
} from "./service-relations.ts";

const execFileAsync = promisify(execFile);
const LAUNCHCTL_PATH = "/bin/launchctl";
const PLUTIL_PATH = "/usr/bin/plutil";
const PS_PATH = "/bin/ps";
const BREW_PATHS = ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"];
const MAX_BUFFER_BYTES = 8 * 1024 * 1024;
const DEFINITIONS_CACHE_MS = 60_000;

interface PlistLocation {
  path: string;
  kind: ServiceKind;
  scope: ServiceScope;
}

interface DefinitionCache {
  expiresAt: number;
  plists: ConfiguredPlist[];
  warnings: string[];
}

export function friendlyServiceName(
  label: string,
  program?: string,
  homebrewName?: string,
): string {
  if (homebrewName) return homebrewName;
  const appMatch = program?.match(/\/([^/]+)\.app(?:\/|$)/);
  if (appMatch?.[1]) return appMatch[1];
  if (program) {
    const executable = basename(program);
    if (executable && !["sh", "bash", "zsh", "env"].includes(executable)) {
      return executable;
    }
  }

  const simplified = label
    .replace(/^homebrew\.mxcl\./, "")
    .replace(/^application\./, "")
    .replace(/(?:\.\d+){1,3}(?:\.[A-F0-9-]{8,})?$/i, "")
    .replace(/^[A-Z0-9]{10}\./, "")
    .replace(/^com\.apple\./, "")
    .replace(/^com\.[^.]+\./, "");
  return simplified
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || label;
}

export function ownershipFor(
  label: string,
  program?: string,
): ServiceOwnership {
  if (
    label.startsWith("com.apple.") ||
    label.startsWith("application.com.apple.") ||
    program?.startsWith("/System/")
  ) {
    return "apple";
  }
  if (
    label.startsWith("org.apple.")
  ) {
    return "apple";
  }
  if (label.startsWith("application.")) return "application";
  return label ? "third-party" : "unknown";
}

function serviceEvidence(
  collectedAt: string,
  source: string,
  detail: string,
  fields: ServiceEvidence["fields"],
  kind: ServiceEvidence["kind"] = "observed",
  confidence: ServiceEvidence["confidence"] = "high",
): ServiceEvidence {
  return { collectedAt, source, detail, fields, kind, confidence };
}

function emptyService(
  label: string,
  collectedAt: string,
): ServiceDefinition {
  return {
    id: `service:${label}`,
    label,
    displayName: friendlyServiceName(label),
    manager: "launchd",
    kind: "user-agent",
    scope: "user",
    ownership: ownershipFor(label),
    status: "unknown",
    startup: "unknown",
    arguments: [],
    relatedProcessIds: [],
    relatedProcesses: [],
    relatedListenerIds: [],
    observationStatus: "partial",
    unavailableFields: ["program", "plistPath", "startup"],
    confidence: "medium",
    evidence: [
      serviceEvidence(
        collectedAt,
        "launchctl list",
        `Observed loaded job ${label}`,
        ["label", "manager", "status"],
      ),
    ],
  };
}

function plistLocations(): PlistLocation[] {
  return [
    {
      path: join(homedir(), "Library/LaunchAgents"),
      kind: "user-agent",
      scope: "user",
    },
    {
      path: "/Library/LaunchAgents",
      kind: "system-agent",
      scope: "system",
    },
    {
      path: "/Library/LaunchDaemons",
      kind: "system-daemon",
      scope: "system",
    },
  ];
}

export function mergeHomebrewServiceObservations(
  services: Map<string, ServiceDefinition>,
  homebrew: HomebrewServiceRecord[],
  collectedAt: string,
): void {
  for (const brew of homebrew) {
    const label = brew.file
      ? basename(brew.file, ".plist")
      : `homebrew.mxcl.${brew.name}`;
    const service = services.get(label) ?? emptyService(label, collectedAt);
    service.manager = "homebrew";
    service.homebrewName = brew.name;
    service.displayName = friendlyServiceName(
      label,
      service.program,
      brew.name,
    );
    service.status =
      service.status === "running"
        ? "running"
        : normalizeHomebrewStatus(brew);
    service.startup = deriveStartupBehavior({
      disabled: service.status === "disabled",
      runAtLoad: service.runAtLoad,
      keepAlive: service.keepAlive,
      homebrewFile: brew.file,
    });
    service.lastExitStatus ??= brew.exitCode;
    service.plistPath ??= brew.file;
    service.observationStatus = "complete";
    service.unavailableFields = [];
    service.confidence = "high";
    service.evidence.push(
      serviceEvidence(
        collectedAt,
        "brew services list --json",
        `${brew.name} reported ${brew.status}`,
        [
          "manager",
          "status",
          "startup",
          "homebrewName",
          ...(brew.file ? ["plistPath" as const] : []),
        ],
      ),
    );
    services.set(label, service);
  }
}

export class MacOsServiceScanner implements ServiceScanner {
  private definitionCache: DefinitionCache | undefined;

  private async inspectPlist(
    path: string,
    kind: ServiceKind,
    scope: ServiceScope,
  ): Promise<ConfiguredPlist> {
    try {
      const { stdout } = await execFileAsync(
        PLUTIL_PATH,
        ["-convert", "json", "-o", "-", path],
        {
          encoding: "utf8",
          maxBuffer: MAX_BUFFER_BYTES,
          timeout: 2_000,
        },
      );
      const record = parseLaunchdPlistJson(stdout, path);
      if (record) return { path, kind, scope, record };
    } catch {
      // Preserve a configured item even when its contents cannot be read.
    }

    return unreadableConfiguredPlist(path, kind, scope);
  }

  private async inspectConfiguredPlists(): Promise<DefinitionCache> {
    const now = Date.now();
    if (this.definitionCache && this.definitionCache.expiresAt > now) {
      return this.definitionCache;
    }

    const warnings: string[] = [];
    const candidates: Array<{
      path: string;
      kind: ServiceKind;
      scope: ServiceScope;
    }> = [];
    for (const location of plistLocations()) {
      try {
        const entries = await readdir(location.path, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && entry.name.endsWith(".plist")) {
            candidates.push({
              path: join(location.path, entry.name),
              kind: location.kind,
              scope: location.scope,
            });
          }
        }
      } catch {
        warnings.push(`Could not inspect ${location.path}.`);
      }
    }

    const plists = await Promise.all(
      candidates.map(({ path, kind, scope }) =>
        this.inspectPlist(path, kind, scope),
      ),
    );
    const parseErrorCount = plists.filter(({ parseError }) => parseError).length;
    if (parseErrorCount > 0) {
      warnings.push(
        `${parseErrorCount} configured launchd item(s) could not be parsed completely.`,
      );
    }

    this.definitionCache = {
      expiresAt: now + DEFINITIONS_CACHE_MS,
      plists,
      warnings,
    };
    return this.definitionCache;
  }

  private async inspectLaunchctlJobs(): Promise<LaunchctlServiceJob[]> {
    try {
      const { stdout } = await execFileAsync(LAUNCHCTL_PATH, ["list"], {
        encoding: "utf8",
        maxBuffer: MAX_BUFFER_BYTES,
        timeout: 3_000,
      });
      return parseLaunchctlServiceList(stdout);
    } catch {
      return [];
    }
  }

  private async inspectDisabled(domain: string): Promise<Map<string, boolean>> {
    try {
      const { stdout } = await execFileAsync(
        LAUNCHCTL_PATH,
        ["print-disabled", domain],
        {
          encoding: "utf8",
          maxBuffer: MAX_BUFFER_BYTES,
          timeout: 2_000,
        },
      );
      return parseLaunchctlDisabled(stdout);
    } catch {
      return new Map();
    }
  }

  private async inspectSystemJobs(
    definitions: ConfiguredPlist[],
  ): Promise<LaunchctlServiceJob[]> {
    const systemLabels = definitions
      .filter(({ kind }) => kind === "system-daemon")
      .map(({ record }) => record.label);
    const observations = await Promise.all(
      systemLabels.map(async (label): Promise<LaunchctlServiceJob | null> => {
        try {
          const { stdout } = await execFileAsync(
            LAUNCHCTL_PATH,
            ["print", `system/${label}`],
            {
              encoding: "utf8",
              maxBuffer: MAX_BUFFER_BYTES,
              timeout: 2_000,
            },
          );
          return parseLaunchctlPrint(stdout, label);
        } catch {
          return null;
        }
      }),
    );

    return observations.filter(
      (job): job is LaunchctlServiceJob => job !== null,
    );
  }

  private async inspectHomebrew(): Promise<HomebrewServiceRecord[]> {
    for (const path of BREW_PATHS) {
      try {
        await access(path);
        const { stdout } = await execFileAsync(
          path,
          ["services", "list", "--json"],
          {
            encoding: "utf8",
            maxBuffer: MAX_BUFFER_BYTES,
            timeout: 5_000,
          },
        );
        return parseHomebrewServicesJson(stdout);
      } catch {
        // Try the next known Homebrew path.
      }
    }
    return [];
  }

  private async inspectProcesses(): Promise<ServiceProcessCandidate[]> {
    try {
      const [{ stdout: processOutput }, { stdout: commandOutput }] =
        await Promise.all([
          execFileAsync(PS_PATH, ["-axo", "pid=,ppid=,user=,comm="], {
            encoding: "utf8",
            maxBuffer: MAX_BUFFER_BYTES,
            timeout: 3_000,
          }),
          execFileAsync(PS_PATH, ["-axo", "pid=,command="], {
            encoding: "utf8",
            maxBuffer: MAX_BUFFER_BYTES,
            timeout: 3_000,
          }),
        ]);
      const commands = parsePsCommands(commandOutput);
      return parsePsProcessTable(processOutput).map((process) => ({
        pid: process.pid,
        parentPid: process.parentPid > 0 ? process.parentPid : undefined,
        processName: basename(process.executable),
        command: commands.get(process.pid),
      }));
    } catch {
      return [];
    }
  }

  public async scan(listeners: PortListener[]): Promise<ServiceSnapshot> {
    const collectedAt = new Date().toISOString();
    const uid = process.getuid?.() ?? 0;
    const definitions = await this.inspectConfiguredPlists();
    const [
      userLaunchctlJobs,
      systemLaunchctlJobs,
      userDisabled,
      systemDisabled,
      homebrew,
      processes,
    ] = await Promise.all([
      this.inspectLaunchctlJobs(),
      this.inspectSystemJobs(definitions.plists),
      this.inspectDisabled(`gui/${uid}`),
      this.inspectDisabled("system"),
      this.inspectHomebrew(),
      this.inspectProcesses(),
    ]);
    const launchctlJobs = [...userLaunchctlJobs, ...systemLaunchctlJobs];
    const systemJobLabels = new Set(
      systemLaunchctlJobs.map(({ label }) => label),
    );

    const jobs = new Map(launchctlJobs.map((job) => [job.label, job]));
    const services = new Map<string, ServiceDefinition>();

    for (const job of launchctlJobs) {
      const service = emptyService(job.label, collectedAt);
      const disabled = userDisabled.get(job.label) ?? false;
      service.pid = job.pid;
      service.lastExitStatus = job.lastExitStatus;
      service.status = normalizeLaunchdStatus(job, disabled, false);
      service.startup = disabled ? "disabled" : "unknown";
      service.unavailableFields = disabled
        ? ["program", "plistPath"]
        : ["program", "plistPath", "startup"];
      service.evidence[0] = serviceEvidence(
        collectedAt,
        systemJobLabels.has(job.label)
          ? `launchctl print system/${job.label}`
          : "launchctl list",
        job.pid === undefined
          ? `${job.label} is loaded without a running PID`
          : `${job.label} is running as PID ${job.pid}`,
        ["label", "manager", "status", "lastExitStatus", ...(job.pid ? ["pid" as const] : [])],
      );
      services.set(job.label, service);
    }

    for (const configured of definitions.plists) {
      const { record } = configured;
      const service =
        services.get(record.label) ?? emptyService(record.label, collectedAt);
      const disabled =
        record.disabled ??
        (configured.kind === "system-daemon"
          ? systemDisabled.get(record.label)
          : userDisabled.get(record.label)) ??
        false;
      const job = jobs.get(record.label);
      service.kind = configured.kind;
      service.scope = configured.scope;
      service.plistPath = configured.path;
      service.ownership = ownershipFor(record.label, record.program);
      service.displayName = friendlyServiceName(record.label, record.program);

      if (configured.parseError) {
        service.status = disabled
          ? "disabled"
          : job
            ? normalizeLaunchdStatus(job, false, true)
            : "unknown";
        service.startup = disabled ? "disabled" : "unknown";
        service.observationStatus = "partial";
        service.unavailableFields = [
          "program",
          "arguments",
          ...(disabled ? [] : ["startup" as const]),
        ];
        service.confidence = "medium";
        service.evidence.push(
          serviceEvidence(
            collectedAt,
            configured.path,
            "Configured launchd item was discovered, but its plist could not be parsed",
            ["label", "kind", "scope", "plistPath"],
            "observed",
            "medium",
          ),
        );
        services.set(record.label, service);
        continue;
      }

      service.program = record.program;
      service.arguments = record.arguments;
      service.runAtLoad = record.runAtLoad;
      service.keepAlive = record.keepAlive;
      service.status = normalizeLaunchdStatus(job, disabled, true);
      service.startup = deriveStartupBehavior({
        disabled,
        runAtLoad: record.runAtLoad,
        keepAlive: record.keepAlive,
      });
      service.observationStatus = record.program ? "complete" : "partial";
      service.unavailableFields = record.program ? [] : ["program"];
      service.confidence = "high";
      service.evidence.push(
        serviceEvidence(
          collectedAt,
          configured.path,
          `Parsed configured ${configured.kind} plist`,
          [
            "label",
            "kind",
            "scope",
            "program",
            "arguments",
            "plistPath",
            "startup",
          ],
        ),
      );
      if (disabled) {
        service.evidence.push(
          serviceEvidence(
            collectedAt,
            configured.kind === "system-daemon"
              ? "launchctl print-disabled system"
              : `launchctl print-disabled gui/${uid}`,
            `${record.label} is disabled`,
            ["status", "startup"],
          ),
        );
      }
      services.set(record.label, service);
    }

    mergeHomebrewServiceObservations(services, homebrew, collectedAt);

    const related = relateServicesToListeners(
      [...services.values()],
      listeners,
      processes,
    ).sort((left, right) => {
      if (left.ownership !== right.ownership) {
        return left.ownership === "third-party" ? -1 : 1;
      }
      return left.displayName.localeCompare(right.displayName);
    });

    return {
      scannedAt: collectedAt,
      platform: "darwin",
      services: related,
      warnings: definitions.warnings,
    };
  }
}
