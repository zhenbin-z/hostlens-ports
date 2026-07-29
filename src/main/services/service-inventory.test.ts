import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ServiceDefinition } from "../../shared/services.ts";
import {
  friendlyServiceName,
  mergeHomebrewServiceObservations,
  ownershipFor,
} from "./macos-service-scanner.ts";

function launchdService(): ServiceDefinition {
  return {
    id: "service:homebrew.mxcl.postgresql@17",
    label: "homebrew.mxcl.postgresql@17",
    displayName: "postgres",
    manager: "launchd",
    kind: "user-agent",
    scope: "user",
    ownership: "third-party",
    status: "running",
    startup: "automatic",
    pid: 720,
    program: "/opt/homebrew/opt/postgresql@17/bin/postgres",
    arguments: [],
    plistPath:
      "/Users/developer/Library/LaunchAgents/homebrew.mxcl.postgresql@17.plist",
    relatedProcessIds: [],
    relatedProcesses: [],
    relatedListenerIds: [],
    observationStatus: "complete",
    unavailableFields: [],
    confidence: "high",
    evidence: [
      {
        kind: "observed",
        source: "launchctl list",
        detail: "Observed running launchd job",
        collectedAt: "2026-07-27T01:00:00Z",
        confidence: "high",
        fields: ["label", "status", "pid"],
      },
    ],
  };
}

describe("service inventory assembly", () => {
  it("separates transient app runtime jobs from persistent services", () => {
    const label =
      "application.com.openai.codex.49353719.49353725.01234567-89AB-CDEF-0123-456789ABCDEF";

    assert.equal(ownershipFor(label), "application");
    assert.equal(friendlyServiceName(label), "Codex");
    assert.equal(
      ownershipFor("application.com.apple.Safari.12345"),
      "apple",
    );
    assert.equal(ownershipFor("com.apple.WindowManager"), "apple");
    assert.equal(ownershipFor("com.example.background-agent"), "third-party");
  });

  it("merges Homebrew and launchd observations for the same service", () => {
    const existing = launchdService();
    const services = new Map([[existing.label, existing]]);

    mergeHomebrewServiceObservations(
      services,
      [
        {
          name: "postgresql@17",
          status: "started",
          file:
            "/Users/developer/Library/LaunchAgents/homebrew.mxcl.postgresql@17.plist",
          exitCode: 0,
        },
      ],
      "2026-07-27T01:00:00Z",
    );

    assert.equal(services.size, 1);
    const merged = services.get(existing.label);
    assert.ok(merged);
    assert.equal(merged.manager, "homebrew");
    assert.equal(merged.homebrewName, "postgresql@17");
    assert.equal(merged.pid, 720);
    assert.equal(merged.evidence.length, 2);
  });
});
