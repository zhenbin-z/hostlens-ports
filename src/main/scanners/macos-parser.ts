import { basename } from "node:path";
import type {
  PortExposure,
  PortListener,
  ProcessAncestor,
} from "../../shared/ports";
import {
  classifyPortType,
  createUnknownLaunchSource,
  createUnresolvedIdentity,
} from "./process-identity.ts";

interface ProcessRecord {
  pid?: number;
  processName?: string;
  userId?: string;
}

export interface ProcessDetails {
  parentPid?: number;
  user?: string;
  command?: string;
}

export interface ProcessTableEntry {
  pid: number;
  parentPid: number;
  user: string;
  executable: string;
}

function classifyExposure(address: string): PortExposure {
  const normalized = address.replace(/^\[(.*)]$/, "$1").toLowerCase();

  if (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized.startsWith("127.")
  ) {
    return "local";
  }

  if (normalized.length > 0) {
    return "network";
  }

  return "unknown";
}

function parseEndpoint(value: string): { address: string; port: number } | null {
  const match = value.match(/^(.*):(\d+)$/);
  if (!match) return null;

  const port = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) return null;

  const rawAddress = match[1] ?? "";
  const address = rawAddress.replace(/^\[(.*)]$/, "$1");
  if (!address) return null;

  return { address, port };
}

/**
 * Parses lsof's machine-readable field output:
 * lsof -nP -FpcunT -iTCP -sTCP:LISTEN
 */
export function parseLsofListeners(output: string): PortListener[] {
  const listeners: PortListener[] = [];
  const seen = new Set<string>();
  let process: ProcessRecord = {};

  for (const rawLine of output.split(/\r?\n/)) {
    if (!rawLine) continue;

    const field = rawLine[0];
    const value = rawLine.slice(1);

    if (field === "p") {
      process = {
        pid: Number.parseInt(value, 10),
      };
      continue;
    }

    if (field === "c") {
      process.processName = value;
      continue;
    }

    if (field === "u") {
      process.userId = value;
      continue;
    }

    if (field !== "n" || !Number.isInteger(process.pid)) continue;

    const endpoint = parseEndpoint(value);
    if (!endpoint) continue;

    const id = [
      "tcp",
      endpoint.address,
      endpoint.port,
      process.pid,
    ].join("-");
    if (seen.has(id)) continue;
    seen.add(id);

    listeners.push({
      id,
      protocol: "tcp",
      address: endpoint.address,
      port: endpoint.port,
      pid: process.pid,
      processName: process.processName || "Unknown process",
      user: process.userId,
      exposure: classifyExposure(endpoint.address),
      portType: classifyPortType(endpoint.port),
      parentChain: [],
      observationStatus: "partial",
      unavailableFields: [
        "parentPid",
        "command",
        "executable",
        "workingDirectory",
        "parentChain",
      ],
      evidence: [],
      identity: createUnresolvedIdentity(
        process.processName || "Unknown process",
      ),
      launchSource: createUnknownLaunchSource(),
    });
  }

  return listeners.sort((left, right) => {
    if (left.port !== right.port) return left.port - right.port;
    return left.processName.localeCompare(right.processName);
  });
}

/**
 * Parses: ps -p <pid> -o ppid= -o user= -o command=
 */
export function parsePsDetails(output: string): ProcessDetails {
  const line = output.trim();
  const match = line.match(/^(\d+)\s+(\S+)\s+(.+)$/s);

  if (!match) return {};

  return {
    parentPid: Number.parseInt(match[1] ?? "", 10),
    user: match[2],
    command: match[3]?.trim(),
  };
}

/**
 * Parses: ps -axo pid=,ppid=,user=,comm=
 *
 * The executable/comm column is last because application paths may contain
 * spaces on macOS.
 */
export function parsePsProcessTable(output: string): ProcessTableEntry[] {
  const entries: ProcessTableEntry[] = [];

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.+?)\s*$/);
    if (!match) continue;

    entries.push({
      pid: Number.parseInt(match[1] ?? "", 10),
      parentPid: Number.parseInt(match[2] ?? "", 10),
      user: match[3] ?? "",
      executable: match[4] ?? "",
    });
  }

  return entries;
}

/**
 * Parses: ps -p <pid-list> -o pid= -o command=
 */
export function parsePsCommands(output: string): Map<number, string> {
  const commands = new Map<number, string>();

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)\s+(.+?)\s*$/);
    if (!match) continue;

    commands.set(Number.parseInt(match[1] ?? "", 10), match[2] ?? "");
  }

  return commands;
}

/**
 * Parses: lsof -a -p <pid-list> -d cwd -Fpn
 */
export function parseLsofWorkingDirectories(output: string): Map<number, string> {
  const directories = new Map<number, string>();
  let currentPid: number | undefined;
  let currentDescriptor = "";

  for (const rawLine of output.split(/\r?\n/)) {
    if (!rawLine) continue;

    const field = rawLine[0];
    const value = rawLine.slice(1);

    if (field === "p") {
      const parsed = Number.parseInt(value, 10);
      currentPid = Number.isInteger(parsed) ? parsed : undefined;
      currentDescriptor = "";
      continue;
    }

    if (field === "f") {
      currentDescriptor = value;
      continue;
    }

    if (field === "n" && currentPid !== undefined && currentDescriptor === "cwd") {
      directories.set(currentPid, value);
    }
  }

  return directories;
}

export function buildParentChain(
  pid: number,
  processTable: ReadonlyMap<number, ProcessTableEntry>,
  commandsByPid: ReadonlyMap<number, string> = new Map(),
  maxDepth = 8,
): ProcessAncestor[] {
  const chain: ProcessAncestor[] = [];
  const visited = new Set<number>([pid]);
  let parentPid = processTable.get(pid)?.parentPid;

  while (
    parentPid !== undefined &&
    parentPid > 0 &&
    !visited.has(parentPid) &&
    chain.length < maxDepth
  ) {
    visited.add(parentPid);
    const parent = processTable.get(parentPid);
    if (!parent) break;

    const command = commandsByPid.get(parent.pid);
    chain.push({
      pid: parent.pid,
      parentPid: parent.parentPid > 0 ? parent.parentPid : undefined,
      processName: basename(parent.executable) || parent.executable,
      executable: parent.executable || undefined,
      ...(command ? { command } : {}),
    });
    parentPid = parent.parentPid;
  }

  return chain;
}
