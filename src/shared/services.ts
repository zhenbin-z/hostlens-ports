import type {
  IdentityEvidenceKind,
  ObservationConfidence,
  ObservationStatus,
  PortListener,
} from "./ports.ts";

export type ServiceManager = "launchd" | "homebrew";
export type ServiceKind = "user-agent" | "system-agent" | "system-daemon";
export type ServiceScope = "user" | "system";
export type ServiceOwnership =
  | "apple"
  | "application"
  | "third-party"
  | "unknown";
export type ServiceStatus =
  | "running"
  | "loaded"
  | "stopped"
  | "failed"
  | "disabled"
  | "unknown";
export type StartupBehavior =
  | "automatic"
  | "on-demand"
  | "disabled"
  | "unknown";
export type ServiceObservationField =
  | "label"
  | "manager"
  | "kind"
  | "scope"
  | "status"
  | "pid"
  | "lastExitStatus"
  | "program"
  | "arguments"
  | "plistPath"
  | "startup"
  | "homebrewName"
  | "relationships";

export interface ServiceEvidence {
  kind: IdentityEvidenceKind;
  source: string;
  detail: string;
  collectedAt: string;
  confidence: ObservationConfidence;
  fields: ServiceObservationField[];
}

export interface ServiceProcess {
  pid: number;
  parentPid?: number;
  processName: string;
  command?: string;
  relationship: "direct" | "descendant";
}

export interface ServiceDefinition {
  id: string;
  label: string;
  displayName: string;
  manager: ServiceManager;
  kind: ServiceKind;
  scope: ServiceScope;
  ownership: ServiceOwnership;
  status: ServiceStatus;
  startup: StartupBehavior;
  pid?: number;
  lastExitStatus?: number;
  program?: string;
  arguments: string[];
  plistPath?: string;
  homebrewName?: string;
  runAtLoad?: boolean;
  keepAlive?: boolean;
  relatedProcessIds: number[];
  relatedProcesses: ServiceProcess[];
  relatedListenerIds: string[];
  observationStatus: ObservationStatus;
  unavailableFields: ServiceObservationField[];
  confidence: ObservationConfidence;
  evidence: ServiceEvidence[];
}

export interface ServiceSnapshot {
  scannedAt: string;
  platform: string;
  services: ServiceDefinition[];
  warnings: string[];
}

export interface ServiceScanner {
  scan(listeners: PortListener[]): Promise<ServiceSnapshot>;
}
