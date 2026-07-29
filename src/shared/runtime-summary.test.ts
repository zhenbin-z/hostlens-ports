import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  GlobalPackage,
  RuntimeInstallation,
  RuntimeSnapshot,
} from "./runtimes.ts";
import { createRuntimePackageSummary } from "./runtime-summary.ts";

const runtime: RuntimeInstallation = {
  id: "runtime:node:/Users/alice/.nvm/versions/node/v22/bin/node",
  kind: "node",
  version: "22.22.2",
  executable: "/Users/alice/.nvm/versions/node/v22/bin/node",
  source: "nvm",
  environmentPath: "/Users/alice/.nvm/versions/node/v22",
  observationStatus: "complete",
  unavailableFields: [],
  confidence: "high",
  evidence: [],
};
const pkg: GlobalPackage = {
  id: "package:npm:test",
  name: "test-package",
  version: "1.2.3",
  manager: "npm",
  managerExecutable: "/Users/alice/.nvm/versions/node/v22/bin/npm",
  runtimeId: runtime.id,
  installPath: "/Users/alice/.nvm/versions/node/v22/lib/node_modules/test-package",
  environmentPath: "/Users/alice/.nvm/versions/node/v22/lib",
  executables: ["test-package"],
  observationStatus: "complete",
  unavailableFields: [],
  confidence: "high",
  evidence: [
    {
      kind: "observed",
      source: "npm package inventory",
      detail: "npm reported test-package@1.2.3",
      collectedAt: "2026-07-29T04:00:00Z",
      confidence: "high",
      fields: ["packageName"],
    },
  ],
};
const snapshot: RuntimeSnapshot = {
  scannedAt: "2026-07-29T04:00:00Z",
  platform: "darwin",
  runtimes: [runtime],
  packages: [pkg],
  relationships: [],
  warnings: [],
};

describe("runtime package summaries", () => {
  it("includes the selected package, runtime, and evidence", () => {
    const summary = createRuntimePackageSummary(pkg, runtime, snapshot);
    assert.match(summary, /test-package/);
    assert.match(summary, /node 22\.22\.2/);
    assert.match(summary, /npm package inventory/);
  });

  it("sanitizes home-directory paths", () => {
    const summary = createRuntimePackageSummary(pkg, runtime, snapshot, {
      sanitized: true,
    });
    assert.doesNotMatch(summary, /\/Users\/alice/);
    assert.match(summary, /~\/\.nvm/);
  });
});
