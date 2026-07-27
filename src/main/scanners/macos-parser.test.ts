import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseLsofListeners, parsePsDetails } from "./macos-parser.ts";

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
