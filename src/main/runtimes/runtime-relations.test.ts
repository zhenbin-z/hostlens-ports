import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PortListener } from "../../shared/ports.ts";
import type { GlobalPackage } from "../../shared/runtimes.ts";
import type { ServiceDefinition } from "../../shared/services.ts";
import { relatePackagesToHost } from "./runtime-relations.ts";

const collectedAt = "2026-07-29T03:00:00.000Z";

function pkg(overrides: Partial<GlobalPackage> = {}): GlobalPackage {
  return {
    id: "package:npm:/opt/homebrew/bin/npm:vite",
    name: "vite",
    version: "7.0.0",
    manager: "npm",
    managerExecutable: "/opt/homebrew/bin/npm",
    installPath: "/opt/homebrew/lib/node_modules/vite",
    executables: ["vite"],
    observationStatus: "complete",
    unavailableFields: [],
    confidence: "high",
    evidence: [],
    ...overrides,
  };
}

function listener(overrides: Partial<PortListener> = {}): PortListener {
  return {
    id: "tcp-0.0.0.0-5173-100",
    protocol: "tcp",
    address: "0.0.0.0",
    port: 5173,
    pid: 100,
    processName: "node",
    command: "node /opt/homebrew/lib/node_modules/vite/bin/vite.js",
    portType: "dynamic",
    parentChain: [],
    observationStatus: "complete",
    unavailableFields: [],
    evidence: [],
    identity: {
      displayName: "Vite Development Server",
      kind: "development",
      confidence: "high",
      evidence: [],
    },
    launchSource: {
      kind: "package-script",
      label: "npm run dev",
      automatic: "no",
      confidence: "high",
      evidence: [],
    },
    exposure: "network",
    ...overrides,
  };
}

describe("runtime package relationships", () => {
  it("relates a package when its installation path appears in a listener command", () => {
    const relationships = relatePackagesToHost(
      [pkg()],
      [listener()],
      [],
      collectedAt,
    );

    assert.equal(relationships.length, 1);
    assert.equal(relationships[0]?.targetType, "listener");
    assert.equal(relationships[0]?.targetId, "tcp-0.0.0.0-5173-100");
  });

  it("does not infer a relationship from a package name alone", () => {
    const relationships = relatePackagesToHost(
      [pkg({ installPath: undefined, executables: [] })],
      [listener({ command: "node server.js" })],
      [],
      collectedAt,
    );

    assert.deepEqual(relationships, []);
  });

  it("relates package executables to configured services", () => {
    const service = {
      id: "service:dev.vite",
      label: "dev.vite",
      displayName: "Vite",
      manager: "launchd",
      kind: "user-agent",
      scope: "user",
      ownership: "third-party",
      status: "running",
      startup: "automatic",
      program: "/opt/homebrew/bin/vite",
      arguments: [],
      relatedProcessIds: [],
      relatedProcesses: [],
      relatedListenerIds: [],
      observationStatus: "complete",
      unavailableFields: [],
      confidence: "high",
      evidence: [],
    } satisfies ServiceDefinition;

    const relationships = relatePackagesToHost(
      [pkg()],
      [],
      [service],
      collectedAt,
    );

    assert.equal(relationships[0]?.targetType, "service");
  });
});
