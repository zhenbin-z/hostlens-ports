import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import type { HostObservationSnapshot } from "../../shared/history.ts";
import { HistoryStore } from "./history-store.ts";

const directories: string[] = [];

function emptySnapshot(observedAt: string): HostObservationSnapshot {
  return {
    schemaVersion: 1,
    observedAt,
    ports: {
      scannedAt: observedAt,
      platform: "darwin",
      listeners: [],
      warnings: [],
    },
    services: {
      scannedAt: observedAt,
      platform: "darwin",
      services: [],
      warnings: [],
    },
    network: {
      scannedAt: observedAt,
      platform: "darwin",
      interfaces: [],
      routes: [],
      dnsResolvers: [],
      vpnConnections: [],
      socketRelations: [],
      summary: { dnsServers: [], vpnActive: false },
      warnings: [],
    },
    runtimes: {
      scannedAt: observedAt,
      platform: "darwin",
      runtimes: [],
      packages: [],
      relationships: [],
      warnings: [],
    },
  };
}

function createStore(): { path: string; store: HistoryStore } {
  const directory = mkdtempSync(join(tmpdir(), "hostlens-history-"));
  directories.push(directory);
  const path = join(directory, "history.sqlite");
  return { path, store: new HistoryStore(path) };
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("HistoryStore", () => {
  it("migrates, persists settings, and reopens the same database", () => {
    const { path, store } = createStore();
    store.update({ retentionDays: 14, alertsEnabled: false });
    store.close();

    const reopened = new HistoryStore(path);
    assert.deepEqual(reopened.readState().settings, {
      retentionDays: 14,
      alertsEnabled: false,
    });
    reopened.close();
  });

  it("uses the first observation as baseline and persists later changes", () => {
    const { store } = createStore();
    const first = emptySnapshot("2026-07-29T05:00:00.000Z");
    assert.equal(store.record(first).events.length, 0);

    const second = emptySnapshot("2026-07-29T05:01:00.000Z");
    second.network.summary.dnsServers = ["1.1.1.1"];
    const state = store.record(second);
    assert.equal(state.events.length, 1);
    assert.equal(state.events[0]?.resourceKind, "network");
    store.close();
  });

  it("stores watched and ignored resource preferences", () => {
    const { store } = createStore();
    store.update({
      resourceKey: "service:postgres",
      preference: "watched",
    });
    assert.equal(store.readState().preferences[0]?.preference, "watched");
    store.update({
      resourceKey: "service:postgres",
      preference: "default",
    });
    assert.equal(store.readState().preferences.length, 0);
    store.close();
  });

  it("clears historical observations without deleting settings", () => {
    const { store } = createStore();
    store.update({ retentionDays: 7 });
    store.record(emptySnapshot("2026-07-29T05:00:00.000Z"));
    const changed = emptySnapshot("2026-07-29T05:01:00.000Z");
    changed.network.summary.vpnActive = true;
    store.record(changed);
    assert.equal(store.readState().events.length, 1);
    const cleared = store.clearHistory();
    assert.equal(cleared.events.length, 0);
    assert.equal(cleared.settings.retentionDays, 7);
    store.close();
  });
});
