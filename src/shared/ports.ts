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
export type LaunchSourceKind =
  | "launchd"
  | "homebrew"
  | "docker"
  | "package-script"
  | "native-app"
  | "manual"
  | "unknown";
export type AutomaticStart = "yes" | "no" | "unknown";
export type IdentityEvidenceKind = "observed" | "inferred";

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
  command?: string;
}

export interface IdentityEvidence {
  kind: IdentityEvidenceKind;
  source: string;
  detail: string;
  confidence: ObservationConfidence;
}

export interface ProjectIdentity {
  name: string;
  path?: string;
  tool?: string;
  runtime?: string;
  packageManager?: "npm" | "yarn" | "pnpm";
  script?: string;
}

export interface LaunchSource {
  kind: LaunchSourceKind;
  label: string;
  detail?: string;
  automatic: AutomaticStart;
  confidence: ObservationConfidence;
  evidence: IdentityEvidence[];
}

export interface ProcessIdentity {
  displayName: string;
  kind: ProcessOwnerType;
  project?: ProjectIdentity;
  confidence: ObservationConfidence;
  evidence: IdentityEvidence[];
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
  portType: PortType;
  command?: string;
  executable?: string;
  workingDirectory?: string;
  parentChain: ProcessAncestor[];
  observationStatus: ObservationStatus;
  unavailableFields: ObservationField[];
  evidence: ObservationEvidence[];
  identity: ProcessIdentity;
  launchSource: LaunchSource;
  exposure: PortExposure;
}

export interface PortSnapshot {
  scannedAt: string;
  platform: string;
  listeners: PortListener[];
  warnings: string[];
}

export type ListenerChangeKind = "new" | "changed" | "closed";

export interface ListenerChange {
  id: string;
  kind: ListenerChangeKind;
  detectedAt: string;
  socketKey: string;
  changedFields: string[];
  before?: PortListener;
  after?: PortListener;
}

export interface SessionChanges {
  startedAt: string;
  events: ListenerChange[];
}

export interface HostLensState {
  snapshot: PortSnapshot;
  changes: SessionChanges;
}

export interface HostLensApi {
  listPorts(): Promise<HostLensState>;
  copyText(text: string): Promise<void>;
  exportText(suggestedName: string, text: string): Promise<boolean>;
  openMainWindow(): Promise<void>;
  quitApp(): Promise<void>;
}
