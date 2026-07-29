import type {
  DnsResolver,
  FirewallObservation,
  NetworkAddress,
  NetworkAddressScope,
  NetworkEvidence,
  NetworkInterface,
  NetworkInterfaceKind,
  NetworkRoute,
  VpnConnection,
} from "../../shared/network.ts";

export function parseFirewalldObservation(
  stateOutput: string,
  zonesOutput: string,
  collectedAt: string,
  available = true,
): FirewallObservation {
  if (!available) {
    return {
      manager: "firewalld",
      status: "unavailable",
      activeZones: [],
      confidence: "high",
      evidence: [
        evidence(
          collectedAt,
          "firewall-cmd availability",
          "firewall-cmd was not found in a known system path",
          ["firewall"],
        ),
      ],
    };
  }
  const normalizedState = stateOutput.trim().toLowerCase();
  const status =
    normalizedState === "running"
      ? "running"
      : normalizedState.includes("not running")
        ? "stopped"
        : "unknown";
  const activeZones = zonesOutput
    .split(/\r?\n/)
    .filter((line) => line.trim() && !/^\s/.test(line))
    .map((line) => line.trim().split(/\s+/, 1)[0]!)
    .filter(Boolean);
  return {
    manager: "firewalld",
    status,
    activeZones: [...new Set(activeZones)],
    confidence: "high",
    evidence: [
      evidence(
        collectedAt,
        "firewall-cmd",
        `state=${normalizedState || "unknown"}; zones=${activeZones.join(",") || "none observed"}`,
        ["firewall"],
      ),
    ],
  };
}

interface IpAddressRecord {
  ifname?: string;
  operstate?: string;
  mtu?: number;
  address?: string;
  link_type?: string;
  addr_info?: Array<{
    family?: string;
    local?: string;
    prefixlen?: number;
    scope?: string;
  }>;
}

interface IpRouteRecord {
  dst?: string;
  gateway?: string;
  dev?: string;
  protocol?: string;
}

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

function kindFor(name: string, linkType: string | undefined): NetworkInterfaceKind {
  if (name === "lo") return "loopback";
  if (/^(tun|tap|wg|ppp|ipsec|tailscale|zt)/i.test(name)) return "vpn";
  if (/^(br|docker|podman|virbr|cni|veth)/i.test(name)) return "bridge";
  if (/^(wl|wlan)/i.test(name)) return "wifi";
  if (/^(en|eth)/i.test(name) || linkType === "ether") return "ethernet";
  if (/^(dummy|sit|gre|vxlan)/i.test(name)) return "virtual";
  return "unknown";
}

function scopeFor(
  family: NetworkAddress["family"],
  address: string,
  scope: string | undefined,
): NetworkAddressScope {
  if (scope === "host" || address === "::1" || address.startsWith("127.")) {
    return "host";
  }
  if (
    scope === "link" ||
    address.startsWith("169.254.") ||
    address.toLowerCase().startsWith("fe80:")
  ) {
    return "link";
  }
  return family === "ipv4" || family === "ipv6" ? "network" : "unknown";
}

export function parseIpAddressJson(
  output: string,
  collectedAt: string,
): NetworkInterface[] {
  let records: IpAddressRecord[];
  try {
    const parsed = JSON.parse(output) as unknown;
    records = Array.isArray(parsed) ? (parsed as IpAddressRecord[]) : [];
  } catch {
    return [];
  }

  return records
    .filter((record): record is IpAddressRecord & { ifname: string } =>
      Boolean(record.ifname),
    )
    .map((record) => {
      const addresses = (record.addr_info ?? [])
        .filter(
          (
            item,
          ): item is typeof item & {
            family: "inet" | "inet6";
            local: string;
          } =>
            (item.family === "inet" || item.family === "inet6") &&
            Boolean(item.local),
        )
        .map((item) => {
          const family = item.family === "inet" ? "ipv4" : "ipv6";
          return {
            family,
            address: item.local,
            prefixLength: item.prefixlen,
            scope: scopeFor(family, item.local, item.scope),
          } satisfies NetworkAddress;
        });
      const kind = kindFor(record.ifname, record.link_type);
      const macAddress =
        record.address && /^[0-9a-f:]{17}$/i.test(record.address)
          ? record.address.toLowerCase()
          : undefined;
      const unavailableFields = [
        ...(addresses.length === 0 ? (["address"] as const) : []),
        ...(!macAddress && kind !== "loopback"
          ? (["macAddress"] as const)
          : []),
      ];
      return {
        id: `interface:${record.ifname}`,
        name: record.ifname,
        displayName: record.ifname,
        kind,
        status:
          record.operstate === "UP"
            ? "up"
            : record.operstate === "DOWN"
              ? "down"
              : "unknown",
        macAddress,
        mtu: record.mtu,
        addresses,
        observationStatus:
          unavailableFields.length === 0 ? "complete" : "partial",
        unavailableFields,
        confidence: "high",
        evidence: [
          evidence(
            collectedAt,
            "Linux ip -j address",
            `${record.ifname}: ${record.operstate ?? "unknown"}`,
            ["interface", "status", "kind", "address", "macAddress", "mtu"],
          ),
        ],
      } satisfies NetworkInterface;
    });
}

export function parseIpRouteJson(
  output: string,
  family: NetworkRoute["family"],
  collectedAt: string,
): NetworkRoute[] {
  let records: IpRouteRecord[];
  try {
    const parsed = JSON.parse(output) as unknown;
    records = Array.isArray(parsed) ? (parsed as IpRouteRecord[]) : [];
  } catch {
    return [];
  }
  return records
    .filter(({ dst }) => Boolean(dst))
    .map((record) => ({
      id: `route:${family}:${record.dst}:${record.dev ?? "unknown"}`,
      family,
      destination: record.dst ?? "",
      gateway: record.gateway,
      interfaceName: record.dev,
      isDefault: record.dst === "default",
      confidence: "high",
      evidence: [
        evidence(
          collectedAt,
          "Linux ip -j route",
          JSON.stringify(record),
          ["route"],
        ),
      ],
    }));
}

export function parseResolvConf(
  output: string,
  collectedAt: string,
): DnsResolver[] {
  const nameservers: string[] = [];
  const searchDomains: string[] = [];
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const nameserver = line.match(/^nameserver\s+(\S+)/)?.[1];
    if (nameserver) nameservers.push(nameserver);
    const search = line.match(/^(?:search|domain)\s+(.+)/)?.[1];
    if (search) searchDomains.push(...search.split(/\s+/));
  }
  if (nameservers.length === 0 && searchDomains.length === 0) return [];
  return [
    {
      id: "dns:resolv-conf",
      nameservers: [...new Set(nameservers)],
      searchDomains: [...new Set(searchDomains)],
      confidence: "high",
      evidence: [
        evidence(
          collectedAt,
          "Linux /etc/resolv.conf",
          "Observed local resolver configuration",
          ["dns"],
        ),
      ],
    },
  ];
}

export function inferLinuxVpnConnections(
  interfaces: readonly NetworkInterface[],
  collectedAt: string,
): VpnConnection[] {
  return interfaces
    .filter(
      (item) =>
        item.kind === "vpn" &&
        item.status === "up" &&
        item.addresses.length > 0,
    )
    .map((item) => ({
      id: `vpn:${item.name}`,
      name: item.displayName,
      interfaceName: item.name,
      status: "observed",
      addresses: item.addresses,
      confidence: "medium",
      evidence: [
        evidence(
          collectedAt,
          "Linux interface heuristic",
          `${item.name} is an active tunnel-style interface`,
          ["vpn"],
          "inferred",
          "medium",
        ),
      ],
    }));
}
