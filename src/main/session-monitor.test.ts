import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PortListener, PortSnapshot } from "../shared/ports.ts";
import type {
  ServiceScanner,
  ServiceSnapshot,
} from "../shared/services.ts";
import type { PortScanner } from "./scanners/port-scanner.ts";
import type {
  NetworkScanner,
  NetworkSnapshot,
} from "../shared/network.ts";
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

class FixtureServiceScanner implements ServiceScanner {
  public async scan(_listeners: PortListener[]): Promise<ServiceSnapshot> {
    return {
      scannedAt: "2026-07-27T01:00:00Z",
      platform: "darwin",
      services: [],
      warnings: [],
    };
  }
}

class FailingServiceScanner implements ServiceScanner {
  public async scan(_listeners: PortListener[]): Promise<ServiceSnapshot> {
    throw new Error("launchctl unavailable");
  }
}

class FixtureNetworkScanner implements NetworkScanner {
  public async scan(_listeners: PortListener[]): Promise<NetworkSnapshot> {
    return {
      scannedAt: "2026-07-27T01:00:00Z",
      platform: "darwin",
      interfaces: [],
      routes: [],
      dnsResolvers: [],
      vpnConnections: [],
      socketRelations: [],
      summary: {
        dnsServers: [],
        vpnActive: false,
      },
      warnings: [],
    };
  }
}

class FailingNetworkScanner implements NetworkScanner {
  public async scan(_listeners: PortListener[]): Promise<NetworkSnapshot> {
    throw new Error("ifconfig unavailable");
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
    const monitor = new SessionMonitor(
      new FixtureScanner([first, second]),
      new FixtureServiceScanner(),
      new FixtureNetworkScanner(),
      0,
    );

    const baseline = await monitor.scan();
    assert.deepEqual(baseline.changes.events, []);

    const changed = await monitor.scan();
    assert.deepEqual(
      changed.changes.events.map((event) => event.kind),
      ["closed", "new"],
    );
  });

  it("keeps port observations when optional service inspection fails", async () => {
    const snapshot = {
      scannedAt: "2026-07-27T01:00:00Z",
      platform: "darwin",
      listeners: [listener(3000)],
      warnings: [],
    };
    const monitor = new SessionMonitor(
      new FixtureScanner([snapshot]),
      new FailingServiceScanner(),
      new FixtureNetworkScanner(),
      0,
    );

    const state = await monitor.scan();

    assert.equal(state.snapshot.listeners.length, 1);
    assert.deepEqual(state.services.services, []);
    assert.match(state.services.warnings[0] ?? "", /launchctl unavailable/);
  });

  it("keeps port and service observations when network inspection fails", async () => {
    const snapshot = {
      scannedAt: "2026-07-27T01:00:00Z",
      platform: "darwin",
      listeners: [listener(3000)],
      warnings: [],
    };
    const monitor = new SessionMonitor(
      new FixtureScanner([snapshot]),
      new FixtureServiceScanner(),
      new FailingNetworkScanner(),
      0,
    );

    const state = await monitor.scan();

    assert.equal(state.snapshot.listeners.length, 1);
    assert.deepEqual(state.network.interfaces, []);
    assert.match(state.network.warnings[0] ?? "", /ifconfig unavailable/);
  });
});
