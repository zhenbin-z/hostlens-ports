import type { PortSnapshot } from "../../shared/ports";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseLsofListeners, parsePsDetails } from "./macos-parser.ts";
import type { PortScanner } from "./port-scanner";

const execFileAsync = promisify(execFile);
const LSOF_PATH = "/usr/sbin/lsof";
const PS_PATH = "/bin/ps";
const MAX_BUFFER_BYTES = 4 * 1024 * 1024;

export class MacOsPortScanner implements PortScanner {
  private async inspectProcess(pid: number): Promise<ReturnType<typeof parsePsDetails>> {
    try {
      const { stdout } = await execFileAsync(
        PS_PATH,
        ["-p", String(pid), "-o", "ppid=", "-o", "user=", "-o", "command="],
        {
          encoding: "utf8",
          maxBuffer: MAX_BUFFER_BYTES,
          timeout: 3_000,
        },
      );
      return parsePsDetails(stdout);
    } catch {
      // The process may have exited between the lsof and ps calls, or macOS may
      // not permit details for another user's process. The listener is still
      // useful, so process enrichment is best effort.
      return {};
    }
  }

  public async scan(): Promise<PortSnapshot> {
    const warnings: string[] = [];
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
    const detailsByPid = new Map(
      await Promise.all(
        processIds.map(async (pid) => [pid, await this.inspectProcess(pid)] as const),
      ),
    );

    for (const listener of listeners) {
      if (!listener.pid) continue;
      const processDetails = detailsByPid.get(listener.pid);
      if (!processDetails) continue;

      listener.parentPid = processDetails.parentPid;
      listener.user = processDetails.user ?? listener.user;
      listener.command = processDetails.command;
    }

    if (listeners.some((listener) => !listener.command)) {
      warnings.push(
        "Some process details are unavailable because the process exited or macOS restricted access.",
      );
    }

    return {
      scannedAt: new Date().toISOString(),
      platform: "darwin",
      listeners,
      warnings,
    };
  }
}
