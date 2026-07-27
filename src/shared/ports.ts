export type PortExposure = "local" | "network" | "unknown";
export type PortType = "system" | "service" | "dynamic";
export type ProcessOwnerType =
  | "system"
  | "service"
  | "application"
  | "development"
  | "unknown";
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
  displayName?: string;
  ownerType?: ProcessOwnerType;
  portType: PortType;
  projectName?: string;
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
  copyText(text: string): Promise<void>;
  openMainWindow(): Promise<void>;
  quitApp(): Promise<void>;
}
