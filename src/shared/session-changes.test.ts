import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PortListener, PortSnapshot } from "./ports.ts";
import { compareSnapshots } from "./session-changes.ts";

function listener(
  port: number,
  overrides: Partial<PortListener> = {},
): PortListener {
  return {
    id: `tcp-127.0.0.1-${port}-100`,
    protocol: "tcp",
    address: "127.0.0.1",
    port,
    pid: 100,
    processName: "node",
    portType: "service",
    parentChain: [],
    observationStatus: "complete",
    unavailableFields: [],
    evidence: [],
    identity: {
      displayName: "Vite · sample",
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
    ...overrides,
  };
}

function snapshot(
  scannedAt: string,
  listeners: PortListener[],
): PortSnapshot {
  return { scannedAt, platform: "darwin", listeners, warnings: [] };
}

describe("compareSnapshots", () => {
  it("returns no changes for identical host state despite new scan times", () => {
    const value = listener(5173);
    assert.deepEqual(
      compareSnapshots(
        snapshot("2026-07-27T01:00:00Z", [value]),
        snapshot("2026-07-27T01:00:05Z", [
          {
            ...value,
            evidence: [
              {
                source: "new scan",
                collectedAt: "2026-07-27T01:00:05Z",
                confidence: "high",
                fields: ["socket"],
              },
            ],
          },
        ]),
      ),
      [],
    );
  });

  it("detects new, changed, and closed listeners deterministically", () => {
    const before = snapshot("2026-07-27T01:00:00Z", [
      listener(3000),
      listener(4000),
    ]);
    const after = snapshot("2026-07-27T01:00:05Z", [
      listener(3000, {
        pid: 200,
        id: "tcp-127.0.0.1-3000-200",
        command: "next dev",
      }),
      listener(5000),
    ]);

    const changes = compareSnapshots(
      before,
      after,
      "2026-07-27T01:00:05Z",
    );
    assert.deepEqual(
      changes.map(({ kind, socketKey, changedFields }) => ({
        kind,
        socketKey,
        changedFields,
      })),
      [
        {
          kind: "changed",
          socketKey: "tcp:127.0.0.1:3000",
          changedFields: ["pid", "command"],
        },
        {
          kind: "closed",
          socketKey: "tcp:127.0.0.1:4000",
          changedFields: [],
        },
        {
          kind: "new",
          socketKey: "tcp:127.0.0.1:5000",
          changedFields: [],
        },
      ],
    );
    assert.deepEqual(compareSnapshots(before, after), compareSnapshots(before, after));
  });
});
