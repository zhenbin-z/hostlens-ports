import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PortListener } from "../../shared/ports";
import {
  classifyPortType,
  createUnknownLaunchSource,
  createUnresolvedIdentity,
  resolveProcess,
  type AttributionContext,
} from "./process-identity.ts";

function listener(overrides: Partial<PortListener>): PortListener {
  const processName = overrides.processName ?? "unknown";
  return {
    id: "test",
    protocol: "tcp",
    address: "127.0.0.1",
    port: 3000,
    processName,
    exposure: "local",
    portType: "service",
    parentChain: [],
    observationStatus: "partial",
    unavailableFields: [],
    evidence: [],
    identity: createUnresolvedIdentity(processName),
    launchSource: createUnknownLaunchSource(),
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

describe("resolveProcess identity", () => {
  const developmentCases = [
    ["vite", "Vite"],
    ["next", "Next.js"],
    ["nuxt", "Nuxt"],
    ["webpack", "webpack"],
    ["react-scripts", "React Scripts"],
  ] as const;

  for (const [binary, expectedName] of developmentCases) {
    it(`identifies ${binary} and its project with evidence`, () => {
      const resolved = resolveProcess(
        listener({
          processName: "node",
          executable: "/Users/example/.nvm/versions/node/v22.22.2/bin/node",
          workingDirectory: "/Users/example/Developer/sample-app",
          command: `/Users/example/.nvm/versions/node/v22.22.2/bin/node /Users/example/Developer/sample-app/node_modules/.bin/${binary}`,
        }),
      );

      assert.equal(resolved.identity.displayName, `${expectedName} · sample-app`);
      assert.equal(resolved.identity.kind, "development");
      assert.equal(resolved.identity.project?.name, "sample-app");
      assert.equal(resolved.identity.project?.runtime, "Node.js v22.22.2");
      assert.equal(resolved.identity.confidence, "high");
      assert.ok(resolved.identity.evidence.length >= 2);
    });
  }

  it("uses the outer desktop application name for helper processes", () => {
    const resolved = resolveProcess(
      listener({
        processName: "Code Helper",
        executable:
          "/Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper.app/Contents/MacOS/Code Helper",
        command:
          "/Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper.app/Contents/MacOS/Code Helper --type=utility",
      }),
    );

    assert.equal(resolved.identity.displayName, "Visual Studio Code");
    assert.equal(resolved.identity.kind, "application");
    assert.equal(resolved.identity.confidence, "high");
  });

  it("recognizes macOS-owned processes", () => {
    const resolved = resolveProcess(
      listener({
        processName: "ControlCenter",
        command:
          "/System/Library/CoreServices/ControlCenter.app/Contents/MacOS/ControlCenter",
      }),
    );

    assert.equal(resolved.identity.displayName, "macOS Control Center");
    assert.equal(resolved.identity.kind, "system");
    assert.equal(resolved.identity.confidence, "high");
  });
});

describe("resolveProcess source attribution", () => {
  it("attributes an npm package script from the parent chain", () => {
    const resolved = resolveProcess(
      listener({
        processName: "node",
        command:
          "/Users/example/Developer/app/node_modules/.bin/vite --host 0.0.0.0",
        workingDirectory: "/Users/example/Developer/app",
        parentChain: [
          {
            pid: 20,
            processName: "npm",
            command: "npm run dev",
          },
        ],
      }),
    );

    assert.equal(resolved.launchSource.kind, "package-script");
    assert.equal(resolved.launchSource.label, "npm dev");
    assert.equal(resolved.launchSource.automatic, "no");
    assert.equal(resolved.identity.project?.packageManager, "npm");
    assert.equal(resolved.identity.project?.script, "dev");
  });

  it("uses the outer package script instead of an inner lifecycle command", () => {
    const resolved = resolveProcess(
      listener({
        processName: "node",
        command:
          "/Users/example/Developer/app/node_modules/@babel/node/lib/_babel-node",
        workingDirectory: "/Users/example/Developer/app",
        parentChain: [
          {
            pid: 30,
            processName: "sh",
            command: "/bin/sh -c npm run clean && npm run build",
          },
          {
            pid: 20,
            processName: "node",
            command: "node /Users/example/.nvm/bin/yarn start:dev",
          },
        ],
      }),
    );

    assert.equal(resolved.launchSource.label, "yarn start:dev");
    assert.equal(resolved.identity.project?.path, "/Users/example/Developer/app");
    assert.equal(resolved.identity.project?.script, "start:dev");
  });

  it("attributes Homebrew Services from a launchd label", () => {
    const value = listener({
      pid: 412,
      processName: "postgres",
      executable: "/opt/homebrew/opt/postgresql@16/bin/postgres",
    });
    const context: AttributionContext = {
      launchdJobs: [
        { pid: 412, label: "homebrew.mxcl.postgresql@16" },
      ],
    };

    const resolved = resolveProcess(value, context);
    assert.equal(resolved.launchSource.kind, "homebrew");
    assert.equal(resolved.launchSource.automatic, "yes");
    assert.equal(resolved.launchSource.confidence, "high");
  });

  it("attributes a native macOS application before generic launchd ancestry", () => {
    const resolved = resolveProcess(
      listener({
        pid: 500,
        processName: "Example",
        executable: "/Applications/Example.app/Contents/MacOS/Example",
      }),
      { launchdJobs: [{ pid: 500, label: "com.example.app" }] },
    );

    assert.equal(resolved.launchSource.kind, "native-app");
    assert.equal(resolved.launchSource.label, "Example");
  });

  it("attributes published ports to Docker containers", () => {
    const resolved = resolveProcess(
      listener({
        processName: "com.docker.backend",
        command:
          "/Applications/Docker.app/Contents/MacOS/com.docker.backend services",
        address: "*",
        port: 5432,
      }),
      {
        dockerBindings: [
          {
            containerId: "abc123",
            containerName: "example-db",
            image: "postgres:17",
            hostAddress: "0.0.0.0",
            hostPort: 5432,
            containerPort: 5432,
            protocol: "tcp",
          },
        ],
      },
    );

    assert.equal(resolved.identity.displayName, "Docker · example-db");
    assert.equal(resolved.launchSource.kind, "docker");
    assert.match(resolved.launchSource.detail ?? "", /postgres:17/);
  });

  it("attributes an interactive shell ancestor as a manual launch", () => {
    const resolved = resolveProcess(
      listener({
        processName: "python3",
        command: "python3 -m http.server 3000",
        parentChain: [
          {
            pid: 200,
            processName: "zsh",
            executable: "/bin/zsh",
            command: "-zsh",
          },
        ],
      }),
    );

    assert.equal(resolved.launchSource.kind, "manual");
    assert.equal(resolved.launchSource.automatic, "no");
  });

  it("does not treat a terminal application's launchd job as the child source", () => {
    const resolved = resolveProcess(
      listener({
        pid: 100,
        processName: "python3",
        command: "python3 -m http.server 3000",
        parentChain: [
          {
            pid: 200,
            processName: "zsh",
            executable: "/bin/zsh",
          },
          {
            pid: 300,
            processName: "stable",
            executable: "/Applications/Warp.app/Contents/MacOS/stable",
          },
        ],
      }),
      {
        launchdJobs: [
          {
            pid: 300,
            label: "application.dev.warp.Warp-Stable",
          },
        ],
      },
    );

    assert.equal(resolved.launchSource.kind, "manual");
  });

  it("keeps an evidence-backed unknown source when no rule matches", () => {
    const resolved = resolveProcess(
      listener({
        processName: "customd",
        command: "/opt/example/customd",
      }),
    );

    assert.equal(resolved.launchSource.kind, "unknown");
    assert.equal(resolved.launchSource.confidence, "low");
    assert.ok(resolved.launchSource.evidence.length > 0);
  });
});
