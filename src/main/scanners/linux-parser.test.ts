import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSsListeners } from "./linux-parser.ts";

describe("parseSsListeners", () => {
  it("parses Ubuntu and RHEL iproute2 listeners with and without process data", () => {
    const listeners = parseSsListeners(`
LISTEN 0 4096 127.0.0.1:5432 0.0.0.0:* users:(("postgres",pid=842,fd=7))
LISTEN 0 128 0.0.0.0:22 0.0.0.0:* users:(("sshd",pid=701,fd=3))
LISTEN 0 511 [::]:8080 [::]:*
`);
    assert.equal(listeners.length, 3);
    assert.deepEqual(
      listeners.map(({ port, processName, exposure }) => ({
        port,
        processName,
        exposure,
      })),
      [
        { port: 22, processName: "sshd", exposure: "network" },
        { port: 5432, processName: "postgres", exposure: "local" },
        { port: 8080, processName: "Unknown process", exposure: "network" },
      ],
    );
    assert.equal(listeners[0]?.pid, 701);
    assert.equal(listeners[2]?.pid, undefined);
    assert.ok(listeners[2]?.unavailableFields.includes("pid"));
  });

  it("ignores headers, malformed endpoints, and duplicate sockets", () => {
    const listeners = parseSsListeners(`
State Recv-Q Send-Q Local Address:Port Peer Address:Port Process
LISTEN 0 128 malformed 0.0.0.0:*
LISTEN 0 128 127.0.0.1:3000 0.0.0.0:* users:(("node",pid=10,fd=4))
LISTEN 0 128 127.0.0.1:3000 0.0.0.0:* users:(("node",pid=10,fd=5))
`);
    assert.equal(listeners.length, 1);
    assert.equal(listeners[0]?.port, 3000);
  });
});
