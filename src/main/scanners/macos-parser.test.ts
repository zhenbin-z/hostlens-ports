import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildParentChain,
  parseLsofListeners,
  parseLsofWorkingDirectories,
  parsePsCommands,
  parsePsDetails,
  parsePsProcessTable,
} from "./macos-parser.ts";

describe("parseLsofListeners", () => {
  it("parses listeners, exposure, processes, and removes duplicate sockets", () => {
    const output = [
      "p100",
      "cnode",
      "u501",
      "f10",
      "n127.0.0.1:3000",
      "TST=LISTEN",
      "f11",
      "n127.0.0.1:3000",
      "TST=LISTEN",
      "f12",
      "n[::1]:3000",
      "TST=LISTEN",
      "p200",
      "cpostgres",
      "u502",
      "f20",
      "n*:5432",
      "TST=LISTEN",
      "p300",
      "u503",
      "f30",
      "n10.0.0.20:8080",
      "TST=LISTEN",
    ].join("\n");

    const listeners = parseLsofListeners(output);

    assert.equal(listeners.length, 4);
    assert.deepEqual(
      listeners.map(({ address, port, processName, exposure }) => ({
        address,
        port,
        processName,
        exposure,
      })),
      [
        {
          address: "127.0.0.1",
          port: 3000,
          processName: "node",
          exposure: "local",
        },
        {
          address: "::1",
          port: 3000,
          processName: "node",
          exposure: "local",
        },
        {
          address: "*",
          port: 5432,
          processName: "postgres",
          exposure: "network",
        },
        {
          address: "10.0.0.20",
          port: 8080,
          processName: "Unknown process",
          exposure: "network",
        },
      ],
    );
    const firstListener = listeners[0];
    assert.ok(firstListener);
    assert.equal(firstListener.observationStatus, "partial");
    assert.deepEqual(firstListener.parentChain, []);
    assert.deepEqual(firstListener.evidence, []);
    assert.deepEqual(firstListener.unavailableFields, [
      "parentPid",
      "command",
      "executable",
      "workingDirectory",
      "parentChain",
    ]);
  });

  it("ignores malformed endpoints and invalid ports", () => {
    const listeners = parseLsofListeners(
      ["p100", "cnode", "nnot-an-endpoint", "n*:99999"].join("\n"),
    );

    assert.deepEqual(listeners, []);
  });
});

describe("parsePsDetails", () => {
  it("keeps the full command after the fixed process fields", () => {
    assert.deepEqual(
      parsePsDetails(
        "  211 zhenbin /opt/homebrew/bin/node vite --host 0.0.0.0\n",
      ),
      {
        parentPid: 211,
        user: "zhenbin",
        command: "/opt/homebrew/bin/node vite --host 0.0.0.0",
      },
    );
  });

  it("returns an empty result for unavailable process data", () => {
    assert.deepEqual(parsePsDetails(""), {});
  });
});

describe("parsePsProcessTable", () => {
  it("keeps executable paths containing spaces", () => {
    assert.deepEqual(
      parsePsProcessTable(
        [
          "  100     1 root             /usr/libexec/example",
          "  200   100 zhenbin          /Applications/Example App.app/Contents/MacOS/Example App",
        ].join("\n"),
      ),
      [
        {
          pid: 100,
          parentPid: 1,
          user: "root",
          executable: "/usr/libexec/example",
        },
        {
          pid: 200,
          parentPid: 100,
          user: "zhenbin",
          executable:
            "/Applications/Example App.app/Contents/MacOS/Example App",
        },
      ],
    );
  });
});

describe("parsePsCommands", () => {
  it("maps full commands to their process IDs", () => {
    assert.deepEqual(
      [...parsePsCommands(
        [
          "  100 /usr/bin/example --flag one",
          "  200 /opt/homebrew/bin/node /project/node_modules/.bin/vite",
        ].join("\n"),
      )],
      [
        [100, "/usr/bin/example --flag one"],
        [200, "/opt/homebrew/bin/node /project/node_modules/.bin/vite"],
      ],
    );
  });
});

describe("parseLsofWorkingDirectories", () => {
  it("maps cwd fields without confusing other file descriptors", () => {
    assert.deepEqual(
      [...parseLsofWorkingDirectories(
        [
          "p100",
          "fcwd",
          "n/Users/example/Developer/app",
          "ftxt",
          "n/opt/homebrew/bin/node",
          "p200",
          "fcwd",
          "n/private/tmp",
        ].join("\n"),
      )],
      [
        [100, "/Users/example/Developer/app"],
        [200, "/private/tmp"],
      ],
    );
  });
});

describe("buildParentChain", () => {
  it("walks parent processes and stops before a cycle", () => {
    const table = new Map(
      parsePsProcessTable(
        [
          "  100   200 user /usr/bin/child",
          "  200   300 user /usr/bin/parent",
          "  300   200 root /sbin/grandparent",
        ].join("\n"),
      ).map((entry) => [entry.pid, entry] as const),
    );

    assert.deepEqual(buildParentChain(100, table), [
      {
        pid: 200,
        parentPid: 300,
        processName: "parent",
        executable: "/usr/bin/parent",
      },
      {
        pid: 300,
        parentPid: 200,
        processName: "grandparent",
        executable: "/sbin/grandparent",
      },
    ]);
  });
});
