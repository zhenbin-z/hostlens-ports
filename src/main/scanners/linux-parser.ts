import type { PortExposure, PortListener } from "../../shared/ports.ts";
import {
  classifyPortType,
  createUnknownLaunchSource,
  createUnresolvedIdentity,
} from "./process-identity.ts";

function exposureFor(address: string): PortExposure {
  const normalized = address.replace(/^\[(.*)]$/, "$1").toLowerCase();
  if (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized.startsWith("127.")
  ) {
    return "local";
  }
  return normalized ? "network" : "unknown";
}

function parseLocalEndpoint(
  value: string,
): { address: string; port: number } | undefined {
  const match = value.match(/^(.*):(\d+)$/);
  if (!match?.[1] || !match[2]) return undefined;
  const port = Number.parseInt(match[2], 10);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) return undefined;
  const address = match[1].replace(/^\[(.*)]$/, "$1");
  return address ? { address, port } : undefined;
}

/**
 * Parses `ss -H -lntp` output from iproute2.
 *
 * Process metadata may be absent for sockets owned by another user. Those
 * listeners are preserved as partial observations instead of being dropped.
 */
export function parseSsListeners(output: string): PortListener[] {
  const listeners: PortListener[] = [];
  const seen = new Set<string>();

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const columns = line.split(/\s+/);
    if (columns.length < 4) continue;
    const stateOffset = columns[0] === "LISTEN" ? 1 : 0;
    const local = columns[stateOffset + 2];
    if (!local) continue;
    const endpoint = parseLocalEndpoint(local);
    if (!endpoint) continue;

    const processText = columns.slice(stateOffset + 4).join(" ");
    const processMatch = processText.match(
      /users:\(\("((?:\\.|[^"])*)",pid=(\d+),fd=\d+/,
    );
    const processName = processMatch?.[1]?.replace(/\\"/g, '"') ??
      "Unknown process";
    const pid = processMatch?.[2]
      ? Number.parseInt(processMatch[2], 10)
      : undefined;
    const id = ["tcp", endpoint.address, endpoint.port, pid ?? "unknown"].join(
      "-",
    );
    const socketKey = `${endpoint.address}:${endpoint.port}:${pid ?? "unknown"}`;
    if (seen.has(socketKey)) continue;
    seen.add(socketKey);

    listeners.push({
      id,
      protocol: "tcp",
      address: endpoint.address,
      port: endpoint.port,
      pid,
      processName,
      portType: classifyPortType(endpoint.port),
      parentChain: [],
      observationStatus: "partial",
      unavailableFields: [
        ...(!pid ? (["pid"] as const) : []),
        "parentPid",
        "user",
        "command",
        "executable",
        "workingDirectory",
        "parentChain",
      ],
      evidence: [],
      identity: createUnresolvedIdentity(processName),
      launchSource: createUnknownLaunchSource(),
      exposure: exposureFor(endpoint.address),
    });
  }

  return listeners.sort(
    (left, right) =>
      left.port - right.port ||
      left.address.localeCompare(right.address) ||
      left.processName.localeCompare(right.processName),
  );
}
