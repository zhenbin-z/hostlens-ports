import type {
  ObservationField,
  PortSnapshot,
} from "../../shared/ports";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  buildParentChain,
  parseLsofListeners,
  parseLsofWorkingDirectories,
  parsePsCommands,
  parsePsProcessTable,
} from "./macos-parser.ts";
import type { PortScanner } from "./port-scanner";
import { identifyProcess } from "./process-identity.ts";

const execFileAsync = promisify(execFile);
const LSOF_PATH = "/usr/sbin/lsof";
const PS_PATH = "/bin/ps";
const MAX_BUFFER_BYTES = 4 * 1024 * 1024;

export class MacOsPortScanner implements PortScanner {
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

  private async inspectCommands(processIds: number[]): Promise<Map<number, string>> {
    if (processIds.length === 0) return new Map();

    try {
      const { stdout } = await execFileAsync(
        PS_PATH,
        [
          "-p",
          processIds.join(","),
          "-o",
          "pid=",
          "-o",
          "command=",
        ],
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
    const [processTableEntries, commandsByPid, directoriesByPid] =
      await Promise.all([
        this.inspectProcessTable(),
        this.inspectCommands(processIds),
        this.inspectWorkingDirectories(processIds),
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
          listener.parentChain = buildParentChain(listener.pid, processTable);
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
      ];
      listener.unavailableFields = requiredDetails
        .filter(([, value]) => value === undefined || value === "")
        .map(([field]) => field);
      listener.observationStatus =
        listener.unavailableFields.length === 0 ? "complete" : "partial";

      const identity = identifyProcess(listener);
      listener.displayName = identity.displayName;
      listener.ownerType = identity.ownerType;
      listener.projectName = identity.projectName;
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
