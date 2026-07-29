import type {
  ObservationConfidence,
  ObservationStatus,
  PortListener,
} from "./ports.ts";

export type NetworkInterfaceKind =
  | "ethernet"
  | "wifi"
  | "loopback"
  | "vpn"
  | "bridge"
  | "virtual"
  | "unknown";
export type NetworkInterfaceStatus = "up" | "down" | "unknown";
export type NetworkAddressFamily = "ipv4" | "ipv6";
export type NetworkAddressScope = "host" | "link" | "network" | "unknown";
export type NetworkEvidenceKind = "observed" | "inferred";
export type NetworkObservationField =
  | "interface"
  | "displayName"
  | "status"
  | "kind"
  | "address"
  | "macAddress"
  | "mtu"
  | "route"
  | "dns"
  | "vpn"
  | "socketRelation";

export interface NetworkEvidence {
  kind: NetworkEvidenceKind;
  source: string;
  detail: string;
  collectedAt: string;
  confidence: ObservationConfidence;
  fields: NetworkObservationField[];
}

export interface NetworkAddress {
  family: NetworkAddressFamily;
  address: string;
  prefixLength?: number;
  scope: NetworkAddressScope;
}

export interface NetworkInterface {
  id: string;
  name: string;
  displayName: string;
  kind: NetworkInterfaceKind;
  status: NetworkInterfaceStatus;
  macAddress?: string;
  mtu?: number;
  addresses: NetworkAddress[];
  observationStatus: ObservationStatus;
  unavailableFields: NetworkObservationField[];
  confidence: ObservationConfidence;
  evidence: NetworkEvidence[];
}

export interface NetworkRoute {
  id: string;
  family: NetworkAddressFamily;
  destination: string;
  gateway?: string;
  interfaceName?: string;
  isDefault: boolean;
  confidence: ObservationConfidence;
  evidence: NetworkEvidence[];
}

export interface DnsResolver {
  id: string;
  interfaceName?: string;
  nameservers: string[];
  searchDomains: string[];
  confidence: ObservationConfidence;
  evidence: NetworkEvidence[];
}

export interface VpnConnection {
  id: string;
  name: string;
  interfaceName: string;
  status: "connected" | "observed" | "unknown";
  addresses: NetworkAddress[];
  confidence: ObservationConfidence;
  evidence: NetworkEvidence[];
}

export type SocketInterfaceRelationKind = "bound" | "potential";
export type SocketReachability = "local" | "potential" | "unknown";

export interface SocketInterfaceRelation {
  listenerId: string;
  interfaceIds: string[];
  kind: SocketInterfaceRelationKind;
  reachability: SocketReachability;
  confidence: ObservationConfidence;
  reason: string;
  evidence: NetworkEvidence[];
}

export interface HostNetworkSummary {
  defaultInterfaceName?: string;
  defaultGateway?: string;
  primaryAddress?: string;
  dnsServers: string[];
  vpnActive: boolean;
}

export interface NetworkSnapshot {
  scannedAt: string;
  platform: string;
  interfaces: NetworkInterface[];
  routes: NetworkRoute[];
  dnsResolvers: DnsResolver[];
  vpnConnections: VpnConnection[];
  socketRelations: SocketInterfaceRelation[];
  summary: HostNetworkSummary;
  warnings: string[];
}

export interface NetworkScanner {
  scan(listeners: PortListener[]): Promise<NetworkSnapshot>;
}
