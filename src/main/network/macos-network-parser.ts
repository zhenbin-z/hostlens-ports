import type {
  DnsResolver,
  NetworkAddress,
  NetworkAddressScope,
  NetworkEvidence,
  NetworkInterface,
  NetworkInterfaceKind,
  NetworkRoute,
  SocketInterfaceRelation,
  VpnConnection,
} from "../../shared/network.ts";
import type { PortListener } from "../../shared/ports.ts";

function evidence(
  collectedAt: string,
  source: string,
  detail: string,
  fields: NetworkEvidence["fields"],
  kind: NetworkEvidence["kind"] = "observed",
  confidence: NetworkEvidence["confidence"] = "high",
): NetworkEvidence {
  return { collectedAt, source, detail, fields, kind, confidence };
}

function hexNetmaskPrefix(value: string): number | undefined {
  if (!/^0x[0-9a-f]+$/i.test(value)) return undefined;
  const binary = Number.parseInt(value.slice(2), 16)
    .toString(2)
    .padStart(32, "0");
  return binary.split("").filter((bit) => bit === "1").length;
}

function addressScope(
  family: NetworkAddress["family"],
  address: string,
): NetworkAddressScope {
  if (
    address === "127.0.0.1" ||
    address === "::1" ||
    address.startsWith("127.")
  ) {
    return "host";
  }
  if (
    (family === "ipv4" && address.startsWith("169.254.")) ||
    (family === "ipv6" && address.toLowerCase().startsWith("fe80:"))
  ) {
    return "link";
  }
  return "network";
}

function interfaceKind(
  name: string,
  displayName: string | undefined,
): NetworkInterfaceKind {
  const friendly = displayName?.toLowerCase() ?? "";
  if (name === "lo0") return "loopback";
  if (/^(utun|ppp|ipsec)/.test(name)) return "vpn";
  if (/^(bridge)/.test(name)) return "bridge";
  if (friendly.includes("wi-fi") || friendly.includes("airport")) return "wifi";
  if (friendly.includes("ethernet")) return "ethernet";
  if (/^(en)\d+$/.test(name)) return "ethernet";
  if (/^(awdl|llw|gif|stf|anpi|ap|vmenet|vmnet|vnic)/.test(name)) {
    return "virtual";
  }
  return "unknown";
}

export function parseHardwarePorts(output: string): Map<string, string> {
  const result = new Map<string, string>();
  let displayName: string | undefined;

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    const hardware = line.match(/^Hardware Port:\s*(.+)$/);
    if (hardware?.[1]) {
      displayName = hardware[1].trim();
      continue;
    }
    const device = line.match(/^Device:\s*(\S+)$/);
    if (device?.[1] && displayName) {
      result.set(device[1], displayName);
      displayName = undefined;
    }
  }
  return result;
}

export function parseIfconfig(
  output: string,
  hardwarePorts: ReadonlyMap<string, string>,
  collectedAt: string,
): NetworkInterface[] {
  const result: NetworkInterface[] = [];
  let current: NetworkInterface | undefined;

  const finish = (): void => {
    if (!current) return;
    current.unavailableFields = [
      ...(current.addresses.length === 0 ? (["address"] as const) : []),
      ...(!current.macAddress && current.kind !== "loopback"
        ? (["macAddress"] as const)
        : []),
    ];
    current.observationStatus =
      current.unavailableFields.length === 0 ? "complete" : "partial";
    result.push(current);
  };

  for (const rawLine of output.split(/\r?\n/)) {
    const header = rawLine.match(
      /^([A-Za-z0-9_.:-]+):\s+flags=\d+<([^>]*)>(?:\s+mtu\s+(\d+))?/,
    );
    if (header?.[1]) {
      finish();
      const name = header[1];
      const flags = new Set((header[2] ?? "").split(","));
      const displayName = hardwarePorts.get(name);
      current = {
        id: `interface:${name}`,
        name,
        displayName: displayName ?? name,
        kind: interfaceKind(name, displayName),
        status: flags.has("UP") ? "up" : "down",
        mtu: header[3] ? Number.parseInt(header[3], 10) : undefined,
        addresses: [],
        observationStatus: "complete",
        unavailableFields: [],
        confidence: "high",
        evidence: [
          evidence(
            collectedAt,
            "macOS ifconfig",
            `Observed interface ${name} with flags ${[...flags].join(",")}`,
            ["interface", "status", "mtu"],
          ),
          ...(displayName
            ? [
                evidence(
                  collectedAt,
                  "macOS networksetup",
                  `Mapped ${name} to ${displayName}`,
                  ["displayName", "kind"],
                ),
              ]
            : []),
        ],
      };
      continue;
    }
    if (!current) continue;

    const line = rawLine.trim();
    const mac = line.match(/^ether\s+([0-9a-f:]{17})/i);
    if (mac?.[1]) {
      current.macAddress = mac[1].toLowerCase();
      current.evidence.push(
        evidence(collectedAt, "macOS ifconfig", line, ["macAddress"]),
      );
      continue;
    }

    const ipv4 = line.match(
      /^inet\s+(\S+)(?:\s+netmask\s+(\S+))?/,
    );
    if (ipv4?.[1]) {
      current.addresses.push({
        family: "ipv4",
        address: ipv4[1],
        prefixLength: ipv4[2] ? hexNetmaskPrefix(ipv4[2]) : undefined,
        scope: addressScope("ipv4", ipv4[1]),
      });
      current.evidence.push(
        evidence(collectedAt, "macOS ifconfig", line, ["address"]),
      );
      continue;
    }

    const ipv6 = line.match(/^inet6\s+(\S+)(?:\s+prefixlen\s+(\d+))?/);
    if (ipv6?.[1]) {
      const address = ipv6[1].split("%")[0] ?? ipv6[1];
      current.addresses.push({
        family: "ipv6",
        address,
        prefixLength: ipv6[2] ? Number.parseInt(ipv6[2], 10) : undefined,
        scope: addressScope("ipv6", address),
      });
      current.evidence.push(
        evidence(collectedAt, "macOS ifconfig", line, ["address"]),
      );
    }
  }
  finish();
  return result;
}

export function parseRoutes(
  output: string,
  family: NetworkRoute["family"],
  collectedAt: string,
): NetworkRoute[] {
  const routes: NetworkRoute[] = [];
  let inTable = false;

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (/^Destination\s+Gateway\s+Flags/i.test(line)) {
      inTable = true;
      continue;
    }
    if (!inTable || !line || line.startsWith("Internet")) continue;
    const columns = line.split(/\s+/);
    const destination = columns[0];
    const gateway = columns[1];
    const interfaceName = columns.at(-1);
    if (!destination || !gateway || !interfaceName) continue;
    if (!/^(default|[0-9a-f:.\/]+)$/i.test(destination)) continue;

    routes.push({
      id: `route:${family}:${destination}:${interfaceName}`,
      family,
      destination,
      gateway: gateway.startsWith("link#") ? undefined : gateway,
      interfaceName,
      isDefault: destination === "default",
      confidence: "high",
      evidence: [
        evidence(collectedAt, "macOS netstat route table", line, ["route"]),
      ],
    });
  }
  return routes;
}

export function parseDnsResolvers(
  output: string,
  collectedAt: string,
): DnsResolver[] {
  const resolvers: DnsResolver[] = [];
  let block: string[] = [];

  const finish = (): void => {
    if (block.length === 0) return;
    const heading = block[0]?.match(/^resolver #(\d+)/);
    const interfaceName = block
      .map((line) => line.match(/^\s*if_index\s*:\s*\d+\s*\(([^)]+)\)/)?.[1])
      .find(Boolean);
    const nameservers = block
      .map((line) => line.match(/^\s*nameserver\[\d+\]\s*:\s*(\S+)/)?.[1])
      .filter((value): value is string => Boolean(value));
    const searchDomains = block
      .map((line) => line.match(/^\s*search domain\[\d+\]\s*:\s*(\S+)/)?.[1])
      .filter((value): value is string => Boolean(value));
    if (nameservers.length > 0 || searchDomains.length > 0) {
      const id = heading?.[1] ?? String(resolvers.length + 1);
      resolvers.push({
        id: `dns:${id}`,
        interfaceName,
        nameservers: [...new Set(nameservers)],
        searchDomains: [...new Set(searchDomains)],
        confidence: "high",
        evidence: [
          evidence(
            collectedAt,
            "macOS scutil --dns",
            block.join("\n").trim(),
            ["dns"],
          ),
        ],
      });
    }
    block = [];
  };

  for (const rawLine of output.split(/\r?\n/)) {
    if (/^resolver #\d+/.test(rawLine.trim())) finish();
    if (block.length > 0 || /^resolver #\d+/.test(rawLine.trim())) {
      block.push(rawLine);
    }
  }
  finish();
  return resolvers;
}

export function inferVpnConnections(
  interfaces: readonly NetworkInterface[],
  collectedAt: string,
): VpnConnection[] {
  return interfaces
    .filter(
      (networkInterface) =>
        networkInterface.kind === "vpn" &&
        networkInterface.status === "up" &&
        networkInterface.addresses.some(
          (address) => address.scope === "network",
        ),
    )
    .map((networkInterface) => ({
      id: `vpn:${networkInterface.name}`,
      name: networkInterface.displayName,
      interfaceName: networkInterface.name,
      status: "observed",
      addresses: networkInterface.addresses,
      confidence: "medium",
      evidence: [
        evidence(
          collectedAt,
          "macOS interface heuristic",
          `${networkInterface.name} is an active tunnel-style interface`,
          ["vpn"],
          "inferred",
          "medium",
        ),
      ],
    }));
}

function normalizeAddress(value: string): string {
  return value.replace(/^\[|\]$/g, "").split("%")[0] ?? value;
}

function isWildcard(value: string): boolean {
  return value === "*" || value === "0.0.0.0" || value === "::";
}

function isLoopback(value: string): boolean {
  return value === "localhost" || value === "::1" || value.startsWith("127.");
}

export function relateSocketsToInterfaces(
  listeners: readonly PortListener[],
  interfaces: readonly NetworkInterface[],
  collectedAt: string,
): SocketInterfaceRelation[] {
  return listeners.map((listener) => {
    const address = normalizeAddress(listener.address);
    let candidates: NetworkInterface[] = [];
    let kind: SocketInterfaceRelation["kind"] = "bound";
    let reachability: SocketInterfaceRelation["reachability"] = "unknown";
    let reason = `No interface address matched ${listener.address}`;
    let confidence: SocketInterfaceRelation["confidence"] = "low";

    if (isWildcard(address)) {
      candidates = interfaces.filter(
        (item) =>
          item.status === "up" &&
          item.addresses.some((candidate) => candidate.scope === "network"),
      );
      kind = "potential";
      reachability = candidates.length > 0 ? "potential" : "unknown";
      reason =
        "Wildcard binding may accept traffic on each active network interface; reachability was not actively tested.";
      confidence = "high";
    } else if (isLoopback(address)) {
      candidates = interfaces.filter((item) => item.kind === "loopback");
      reachability = "local";
      reason = "The listener is bound to a loopback address.";
      confidence = "high";
    } else {
      candidates = interfaces.filter((item) =>
        item.addresses.some(
          (candidate) => normalizeAddress(candidate.address) === address,
        ),
      );
      if (candidates.length > 0) {
        reachability = candidates.every((item) => item.kind === "loopback")
          ? "local"
          : "potential";
        reason =
          "The listener address matches an observed interface; external reachability was not actively tested.";
        confidence = "high";
      }
    }

    return {
      listenerId: listener.id,
      interfaceIds: candidates.map((item) => item.id),
      kind,
      reachability,
      confidence,
      reason,
      evidence: [
        evidence(
          collectedAt,
          "HostLens socket-interface relation",
          reason,
          ["socketRelation"],
          "inferred",
          confidence,
        ),
      ],
    };
  });
}
