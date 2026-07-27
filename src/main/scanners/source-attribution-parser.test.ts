import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseDockerPsJsonLines,
  parseLaunchctlList,
} from "./source-attribution-parser.ts";

describe("parseLaunchctlList", () => {
  it("keeps running jobs and labels for inactive jobs", () => {
    assert.deepEqual(
      parseLaunchctlList(
        [
          "PID\tStatus\tLabel",
          "412\t0\thomebrew.mxcl.postgresql@16",
          "-\t0\tcom.example.inactive",
        ].join("\n"),
      ),
      [
        { pid: 412, label: "homebrew.mxcl.postgresql@16" },
        { pid: undefined, label: "com.example.inactive" },
      ],
    );
  });
});

describe("parseDockerPsJsonLines", () => {
  it("extracts IPv4 and IPv6 published port bindings", () => {
    const output = [
      JSON.stringify({
        ID: "abc123",
        Image: "postgres:17",
        Names: "example-db",
        Ports: "127.0.0.1:5432->5432/tcp, [::]:8080->80/tcp, 80/tcp",
      }),
    ].join("\n");

    assert.deepEqual(parseDockerPsJsonLines(output), [
      {
        containerId: "abc123",
        containerName: "example-db",
        image: "postgres:17",
        hostAddress: "127.0.0.1",
        hostPort: 5432,
        containerPort: 5432,
        protocol: "tcp",
      },
      {
        containerId: "abc123",
        containerName: "example-db",
        image: "postgres:17",
        hostAddress: "::",
        hostPort: 8080,
        containerPort: 80,
        protocol: "tcp",
      },
    ]);
  });

  it("ignores malformed and unpublished entries", () => {
    assert.deepEqual(
      parseDockerPsJsonLines(
        ['not-json', JSON.stringify({ ID: "a", Ports: "80/tcp" })].join("\n"),
      ),
      [],
    );
  });
});
