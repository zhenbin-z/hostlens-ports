import type {
  ObservationConfidence,
  ObservationStatus,
  PortListener,
} from "./ports.ts";
import type { ServiceDefinition } from "./services.ts";

export type RuntimeKind = "node" | "python";
export type RuntimeSource =
  | "system"
  | "homebrew"
  | "nvm"
  | "pyenv"
  | "standalone"
  | "unknown";
export type PackageManagerKind = "npm" | "yarn" | "pnpm" | "pip" | "pipx";
export type RuntimeObservationField =
  | "kind"
  | "version"
  | "executable"
  | "source"
  | "environment"
  | "packageName"
  | "packageVersion"
  | "manager"
  | "installPath"
  | "executables"
  | "relationship";

export interface RuntimeEvidence {
  kind: "observed" | "inferred";
  source: string;
  detail: string;
  collectedAt: string;
  confidence: ObservationConfidence;
  fields: RuntimeObservationField[];
}

export interface RuntimeInstallation {
  id: string;
  kind: RuntimeKind;
  version: string;
  executable: string;
  source: RuntimeSource;
  environmentPath?: string;
  observationStatus: ObservationStatus;
  unavailableFields: RuntimeObservationField[];
  confidence: ObservationConfidence;
  evidence: RuntimeEvidence[];
}

export interface GlobalPackage {
  id: string;
  name: string;
  version: string;
  manager: PackageManagerKind;
  managerExecutable: string;
  runtimeId?: string;
  installPath?: string;
  environmentPath?: string;
  executables: string[];
  observationStatus: ObservationStatus;
  unavailableFields: RuntimeObservationField[];
  confidence: ObservationConfidence;
  evidence: RuntimeEvidence[];
}

export type PackageRelationshipTarget =
  | "listener"
  | "process"
  | "service"
  | "project";

export interface PackageRelationship {
  packageId: string;
  targetType: PackageRelationshipTarget;
  targetId: string;
  reason: string;
  confidence: ObservationConfidence;
  evidence: RuntimeEvidence[];
}

export interface RuntimeSnapshot {
  scannedAt: string;
  platform: string;
  runtimes: RuntimeInstallation[];
  packages: GlobalPackage[];
  relationships: PackageRelationship[];
  warnings: string[];
}

export interface RuntimeScanner {
  scan(
    listeners: PortListener[],
    services: ServiceDefinition[],
  ): Promise<RuntimeSnapshot>;
}
