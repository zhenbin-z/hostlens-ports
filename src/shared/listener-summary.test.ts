import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PortListener, PortSnapshot } from "./ports.ts";
import {
  createListenerSummary,
  sanitizeHostText,
} from "./listener-summary.ts";

function fixture(): { listener: PortListener; snapshot: PortSnapshot } {
  const listener: PortListener = {
    id: "tcp-127.0.0.1-5173-100",
    protocol: "tcp",
    address: "127.0.0.1",
    port: 5173,
    pid: 100,
    processName: "node",
    user: "private-user",
    command:
      "/Users/private-user/Developer/secret-app/node_modules/.bin/vite --api-key super-secret --token=another-secret PASSWORD=third-secret",
    executable: "/Users/private-user/.nvm/versions/node/v22/bin/node",
    workingDirectory: "/Users/private-user/Developer/secret-app",
    portType: "service",
    parentChain: [],
    observationStatus: "complete",
    unavailableFields: [],
    evidence: [],
    identity: {
      displayName: "Vite · secret-app",
      kind: "development",
      confidence: "high",
      project: {
        name: "secret-app",
        path: "/Users/private-user/Developer/secret-app",
        tool: "Vite",
      },
      evidence: [
        {
          kind: "inferred",
          source: "Fixture",
          detail: "Matched /Users/private-user/Developer/secret-app",
          confidence: "high",
        },
      ],
    },
    launchSource: {
      kind: "package-script",
      label: "yarn dev",
      automatic: "no",
      confidence: "high",
      evidence: [
        {
          kind: "observed",
          source: "Fixture",
          detail: "yarn dev --token raw-token",
          confidence: "high",
        },
      ],
    },
    exposure: "local",
  };
  return {
    listener,
    snapshot: {
      scannedAt: "2026-07-27T01:00:00Z",
      platform: "darwin",
      listeners: [listener],
      warnings: [],
    },
  };
}

describe("sanitizeHostText", () => {
  it("removes home prefixes and common secret-bearing arguments", () => {
    const value = sanitizeHostText(
      "/Users/alice/project --password value --api-key=secret TOKEN=token postgres://user:pass@localhost/db",
    );
    assert.equal(
      value,
      "~/project --password <redacted> --api-key=<redacted> TOKEN=<redacted> postgres://<redacted>@localhost/db",
    );
    assert.doesNotMatch(value, /alice|value|secret|token|user:pass/);
  });
});

describe("createListenerSummary", () => {
  it("includes point-in-time identity, source, confidence, and evidence", () => {
    const { listener, snapshot } = fixture();
    const value = createListenerSummary(listener, snapshot);
    assert.match(value, /Current-state observation/);
    assert.match(value, /Vite · secret-app/);
    assert.match(value, /Launch source: yarn dev/);
    assert.match(value, /Identity confidence: high/);
    assert.match(value, /Evidence:/);
    assert.match(value, /not a security certification/i);
  });

  it("does not leak private home prefixes or command secrets when sanitized", () => {
    const { listener, snapshot } = fixture();
    const value = createListenerSummary(listener, snapshot, {
      sanitized: true,
    });
    assert.doesNotMatch(value, /\/Users\/private-user/);
    assert.doesNotMatch(value, /super-secret|another-secret|third-secret|raw-token/);
    assert.match(value, /~\/Developer\/secret-app/);
    assert.match(value, /<redacted>/);
  });
});
