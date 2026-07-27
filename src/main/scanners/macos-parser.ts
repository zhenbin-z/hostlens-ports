import type { PortExposure, PortListener } from "../../shared/ports";
import { classifyPortType } from "./process-identity.ts";

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
