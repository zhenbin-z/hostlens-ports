import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RuntimeCommandRunner } from "./macos-runtime-scanner.ts";
import { LinuxRuntimeScanner } from "./linux-runtime-scanner.ts";
import { MacOsRuntimeScanner } from "./macos-runtime-scanner.ts";

const runner: RuntimeCommandRunner = {
  async run() {
    return { stdout: "" };
  },
};

describe("Unix runtime scanners", () => {
  it("labels macOS observations as darwin", async () => {
    const snapshot = await new MacOsRuntimeScanner(runner).scan([], []);
    assert.equal(snapshot.platform, "darwin");
  });

  it("labels Linux observations as linux", async () => {
    const snapshot = await new LinuxRuntimeScanner(runner).scan([], []);
    assert.equal(snapshot.platform, "linux");
  });
});
