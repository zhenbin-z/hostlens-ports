import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { HostObservationSnapshot } from "./history.ts";
import { compareHostObservations } from "./persistent-changes.ts";

function snapshot(
  overrides: {
    port?: number;
    serviceStatus?: "running" | "stopped";
    packageVersion?: string;
    dns?: string;
  } = {},
): HostObservationSnapshot {
  const observedAt = "2026-07-29T05:00:00.000Z";
  return {
    schemaVersion: 1,
    observedAt,
    ports: {
      scannedAt: observedAt,
      platform: "darwin",
      warnings: [],
      listeners: [
        {
          id: "listener",
          protocol: "tcp",
          address: "127.0.0.1",
          port: overrides.port ?? 3000,
          processName: "node",
          portType: "service",
          parentChain: [],
          observationStatus: "complete",
          unavailableFields: [],
          evidence: [
            {
              source: "fixture",
              collectedAt: observedAt,
              confidence: "high",
              fields: ["socket"],
            },
          ],
          identity: {
            displayName: "Vite",
            kind: "development",
            confidence: "high",
            evidence: [],
          },
          launchSource: {
            kind: "package-script",
            label: "yarn dev",
            automatic: "no",
            confidence: "high",
            evidence: [],
          },
          exposure: "local",
        },
      ],
    },
    services: {
      scannedAt: observedAt,
      platform: "darwin",
      warnings: [],
      services: [
        {
          id: "service:postgres",
          label: "postgres",
          displayName: "PostgreSQL",
          manager: "homebrew",
          kind: "user-agent",
          scope: "user",
          ownership: "third-party",
          status: overrides.serviceStatus ?? "running",
          startup: "automatic",
          arguments: [],
          relatedProcessIds: [],
          relatedProcesses: [],
          relatedListenerIds: [],
          observationStatus: "complete",
          unavailableFields: [],
          confidence: "high",
          evidence: [],
        },
      ],
    },
    network: {
      scannedAt: observedAt,
      platform: "darwin",
      interfaces: [],
      routes: [],
      dnsResolvers: [
        {
          id: "dns",
          nameservers: [overrides.dns ?? "1.1.1.1"],
          searchDomains: [],
          confidence: "high",
          evidence: [],
        },
      ],
      vpnConnections: [],
      socketRelations: [],
      summary: {
        dnsServers: [overrides.dns ?? "1.1.1.1"],
        vpnActive: false,
      },
      warnings: [],
    },
    runtimes: {
      scannedAt: observedAt,
      platform: "darwin",
      runtimes: [],
      packages: [
        {
          id: "package:npm:vite",
          name: "vite",
          version: overrides.packageVersion ?? "7.0.0",
          manager: "npm",
          managerExecutable: "/usr/local/bin/npm",
          executables: ["vite"],
          observationStatus: "complete",
          unavailableFields: [],
          confidence: "high",
          evidence: [],
        },
      ],
      relationships: [],
      warnings: [],
    },
  };
}

describe("persistent host changes", () => {
  it("ignores timestamps and evidence collection details", () => {
    const before = snapshot();
    const after = structuredClone(before);
    after.observedAt = "2026-07-29T05:01:00.000Z";
    after.ports.scannedAt = after.observedAt;
    after.ports.listeners[0]!.evidence[0]!.collectedAt = after.observedAt;
    assert.deepEqual(compareHostObservations(before, after), []);
  });

  it("creates typed changes across services, network, and packages", () => {
    const events = compareHostObservations(
      snapshot(),
      snapshot({
        serviceStatus: "stopped",
        packageVersion: "7.1.0",
        dns: "9.9.9.9",
      }),
    );
    assert.deepEqual(
      events.map(({ resourceKind }) => resourceKind),
      ["network", "package", "service"],
    );
    assert.ok(events.every(({ kind }) => kind === "changed"));
  });

  it("uses socket identity for added and removed ports", () => {
    const events = compareHostObservations(
      snapshot({ port: 3000 }),
      snapshot({ port: 5190 }),
    );
    assert.deepEqual(
      events.map(({ kind }) => kind),
      ["removed", "added"],
    );
    assert.ok(events.every(({ resourceKind }) => resourceKind === "port"));
  });
});
