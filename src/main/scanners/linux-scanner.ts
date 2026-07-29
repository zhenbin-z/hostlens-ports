import { execFile } from "node:child_process";
import { access, readlink } from "node:fs/promises";
import { basename } from "node:path";
import { promisify } from "node:util";
import type {
  ObservationField,
  PortSnapshot,
} from "../../shared/ports.ts";
import {
  buildParentChain,
  parsePsCommands,
  parsePsProcessTable,
} from "./macos-parser.ts";
import { parseSsListeners } from "./linux-parser.ts";
import type { PortScanner } from "./port-scanner.ts";
import {
  resolveProcess,
  type AttributionContext,
} from "./process-identity.ts";
import { parseDockerPsJsonLines } from "./source-attribution-parser.ts";

const execFileAsync = promisify(execFile);
const MAX_BUFFER_BYTES = 8 * 1024 * 1024;
const SS_PATHS = ["/usr/bin/ss", "/bin/ss", "/usr/sbin/ss"];
const PS_PATHS = ["/usr/bin/ps", "/bin/ps"];
const DOCKER_PATHS = ["/usr/bin/docker", "/usr/local/bin/docker"];

async function firstExecutable(paths: string[]): Promise<string | undefined> {
  for (const path of paths) {
    try {
      await access(path);
      return path;
    } catch {
      // Keep checking explicit platform paths.
    }
  }
  return undefined;
}

async function dockerBindings(): Promise<
  AttributionContext["dockerBindings"]
> {
  const docker = await firstExecutable(DOCKER_PATHS);
  if (!docker) return [];
  try {
    const { stdout } = await execFileAsync(
      docker,
      ["ps", "--format", "{{json .}}"],
      {
        encoding: "utf8",
        maxBuffer: MAX_BUFFER_BYTES,
        timeout: 2_000,
      },
    );
    return parseDockerPsJsonLines(stdout);
  } catch {
    return [];
  }
}

export class LinuxPortScanner implements PortScanner {
  public async scan(): Promise<PortSnapshot> {
    const collectedAt = new Date().toISOString();
    const warnings: string[] = [];
    const ss = await firstExecutable(SS_PATHS);
    if (!ss) {
      throw new Error(
        "The Linux ss utility is unavailable. Install the iproute/iproute2 package.",
      );
    }

    let output = "";
    try {
      ({ stdout: output } = await execFileAsync(ss, ["-H", "-lntp"], {
        encoding: "utf8",
        maxBuffer: MAX_BUFFER_BYTES,
        timeout: 8_000,
      }));
    } catch (cause) {
      const partial = cause as { stdout?: string };
      output = partial.stdout ?? "";
      if (!output) {
        throw new Error("HostLens could not inspect Linux listening ports.", {
          cause,
        });
      }
      warnings.push("Linux ss returned partial listening-port results.");
    }

    const listeners = parseSsListeners(output);
    const ps = await firstExecutable(PS_PATHS);
    let processEntries: ReturnType<typeof parsePsProcessTable> = [];
    let commands = new Map<number, string>();
    if (ps) {
      try {
        const [table, commandTable] = await Promise.all([
          execFileAsync(ps, ["-axo", "pid=,ppid=,user=,comm="], {
            encoding: "utf8",
            maxBuffer: MAX_BUFFER_BYTES,
            timeout: 4_000,
          }),
          execFileAsync(ps, ["-axo", "pid=,command="], {
            encoding: "utf8",
            maxBuffer: MAX_BUFFER_BYTES,
            timeout: 4_000,
          }),
        ]);
        processEntries = parsePsProcessTable(table.stdout);
        commands = parsePsCommands(commandTable.stdout);
      } catch {
        warnings.push("Linux process table inspection was partial.");
      }
    }
    const processes = new Map(
      processEntries.map((entry) => [entry.pid, entry] as const),
    );
    const attribution: AttributionContext = {
      launchdJobs: [],
      dockerBindings: await dockerBindings(),
    };

    for (const listener of listeners) {
      listener.evidence.push({
        source: "Linux ss listening sockets",
        collectedAt,
        confidence: listener.pid ? "high" : "medium",
        fields: listener.pid
          ? ["socket", "pid", "processName"]
          : ["socket"],
      });
      if (listener.pid !== undefined) {
        const process = processes.get(listener.pid);
        if (process) {
          listener.parentPid =
            process.parentPid > 0 ? process.parentPid : undefined;
          listener.user = process.user || undefined;
          listener.executable = process.executable || undefined;
          listener.processName =
            listener.processName === "Unknown process"
              ? basename(process.executable)
              : listener.processName;
          listener.parentChain = buildParentChain(
            listener.pid,
            processes,
            commands,
          );
          listener.evidence.push({
            source: "Linux ps process table",
            collectedAt,
            confidence: "high",
            fields: [
              "parentPid",
              "user",
              "executable",
              ...(listener.parentChain.length
                ? (["parentChain"] satisfies ObservationField[])
                : []),
            ],
          });
        }
        listener.command = commands.get(listener.pid);
        if (listener.command) {
          listener.evidence.push({
            source: "Linux ps command",
            collectedAt,
            confidence: "high",
            fields: ["command"],
          });
        }
        try {
          listener.workingDirectory = await readlink(
            `/proc/${listener.pid}/cwd`,
          );
          listener.evidence.push({
            source: "Linux procfs process cwd",
            collectedAt,
            confidence: "high",
            fields: ["workingDirectory"],
          });
        } catch {
          // procfs visibility depends on ownership and hidepid settings.
        }
      }

      const required: Array<
        [ObservationField, string | number | undefined]
      > = [
        ["pid", listener.pid],
        ["parentPid", listener.parentPid],
        ["user", listener.user],
        ["command", listener.command],
        ["executable", listener.executable],
        ["workingDirectory", listener.workingDirectory],
        [
          "parentChain",
          listener.parentChain.length || undefined,
        ],
      ];
      listener.unavailableFields = required
        .filter(([, value]) => value === undefined || value === "")
        .map(([field]) => field);
      listener.observationStatus =
        listener.unavailableFields.length === 0 ? "complete" : "partial";
      const resolved = resolveProcess(listener, attribution);
      listener.identity = resolved.identity;
      listener.launchSource = resolved.launchSource;
    }

    if (listeners.some(({ pid }) => pid === undefined)) {
      warnings.push(
        "Some Linux socket owners are unavailable at the current permission level.",
      );
    }

    return {
      scannedAt: collectedAt,
      platform: "linux",
      listeners,
      warnings,
    };
  }
}
