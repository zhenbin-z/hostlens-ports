import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { HistoryStore } from "../src/main/history/history-store.ts";
import type { HostObservationSnapshot } from "../src/shared/history.ts";
import type { PortListener } from "../src/shared/ports.ts";

const changeCount = Number.parseInt(process.argv[2] ?? "250", 10);
if (!Number.isInteger(changeCount) || changeCount < 10) {
  throw new Error("Change count must be an integer of at least 10.");
}

function snapshot(index: number): HostObservationSnapshot {
  const observedAt = new Date(Date.UTC(2026, 6, 29, 0, 0, index)).toISOString();
  const listener: PortListener = {
    id: `tcp:127.0.0.1:${20_000 + index}:100`,
    protocol: "tcp",
    address: "127.0.0.1",
    port: 20_000 + index,
    pid: 100,
    processName: "benchmark-server",
    portType: "service",
    parentChain: [],
    observationStatus: "complete",
    unavailableFields: [],
    evidence: [],
    identity: {
      displayName: "Benchmark server",
      kind: "development",
      confidence: "high",
      evidence: [],
    },
    launchSource: {
      kind: "manual",
      label: "Benchmark",
      automatic: "no",
      confidence: "high",
      evidence: [],
    },
    exposure: "local",
  };
  return {
    schemaVersion: 1,
    observedAt,
    ports: {
      scannedAt: observedAt,
      platform: process.platform,
      listeners: [listener],
      warnings: [],
    },
    services: {
      scannedAt: observedAt,
      platform: process.platform,
      services: [],
      warnings: [],
    },
    network: {
      scannedAt: observedAt,
      platform: process.platform,
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
      platform: process.platform,
      runtimes: [],
      packages: [],
      relationships: [],
      warnings: [],
    },
  };
}

function percentile(values: number[], value: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil((value / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

const rounded = (value: number): number => Math.round(value * 100) / 100;
const directory = mkdtempSync(join(tmpdir(), "hostlens-history-benchmark-"));
const store = new HistoryStore(join(directory, "history.sqlite"));
const recordDurations: number[] = [];

try {
  store.record(snapshot(0));
  for (let index = 1; index <= changeCount; index += 1) {
    const startedAt = performance.now();
    store.record(snapshot(index));
    recordDurations.push(performance.now() - startedAt);
  }

  const readStartedAt = performance.now();
  const state = store.readState();
  const readDuration = performance.now() - readStartedAt;
  const p95 = percentile(recordDurations, 95);
  const maximum = Math.max(...recordDurations);
  const databaseReadTargetMs = 25;
  const recordP95TargetMs = 25;

  console.log(
    JSON.stringify(
      {
        platform: process.platform,
        architecture: process.arch,
        node: process.version,
        generatedChanges: changeCount,
        storedEvents: state.events.length,
        durationMs: {
          recordMedian: rounded(percentile(recordDurations, 50)),
          recordP95: rounded(p95),
          recordMaximum: rounded(maximum),
          readTimeline: rounded(readDuration),
        },
        targets: {
          recordP95UnderMs: recordP95TargetMs,
          readTimelineUnderMs: databaseReadTargetMs,
          allEventsStored: true,
        },
        passed:
          p95 < recordP95TargetMs &&
          readDuration < databaseReadTargetMs &&
          state.events.length === changeCount * 2,
      },
      null,
      2,
    ),
  );
} finally {
  store.close();
  rmSync(directory, { recursive: true, force: true });
}
