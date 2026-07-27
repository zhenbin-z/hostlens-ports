import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PortListener } from "../../shared/ports";
import { classifyPortType, identifyProcess } from "./process-identity.ts";

function listener(overrides: Partial<PortListener>): PortListener {
  return {
    id: "test",
    protocol: "tcp",
    address: "127.0.0.1",
    port: 3000,
    processName: "unknown",
    exposure: "local",
    portType: "service",
    ...overrides,
  };
}

describe("classifyPortType", () => {
  it("uses IANA-aligned port number ranges", () => {
    assert.equal(classifyPortType(443), "system");
    assert.equal(classifyPortType(3_000), "service");
    assert.equal(classifyPortType(49_151), "service");
    assert.equal(classifyPortType(49_152), "dynamic");
    assert.equal(classifyPortType(65_535), "dynamic");
  });
});

describe("identifyProcess", () => {
  it("names a Node development tool with its project", () => {
    assert.deepEqual(
      identifyProcess(
        listener({
          processName: "node",
          command:
            "/opt/homebrew/bin/node /Users/zhenbin/Developer/hostlens-ports/node_modules/.bin/vite",
        }),
      ),
      {
        displayName: "Vite · hostlens-ports",
        ownerType: "development",
        projectName: "hostlens-ports",
      },
    );
  });

  it("uses the outer desktop application name for helper processes", () => {
    assert.deepEqual(
      identifyProcess(
        listener({
          processName: "Code Helper",
          command:
            "/Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper.app/Contents/MacOS/Code Helper --type=utility",
        }),
      ),
      {
        displayName: "Visual Studio Code",
        ownerType: "application",
      },
    );
  });

  it("recognizes macOS-owned processes", () => {
    assert.deepEqual(
      identifyProcess(
        listener({
          processName: "ControlCenter",
          command:
            "/System/Library/CoreServices/ControlCenter.app/Contents/MacOS/ControlCenter",
        }),
      ),
      {
        displayName: "macOS Control Center",
        ownerType: "system",
      },
    );
  });
});

