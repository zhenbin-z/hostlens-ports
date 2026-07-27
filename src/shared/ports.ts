export type PortExposure = "local" | "network" | "unknown";
export type TransportProtocol = "tcp" | "udp";

export interface PortListener {
  id: string;
  protocol: TransportProtocol;
  address: string;
  port: number;
  pid?: number;
  parentPid?: number;
  user?: string;
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
  warnings: string[];
}

export interface HostLensApi {
  listPorts(): Promise<PortSnapshot>;
}
