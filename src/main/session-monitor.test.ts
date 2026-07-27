import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PortListener, PortSnapshot } from "../shared/ports.ts";
import type { PortScanner } from "./scanners/port-scanner.ts";
import { SessionMonitor } from "./session-monitor.ts";

function listener(port: number): PortListener {
  return {
    id: `tcp-127.0.0.1-${port}-${port}`,
    protocol: "tcp",
    address: "127.0.0.1",
    port,
    pid: port,
    processName: "test",
    portType: "service",
    parentChain: [],
    observationStatus: "complete",
    unavailableFields: [],
    evidence: [],
    identity: {
      displayName: "Test",
      kind: "service",
      confidence: "high",
      evidence: [],
    },
    launchSource: {
      kind: "manual",
      label: "Manual",
      automatic: "no",
      confidence: "medium",
      evidence: [],
    },
    exposure: "local",
  };
}

class FixtureScanner implements PortScanner {
  private index = 0;
  private readonly fixtures: PortSnapshot[];

  public constructor(fixtures: PortSnapshot[]) {
    this.fixtures = fixtures;
  }

  public async scan(): Promise<PortSnapshot> {
    const value = this.fixtures[Math.min(this.index, this.fixtures.length - 1)];
    this.index += 1;
    assert.ok(value);
    return value;
  }
}

describe("SessionMonitor", () => {
  it("uses the first scan as baseline and accumulates later changes in memory", async () => {
    const first = {
      scannedAt: "2026-07-27T01:00:00Z",
      platform: "darwin",
      listeners: [listener(3000)],
      warnings: [],
    };
    const second = {
      scannedAt: "2026-07-27T01:00:05Z",
      platform: "darwin",
      listeners: [listener(4000)],
      warnings: [],
    };
    const monitor = new SessionMonitor(new FixtureScanner([first, second]), 0);

    const baseline = await monitor.scan();
    assert.deepEqual(baseline.changes.events, []);

    const changed = await monitor.scan();
    assert.deepEqual(
      changed.changes.events.map((event) => event.kind),
      ["closed", "new"],
    );
  });
});
