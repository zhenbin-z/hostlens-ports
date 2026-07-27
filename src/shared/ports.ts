export type PortExposure = "local" | "network" | "unknown";
export type TransportProtocol = "tcp" | "udp";

export interface PortListener {
  id: string;
  protocol: TransportProtocol;
  address: string;
  port: number;
  pid?: number;
  processName: string;
  command?: string;
  executable?: string;
  exposure: PortExposure;
  source?: string;
}

export interface PortSnapshot {
  scannedAt: string;
  platform: string;
  listeners: PortListener[];
}

export interface HostLensApi {
  listPorts(): Promise<PortSnapshot>;
}
