import type {
  ObservationField,
  PortSnapshot,
} from "../../shared/ports";
import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { promisify } from "node:util";
import {
  buildParentChain,
  parseLsofListeners,
  parseLsofWorkingDirectories,
  parsePsCommands,
  parsePsProcessTable,
} from "./macos-parser.ts";
import type { PortScanner } from "./port-scanner";
import {
  resolveProcess,
  type AttributionContext,
} from "./process-identity.ts";
import {
  parseDockerPsJsonLines,
  parseLaunchctlList,
} from "./source-attribution-parser.ts";

const execFileAsync = promisify(execFile);
const LSOF_PATH = "/usr/sbin/lsof";
const PS_PATH = "/bin/ps";
const LAUNCHCTL_PATH = "/bin/launchctl";
const DOCKER_PATHS = [
  "/usr/local/bin/docker",
  "/opt/homebrew/bin/docker",
  "/Applications/Docker.app/Contents/Resources/bin/docker",
];
const MAX_BUFFER_BYTES = 4 * 1024 * 1024;
const ATTRIBUTION_CACHE_MS = 30_000;

export class MacOsPortScanner implements PortScanner {
  private attributionCache:
    | { expiresAt: number; context: AttributionContext }
    | undefined;

  private async inspectProcessTable(): Promise<
    ReturnType<typeof parsePsProcessTable>
  > {
    try {
      const { stdout } = await execFileAsync(
        PS_PATH,
        ["-axo", "pid=,ppid=,user=,comm="],
        {
          encoding: "utf8",
          maxBuffer: MAX_BUFFER_BYTES,
          timeout: 3_000,
        },
      );
      return parsePsProcessTable(stdout);
    } catch {
      return [];
    }
  }

  private async inspectCommands(): Promise<Map<number, string>> {
    try {
      const { stdout } = await execFileAsync(
        PS_PATH,
        ["-axo", "pid=,command="],
        {
          encoding: "utf8",
          maxBuffer: MAX_BUFFER_BYTES,
          timeout: 3_000,
        },
      );
      return parsePsCommands(stdout);
    } catch (cause) {
      const error = cause as { stdout?: string };
      return parsePsCommands(error.stdout ?? "");
    }
  }

  private async inspectLaunchdJobs(): Promise<
    AttributionContext["launchdJobs"]
  > {
    try {
      const { stdout } = await execFileAsync(LAUNCHCTL_PATH, ["list"], {
        encoding: "utf8",
        maxBuffer: MAX_BUFFER_BYTES,
        timeout: 2_000,
      });
      return parseLaunchctlList(stdout);
    } catch {
      return [];
    }
  }

  private async inspectDockerBindings(): Promise<
    AttributionContext["dockerBindings"]
  > {
    let dockerPath: string | undefined;
    for (const candidate of DOCKER_PATHS) {
      try {
        await access(candidate);
        dockerPath = candidate;
        break;
      } catch {
        // Keep checking known, absolute Docker CLI paths.
      }
    }
    if (!dockerPath) return [];

    try {
      const { stdout } = await execFileAsync(
        dockerPath,
        ["ps", "--format", "{{json .}}"],
        {
          encoding: "utf8",
          maxBuffer: MAX_BUFFER_BYTES,
          timeout: 1_500,
        },
      );
      return parseDockerPsJsonLines(stdout);
    } catch {
      return [];
    }
  }

  private async inspectAttributionContext(): Promise<AttributionContext> {
    const now = Date.now();
    if (this.attributionCache && this.attributionCache.expiresAt > now) {
      return this.attributionCache.context;
    }

    const [launchdJobs, dockerBindings] = await Promise.all([
      this.inspectLaunchdJobs(),
      this.inspectDockerBindings(),
    ]);
    const context = { launchdJobs, dockerBindings };
    this.attributionCache = {
      expiresAt: now + ATTRIBUTION_CACHE_MS,
      context,
    };
    return context;
  }

  private async inspectWorkingDirectories(
    processIds: number[],
  ): Promise<Map<number, string>> {
    if (processIds.length === 0) return new Map();

    try {
      const { stdout } = await execFileAsync(
        LSOF_PATH,
        [
          "-a",
          "-p",
          processIds.join(","),
          "-d",
          "cwd",
          "-Fpn",
        ],
        {
          encoding: "utf8",
          maxBuffer: MAX_BUFFER_BYTES,
          timeout: 4_000,
        },
      );
      return parseLsofWorkingDirectories(stdout);
    } catch (cause) {
      const error = cause as { stdout?: string };
      return parseLsofWorkingDirectories(error.stdout ?? "");
    }
  }

  public async scan(): Promise<PortSnapshot> {
    const warnings: string[] = [];
    const collectedAt = new Date().toISOString();
    let output = "";

    try {
      const result = await execFileAsync(
        LSOF_PATH,
        ["-nP", "-FpcunT", "-iTCP", "-sTCP:LISTEN"],
        {
          encoding: "utf8",
          maxBuffer: MAX_BUFFER_BYTES,
          timeout: 8_000,
        },
      );
      output = result.stdout;
    } catch (cause) {
      const error = cause as {
        code?: string | number;
        stdout?: string;
      };

      // lsof exits with 1 when its selection has no matches.
      if (error.code === 1) {
        output = error.stdout ?? "";
      } else {
        throw new Error(
          error.code === "ENOENT"
            ? "The macOS lsof utility is unavailable."
            : "HostLens could not inspect listening ports.",
          { cause },
        );
      }
    }

    const listeners = parseLsofListeners(output);
    const processIds = [
      ...new Set(
        listeners
          .map((listener) => listener.pid)
          .filter((pid): pid is number => pid !== undefined),
      ),
    ];
    const [processTableEntries, commandsByPid, directoriesByPid, attribution] =
      await Promise.all([
        this.inspectProcessTable(),
        this.inspectCommands(),
        this.inspectWorkingDirectories(processIds),
        this.inspectAttributionContext(),
      ]);
    const processTable = new Map(
      processTableEntries.map((entry) => [entry.pid, entry] as const),
    );

    for (const listener of listeners) {
      listener.evidence.push({
        source: "macOS lsof listening sockets",
        collectedAt,
        confidence: "high",
        fields: ["socket", "pid", "processName"],
      });

      if (listener.pid !== undefined) {
        const processDetails = processTable.get(listener.pid);
        const command = commandsByPid.get(listener.pid);
        const workingDirectory = directoriesByPid.get(listener.pid);

        if (processDetails) {
          listener.parentPid =
            processDetails.parentPid > 0 ? processDetails.parentPid : undefined;
          listener.user = processDetails.user || listener.user;
          listener.executable = processDetails.executable || undefined;
          listener.parentChain = buildParentChain(
            listener.pid,
            processTable,
            commandsByPid,
          );
          listener.evidence.push({
            source: "macOS ps process table",
            collectedAt,
            confidence: "high",
            fields: [
              "parentPid",
              "user",
              "executable",
              ...(listener.parentChain.length > 0
                ? (["parentChain"] satisfies ObservationField[])
                : []),
            ],
          });
        }

        if (command) {
          listener.command = command;
          listener.evidence.push({
            source: "macOS ps command",
            collectedAt,
            confidence: "high",
            fields: ["command"],
          });
        }

        if (workingDirectory) {
          listener.workingDirectory = workingDirectory;
          listener.evidence.push({
            source: "macOS lsof process cwd",
            collectedAt,
            confidence: "high",
            fields: ["workingDirectory"],
          });
        }
      }

      const requiredDetails: Array<
        [ObservationField, string | number | undefined]
      > = [
        ["parentPid", listener.parentPid],
        ["user", listener.user],
        ["command", listener.command],
        ["executable", listener.executable],
        ["workingDirectory", listener.workingDirectory],
        [
          "parentChain",
          listener.parentChain.length > 0 ? listener.parentChain.length : undefined,
        ],
      ];
      listener.unavailableFields = requiredDetails
        .filter(([, value]) => value === undefined || value === "")
        .map(([field]) => field);
      listener.observationStatus =
        listener.unavailableFields.length === 0 ? "complete" : "partial";

      const resolved = resolveProcess(listener, attribution);
      listener.identity = resolved.identity;
      listener.launchSource = resolved.launchSource;
    }

    if (listeners.some((listener) => listener.observationStatus === "partial")) {
      warnings.push(
        "Some process details are unavailable because the process exited or macOS restricted access.",
      );
    }

    return {
      scannedAt: collectedAt,
      platform: "darwin",
      listeners,
      warnings,
    };
  }
}
