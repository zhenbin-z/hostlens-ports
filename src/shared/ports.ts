export type PortExposure = "local" | "network" | "unknown";
export type PortType = "system" | "service" | "dynamic";
export type ObservationConfidence = "high" | "medium" | "low";
export type ObservationStatus = "complete" | "partial";
export type ObservationField =
  | "socket"
  | "pid"
  | "processName"
  | "parentPid"
  | "user"
  | "command"
  | "executable"
  | "workingDirectory"
  | "parentChain";
export type ProcessOwnerType =
  | "system"
  | "service"
  | "application"
  | "development"
  | "unknown";
export type TransportProtocol = "tcp" | "udp";

export interface ObservationEvidence {
  source: string;
  collectedAt: string;
  confidence: ObservationConfidence;
  fields: ObservationField[];
}

export interface ProcessAncestor {
  pid: number;
  parentPid?: number;
  processName: string;
  executable?: string;
}

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
  workingDirectory?: string;
  parentChain: ProcessAncestor[];
  observationStatus: ObservationStatus;
  unavailableFields: ObservationField[];
  evidence: ObservationEvidence[];
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
