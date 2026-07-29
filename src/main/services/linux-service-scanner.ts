import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { basename } from "node:path";
import { promisify } from "node:util";
import type { PortListener } from "../../shared/ports.ts";
import type {
  ServiceScanner,
  ServiceSnapshot,
} from "../../shared/services.ts";
import {
  parsePsCommands,
  parsePsProcessTable,
} from "../scanners/macos-parser.ts";
import { relateServicesToListeners } from "./service-relations.ts";
import { parseSystemdUnits } from "./linux-service-parser.ts";

const execFileAsync = promisify(execFile);
const SYSTEMCTL_PATHS = ["/usr/bin/systemctl", "/bin/systemctl"];
const PS_PATHS = ["/usr/bin/ps", "/bin/ps"];
const MAX_BUFFER_BYTES = 16 * 1024 * 1024;

async function firstAvailable(paths: string[]): Promise<string | undefined> {
  for (const path of paths) {
    try {
      await access(path);
      return path;
    } catch {
      // Keep checking known absolute paths.
    }
  }
  return undefined;
}

export class LinuxServiceScanner implements ServiceScanner {
  public async scan(listeners: PortListener[]): Promise<ServiceSnapshot> {
    const collectedAt = new Date().toISOString();
    const warnings: string[] = [];
    const systemctl = await firstAvailable(SYSTEMCTL_PATHS);
    if (!systemctl) {
      return {
        scannedAt: collectedAt,
        platform: "linux",
        services: [],
        warnings: ["systemctl is unavailable; systemd services were not inspected."],
      };
    }

    let services = [];
    try {
      const { stdout } = await execFileAsync(
        systemctl,
        [
          "show",
          "--all",
          "--type=service",
          "--no-pager",
          "--property=Id,Description,LoadState,ActiveState,SubState,MainPID,ExecStart,FragmentPath,UnitFileState",
        ],
        {
          encoding: "utf8",
          maxBuffer: MAX_BUFFER_BYTES,
          timeout: 10_000,
        },
      );
      services = parseSystemdUnits(stdout, collectedAt);
    } catch (cause) {
      const partial = cause as { stdout?: string; message?: string };
      services = parseSystemdUnits(partial.stdout ?? "", collectedAt);
      warnings.push(
        `systemd service inspection was partial: ${partial.message ?? "unknown error"}`,
      );
    }

    const processes = [];
    const ps = await firstAvailable(PS_PATHS);
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
        const commands = parsePsCommands(commandTable.stdout);
        processes.push(
          ...parsePsProcessTable(table.stdout).map((process) => ({
            pid: process.pid,
            parentPid:
              process.parentPid > 0 ? process.parentPid : undefined,
            processName: basename(process.executable),
            command: commands.get(process.pid),
          })),
        );
      } catch {
        warnings.push("Linux process relationships are partial.");
      }
    }

    return {
      scannedAt: collectedAt,
      platform: "linux",
      services: relateServicesToListeners(services, listeners, processes),
      warnings,
    };
  }
}
