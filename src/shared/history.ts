import type { NetworkSnapshot } from "./network.ts";
import type { PortSnapshot } from "./ports.ts";
import type { RuntimeSnapshot } from "./runtimes.ts";
import type { ServiceSnapshot } from "./services.ts";

export const HOST_SNAPSHOT_SCHEMA_VERSION = 1;
export const HISTORY_STORAGE_VERSION = 1;

export type ChangeResourceKind =
  | "port"
  | "service"
  | "network"
  | "runtime"
  | "package";
export type PersistentChangeKind = "added" | "removed" | "changed";
export type ResourcePreference = "default" | "watched" | "ignored";

export interface HostObservationSnapshot {
  schemaVersion: typeof HOST_SNAPSHOT_SCHEMA_VERSION;
  observedAt: string;
  ports: PortSnapshot;
  services: ServiceSnapshot;
  network: NetworkSnapshot;
  runtimes: RuntimeSnapshot;
}

export interface ChangeEvent {
  id: string;
  detectedAt: string;
  resourceKind: ChangeResourceKind;
  resourceId: string;
  resourceKey: string;
  label: string;
  kind: PersistentChangeKind;
  changedFields: string[];
  before?: unknown;
  after?: unknown;
  evidenceCount: number;
}

export interface ResourcePreferenceRecord {
  resourceKey: string;
  preference: ResourcePreference;
  updatedAt: string;
}

export interface AlertCandidate {
  eventId: string;
  ruleId: "new-network-port" | "watched-resource-change";
  resourceKey: string;
}

export interface HistorySettings {
  retentionDays: number;
  alertsEnabled: boolean;
}

export interface HistoryState {
  storageVersion: typeof HISTORY_STORAGE_VERSION;
  events: ChangeEvent[];
  preferences: ResourcePreferenceRecord[];
  settings: HistorySettings;
  pendingAlerts: AlertCandidate[];
}

export interface HistoryUpdate {
  resourceKey?: string;
  preference?: ResourcePreference;
  retentionDays?: number;
  alertsEnabled?: boolean;
}

export function emptyHistoryState(): HistoryState {
  return {
    storageVersion: HISTORY_STORAGE_VERSION,
    events: [],
    preferences: [],
    settings: {
      retentionDays: 30,
      alertsEnabled: true,
    },
    pendingAlerts: [],
  };
}
