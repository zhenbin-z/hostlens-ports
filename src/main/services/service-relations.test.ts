import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PortListener } from "../../shared/ports.ts";
import type { ServiceDefinition } from "../../shared/services.ts";
import {
  relateServicesToListeners,
  type ServiceProcessCandidate,
} from "./service-relations.ts";

function service(overrides: Partial<ServiceDefinition> = {}): ServiceDefinition {
  return {
    id: "service:com.example.server",
    label: "com.example.server",
    displayName: "Example Server",
    manager: "launchd",
    kind: "user-agent",
    scope: "user",
    ownership: "third-party",
    status: "running",
    startup: "automatic",
    pid: 100,
    arguments: [],
    relatedProcessIds: [],
    relatedProcesses: [],
    relatedListenerIds: [],
    observationStatus: "complete",
    unavailableFields: [],
    confidence: "high",
    evidence: [
      {
        kind: "observed",
        source: "fixture",
        detail: "Fixture service",
        collectedAt: "2026-07-27T01:00:00Z",
        confidence: "high",
        fields: ["label", "pid"],
      },
    ],
    ...overrides,
  };
}

function listener(
  id: string,
  pid: number,
  parentChain: PortListener["parentChain"] = [],
): PortListener {
  return {
    id,
    protocol: "tcp",
    address: "127.0.0.1",
    port: Number(id.replace(/\D/g, "")) || 3000,
    pid,
    processName: "server",
    portType: "service",
    parentChain,
    observationStatus: "complete",
    unavailableFields: [],
    evidence: [],
    identity: {
      displayName: "Example Server",
      kind: "service",
      confidence: "high",
      evidence: [],
    },
    launchSource: {
      kind: "launchd",
      label: "com.example.server",
      automatic: "yes",
      confidence: "high",
      evidence: [],
    },
    exposure: "local",
  };
}

describe("service relationships", () => {
  it("relates direct and descendant processes with multiple sockets", () => {
    const processes: ServiceProcessCandidate[] = [
      { pid: 100, parentPid: 1, processName: "launcher" },
      { pid: 101, parentPid: 100, processName: "worker" },
      { pid: 102, parentPid: 101, processName: "server" },
    ];
    const related = relateServicesToListeners(
      [service()],
      [
        listener("tcp-3000", 100),
        listener("tcp-3001", 102, [
          { pid: 101, parentPid: 100, processName: "worker" },
          { pid: 100, parentPid: 1, processName: "launcher" },
        ]),
      ],
      processes,
    )[0]!;

    assert.deepEqual(related.relatedProcessIds, [100, 101, 102]);
    assert.deepEqual(related.relatedListenerIds, ["tcp-3000", "tcp-3001"]);
    assert.equal(related.relatedProcesses[0]?.relationship, "direct");
    assert.equal(related.relatedProcesses[1]?.relationship, "descendant");
  });

  it("keeps configured stopped services without inventing relationships", () => {
    const stopped = relateServicesToListeners(
      [service({ status: "stopped", pid: undefined })],
      [],
      [],
    )[0]!;

    assert.equal(stopped.status, "stopped");
    assert.deepEqual(stopped.relatedProcessIds, []);
    assert.deepEqual(stopped.relatedListenerIds, []);
    assert.equal(stopped.evidence.length, 1);
  });

  it("can relate a socket from launch-source evidence without a service PID", () => {
    const related = relateServicesToListeners(
      [
        service({
          pid: undefined,
          label: "homebrew.mxcl.redis",
          homebrewName: "redis",
          manager: "homebrew",
        }),
      ],
      [
        {
          ...listener("tcp-6379", 500),
          launchSource: {
            kind: "homebrew",
            label: "Homebrew · redis",
            detail: "homebrew.mxcl.redis",
            automatic: "yes",
            confidence: "high",
            evidence: [],
          },
        },
      ],
      [],
    )[0]!;

    assert.deepEqual(related.relatedListenerIds, ["tcp-6379"]);
    assert.deepEqual(related.relatedProcessIds, [500]);
  });
});
