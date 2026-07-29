import { DatabaseSync } from "node:sqlite";
import type {
  AlertCandidate,
  ChangeEvent,
  HistoryState,
  HistoryUpdate,
  HostObservationSnapshot,
  ResourcePreferenceRecord,
} from "../../shared/history.ts";
import {
  HISTORY_STORAGE_VERSION,
  emptyHistoryState,
} from "../../shared/history.ts";
import { compareHostObservations } from "../../shared/persistent-changes.ts";

const MAX_EVENTS = 1_000;
const MAX_SNAPSHOTS = 500;
const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_ALERTS_ENABLED = true;
const NEW_NETWORK_PORT_COOLDOWN_MS = 10 * 60 * 1_000;
const WATCHED_RESOURCE_COOLDOWN_MS = 5 * 60 * 1_000;

interface SnapshotRow {
  payload: string;
}

interface EventRow {
  id: string;
  detected_at: string;
  resource_kind: ChangeEvent["resourceKind"];
  resource_id: string;
  resource_key: string;
  label: string;
  change_kind: ChangeEvent["kind"];
  changed_fields: string;
  before_json: string | null;
  after_json: string | null;
  evidence_count: number;
}

interface PreferenceRow {
  resource_key: string;
  preference: ResourcePreferenceRecord["preference"];
  updated_at: string;
}

interface SettingRow {
  key: string;
  value: string;
}

interface AlertDeliveryRow {
  last_notified_at: string;
}

function parseEvent(row: EventRow): ChangeEvent {
  return {
    id: row.id,
    detectedAt: row.detected_at,
    resourceKind: row.resource_kind,
    resourceId: row.resource_id,
    resourceKey: row.resource_key,
    label: row.label,
    kind: row.change_kind,
    changedFields: JSON.parse(row.changed_fields) as string[],
    before: row.before_json ? JSON.parse(row.before_json) : undefined,
    after: row.after_json ? JSON.parse(row.after_json) : undefined,
    evidenceCount: row.evidence_count,
  };
}

function boundedRetentionDays(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_RETENTION_DAYS;
  return Math.min(365, Math.max(1, Math.round(value)));
}

export class HistoryStore {
  private readonly database: DatabaseSync;

  public constructor(path: string) {
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA journal_mode = WAL");
    this.database.exec("PRAGMA foreign_keys = ON");
    this.migrate();
  }

  public close(): void {
    this.database.close();
  }

  public record(snapshot: HostObservationSnapshot): HistoryState {
    const previous = this.latestSnapshot();
    const events = previous
      ? compareHostObservations(previous, snapshot)
      : [];

    this.database.exec("BEGIN IMMEDIATE");
    try {
      if (!previous || events.length > 0) {
        this.insertSnapshot(snapshot);
      }
      for (const event of events) this.insertEvent(event);
      this.prune();
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }

    const state = this.readState();
    state.pendingAlerts = this.evaluateAlerts(events, state);
    return state;
  }

  public readState(): HistoryState {
    const preferences = this.database
      .prepare(
        `SELECT resource_key, preference, updated_at
         FROM resource_preferences
         ORDER BY updated_at DESC`,
      )
      .all() as unknown as PreferenceRow[];
    const settings = this.readSettings();

    return {
      storageVersion: HISTORY_STORAGE_VERSION,
      events: this.listEvents(),
      preferences: preferences.map((row) => ({
        resourceKey: row.resource_key,
        preference: row.preference,
        updatedAt: row.updated_at,
      })),
      settings,
      pendingAlerts: [],
    };
  }

  public update(update: HistoryUpdate): HistoryState {
    if (update.resourceKey && update.preference) {
      if (update.preference === "default") {
        this.database
          .prepare("DELETE FROM resource_preferences WHERE resource_key = ?")
          .run(update.resourceKey);
      } else {
        this.database
          .prepare(
            `INSERT INTO resource_preferences
               (resource_key, preference, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(resource_key) DO UPDATE SET
               preference = excluded.preference,
               updated_at = excluded.updated_at`,
          )
          .run(
            update.resourceKey,
            update.preference,
            new Date().toISOString(),
          );
      }
    }

    if (update.retentionDays !== undefined) {
      this.writeSetting(
        "retentionDays",
        String(boundedRetentionDays(update.retentionDays)),
      );
      this.prune();
    }
    if (update.alertsEnabled !== undefined) {
      this.writeSetting("alertsEnabled", String(update.alertsEnabled));
    }
    return this.readState();
  }

  public clearHistory(): HistoryState {
    this.database.exec(`
      DELETE FROM change_events;
      DELETE FROM host_snapshots;
      DELETE FROM alert_deliveries;
    `);
    return this.readState();
  }

  private migrate(): void {
    const version = Number(
      (
        this.database.prepare("PRAGMA user_version").get() as {
          user_version?: number;
        }
      ).user_version ?? 0,
    );
    if (version > HISTORY_STORAGE_VERSION) {
      throw new Error(
        `History database version ${version} is newer than supported version ${HISTORY_STORAGE_VERSION}.`,
      );
    }
    if (version < 1) {
      this.database.exec(`
        CREATE TABLE IF NOT EXISTS host_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          observed_at TEXT NOT NULL,
          schema_version INTEGER NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS host_snapshots_observed_at
          ON host_snapshots(observed_at DESC);

        CREATE TABLE IF NOT EXISTS change_events (
          id TEXT PRIMARY KEY,
          detected_at TEXT NOT NULL,
          resource_kind TEXT NOT NULL,
          resource_id TEXT NOT NULL,
          resource_key TEXT NOT NULL,
          label TEXT NOT NULL,
          change_kind TEXT NOT NULL,
          changed_fields TEXT NOT NULL,
          before_json TEXT,
          after_json TEXT,
          evidence_count INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS change_events_detected_at
          ON change_events(detected_at DESC);
        CREATE INDEX IF NOT EXISTS change_events_resource_key
          ON change_events(resource_key, detected_at DESC);

        CREATE TABLE IF NOT EXISTS resource_preferences (
          resource_key TEXT PRIMARY KEY,
          preference TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS history_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS alert_deliveries (
          rule_id TEXT NOT NULL,
          resource_key TEXT NOT NULL,
          last_notified_at TEXT NOT NULL,
          PRIMARY KEY(rule_id, resource_key)
        );

        PRAGMA user_version = 1;
      `);
    }
    if (version < 2) {
      this.database.exec(`
        DELETE FROM change_events;
        DELETE FROM host_snapshots;
        DELETE FROM alert_deliveries;
        PRAGMA user_version = 2;
      `);
    }
  }

  private latestSnapshot(): HostObservationSnapshot | undefined {
    const row = this.database
      .prepare(
        `SELECT payload FROM host_snapshots
         ORDER BY id DESC LIMIT 1`,
      )
      .get() as SnapshotRow | undefined;
    return row
      ? (JSON.parse(row.payload) as HostObservationSnapshot)
      : undefined;
  }

  private insertSnapshot(snapshot: HostObservationSnapshot): void {
    this.database
      .prepare(
        `INSERT INTO host_snapshots(observed_at, schema_version, payload)
         VALUES (?, ?, ?)`,
      )
      .run(
        snapshot.observedAt,
        snapshot.schemaVersion,
        JSON.stringify(snapshot),
      );
  }

  private insertEvent(event: ChangeEvent): void {
    this.database
      .prepare(
        `INSERT OR IGNORE INTO change_events(
           id, detected_at, resource_kind, resource_id, resource_key, label,
           change_kind, changed_fields, before_json, after_json, evidence_count
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        event.detectedAt,
        event.resourceKind,
        event.resourceId,
        event.resourceKey,
        event.label,
        event.kind,
        JSON.stringify(event.changedFields),
        event.before === undefined ? null : JSON.stringify(event.before),
        event.after === undefined ? null : JSON.stringify(event.after),
        event.evidenceCount,
      );
  }

  private listEvents(): ChangeEvent[] {
    return (
      this.database
        .prepare(
          `SELECT * FROM change_events
           ORDER BY detected_at DESC, id DESC
           LIMIT ?`,
        )
        .all(MAX_EVENTS) as unknown as EventRow[]
    ).map(parseEvent);
  }

  private readSettings(): HistoryState["settings"] {
    const rows = this.database
      .prepare("SELECT key, value FROM history_settings")
      .all() as unknown as SettingRow[];
    const settings = new Map(rows.map((row) => [row.key, row.value]));
    return {
      retentionDays: boundedRetentionDays(
        Number(settings.get("retentionDays") ?? DEFAULT_RETENTION_DAYS),
      ),
      alertsEnabled:
        (settings.get("alertsEnabled") ?? String(DEFAULT_ALERTS_ENABLED)) ===
        "true",
    };
  }

  private writeSetting(key: string, value: string): void {
    this.database
      .prepare(
        `INSERT INTO history_settings(key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(key, value);
  }

  private prune(): void {
    const retentionDays = this.readSettings().retentionDays;
    const cutoff = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1_000,
    ).toISOString();
    this.database
      .prepare("DELETE FROM change_events WHERE detected_at < ?")
      .run(cutoff);
    this.database
      .prepare("DELETE FROM host_snapshots WHERE observed_at < ?")
      .run(cutoff);
    this.database.exec(`
      DELETE FROM change_events
      WHERE id NOT IN (
        SELECT id FROM change_events
        ORDER BY detected_at DESC, id DESC
        LIMIT ${MAX_EVENTS}
      );
      DELETE FROM host_snapshots
      WHERE id NOT IN (
        SELECT id FROM host_snapshots
        ORDER BY id DESC
        LIMIT ${MAX_SNAPSHOTS}
      );
    `);
  }

  private evaluateAlerts(
    events: ChangeEvent[],
    state: HistoryState,
  ): AlertCandidate[] {
    if (!state.settings.alertsEnabled) return [];
    const preferences = new Map(
      state.preferences.map((item) => [item.resourceKey, item.preference]),
    );
    const candidates: AlertCandidate[] = [];

    for (const event of events) {
      const preference = preferences.get(event.resourceKey) ?? "default";
      if (preference === "ignored") continue;

      if (preference === "watched") {
        if (
          this.shouldDeliver(
            "watched-resource-change",
            event.resourceKey,
            event.detectedAt,
            WATCHED_RESOURCE_COOLDOWN_MS,
          )
        ) {
          candidates.push({
            eventId: event.id,
            ruleId: "watched-resource-change",
            resourceKey: event.resourceKey,
          });
        }
        continue;
      }

      const after = event.after as { exposure?: unknown } | undefined;
      if (
        event.resourceKind === "port" &&
        event.kind === "added" &&
        after?.exposure === "network" &&
        this.shouldDeliver(
          "new-network-port",
          event.resourceKey,
          event.detectedAt,
          NEW_NETWORK_PORT_COOLDOWN_MS,
        )
      ) {
        candidates.push({
          eventId: event.id,
          ruleId: "new-network-port",
          resourceKey: event.resourceKey,
        });
      }
    }
    return candidates;
  }

  private shouldDeliver(
    ruleId: AlertCandidate["ruleId"],
    key: string,
    detectedAt: string,
    cooldownMs: number,
  ): boolean {
    const previous = this.database
      .prepare(
        `SELECT last_notified_at FROM alert_deliveries
         WHERE rule_id = ? AND resource_key = ?`,
      )
      .get(ruleId, key) as AlertDeliveryRow | undefined;
    if (
      previous &&
      Date.parse(detectedAt) - Date.parse(previous.last_notified_at) <
        cooldownMs
    ) {
      return false;
    }
    this.database
      .prepare(
        `INSERT INTO alert_deliveries(rule_id, resource_key, last_notified_at)
         VALUES (?, ?, ?)
         ON CONFLICT(rule_id, resource_key) DO UPDATE SET
           last_notified_at = excluded.last_notified_at`,
      )
      .run(ruleId, key, detectedAt);
    return true;
  }
}
