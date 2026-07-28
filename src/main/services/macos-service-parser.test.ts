import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveStartupBehavior,
  normalizeHomebrewStatus,
  normalizeLaunchdStatus,
  parseHomebrewServicesJson,
  parseLaunchctlDisabled,
  parseLaunchctlPrint,
  parseLaunchctlServiceList,
  parseLaunchdPlistJson,
  unreadableConfiguredPlist,
} from "./macos-service-parser.ts";

describe("macOS service parsers", () => {
  it("parses running, inactive, and failed launchctl jobs", () => {
    const jobs = parseLaunchctlServiceList(`
PID\tStatus\tLabel
221\t0\tcom.example.running
-\t0\tcom.example.loaded
-\t78\tcom.example.failed
malformed
`);

    assert.deepEqual(jobs, [
      { label: "com.example.failed", lastExitStatus: 78, pid: undefined },
      { label: "com.example.loaded", lastExitStatus: 0, pid: undefined },
      { label: "com.example.running", lastExitStatus: 0, pid: 221 },
    ]);
    assert.equal(normalizeLaunchdStatus(jobs[2], false, true), "running");
    assert.equal(normalizeLaunchdStatus(jobs[1], false, true), "loaded");
    assert.equal(normalizeLaunchdStatus(jobs[0], false, true), "failed");
  });

  it("parses disabled overrides and launchctl print evidence", () => {
    const disabled = parseLaunchctlDisabled(`
disabled services = {
  "com.example.enabled" => false
  "com.example.disabled" => true
}
`);
    const printed = parseLaunchctlPrint(
      `
com.example.daemon = {
  state = running
  pid = 912
  last exit code = 0
}
`,
      "com.example.daemon",
    );

    assert.equal(disabled.get("com.example.disabled"), true);
    assert.equal(disabled.get("com.example.enabled"), false);
    assert.deepEqual(printed, {
      label: "com.example.daemon",
      pid: 912,
      lastExitStatus: 0,
    });
    assert.equal(
      normalizeLaunchdStatus(printed, true, true),
      "disabled",
    );
  });

  it("parses launchd plist fields and falls back to the filename label", () => {
    const parsed = parseLaunchdPlistJson(
      JSON.stringify({
        ProgramArguments: ["/opt/example/bin/server", "--port", "8080"],
        RunAtLoad: true,
        KeepAlive: { SuccessfulExit: false },
      }),
      "/Library/LaunchDaemons/com.example.server.plist",
    );

    assert.deepEqual(parsed, {
      label: "com.example.server",
      program: "/opt/example/bin/server",
      arguments: ["/opt/example/bin/server", "--port", "8080"],
      runAtLoad: true,
      keepAlive: true,
      disabled: undefined,
    });
    assert.equal(parseLaunchdPlistJson("{", "/tmp/broken.plist"), null);
  });

  it("keeps a partial configured object when plist access is limited", () => {
    assert.deepEqual(
      unreadableConfiguredPlist(
        "/Library/LaunchDaemons/com.example.restricted.plist",
        "system-daemon",
        "system",
      ),
      {
        path: "/Library/LaunchDaemons/com.example.restricted.plist",
        kind: "system-daemon",
        scope: "system",
        parseError: true,
        record: {
          label: "com.example.restricted",
          arguments: [],
        },
      },
    );
  });

  it("parses Homebrew output defensively and normalizes statuses", () => {
    const records = parseHomebrewServicesJson(
      JSON.stringify([
        {
          name: "postgresql@17",
          status: "started",
          user: "developer",
          file: "/Users/developer/Library/LaunchAgents/homebrew.mxcl.postgresql@17.plist",
          exit_code: 0,
        },
        { Name: "redis", Status: "error", "Exit Code": "1" },
        { status: "started" },
        null,
      ]),
    );

    assert.equal(records.length, 2);
    assert.equal(records[0]?.name, "postgresql@17");
    assert.equal(normalizeHomebrewStatus(records[0]!), "running");
    assert.equal(normalizeHomebrewStatus(records[1]!), "failed");
    assert.deepEqual(parseHomebrewServicesJson("not-json"), []);
  });

  it("derives startup behavior from deterministic evidence", () => {
    assert.equal(
      deriveStartupBehavior({ disabled: true, runAtLoad: true }),
      "disabled",
    );
    assert.equal(
      deriveStartupBehavior({ disabled: false, keepAlive: true }),
      "automatic",
    );
    assert.equal(
      deriveStartupBehavior({ disabled: false, runAtLoad: false }),
      "on-demand",
    );
    assert.equal(deriveStartupBehavior({ disabled: false }), "unknown");
  });
});
