import type { PortListener, PortSnapshot } from "../../shared/ports";
import type { PortScanner } from "./port-scanner";
import {
  createUnknownLaunchSource,
  createUnresolvedIdentity,
  resolveProcess,
  type AttributionContext,
} from "./process-identity.ts";

function sample(
  value: Omit<PortListener, "identity" | "launchSource">,
  context: AttributionContext = {},
): PortListener {
  const listener: PortListener = {
    ...value,
    identity: createUnresolvedIdentity(value.processName),
    launchSource: createUnknownLaunchSource(),
  };
  const resolved = resolveProcess(listener, context);
  listener.identity = resolved.identity;
  listener.launchSource = resolved.launchSource;
  return listener;
}

const sampleListeners: PortListener[] = [
  sample({
    id: "tcp-0.0.0.0-3000-48291",
    protocol: "tcp",
    address: "0.0.0.0",
    port: 3000,
    pid: 48291,
    processName: "node",
    portType: "service",
    command:
      "/Users/example/Developer/sample-web/node_modules/.bin/vite --host 0.0.0.0",
    executable: "/opt/homebrew/bin/node",
    workingDirectory: "/Users/example/Developer/sample-web",
    parentChain: [
      { pid: 48280, processName: "yarn", command: "yarn dev" },
    ],
    observationStatus: "complete",
    unavailableFields: [],
    evidence: [],
    exposure: "network",
  }),
  sample(
    {
      id: "tcp-127.0.0.1-5432-931",
      protocol: "tcp",
      address: "127.0.0.1",
      port: 5432,
      pid: 931,
      processName: "postgres",
      portType: "service",
      command: "postgres -D /opt/homebrew/var/postgresql@16",
      executable: "/opt/homebrew/opt/postgresql@16/bin/postgres",
      workingDirectory: "/opt/homebrew/var/postgresql@16",
      parentChain: [
        { pid: 1, processName: "launchd", executable: "/sbin/launchd" },
      ],
      observationStatus: "complete",
      unavailableFields: [],
      evidence: [],
      exposure: "local",
    },
    {
      launchdJobs: [
        { pid: 931, label: "homebrew.mxcl.postgresql@16" },
      ],
    },
  ),
  sample({
    id: "tcp-*-5000-614",
    protocol: "tcp",
    address: "*",
    port: 5000,
    pid: 614,
    processName: "ControlCenter",
    portType: "service",
    parentChain: [],
    observationStatus: "partial",
    unavailableFields: [
      "parentPid",
      "command",
      "executable",
      "workingDirectory",
      "parentChain",
    ],
    evidence: [],
    exposure: "network",
  }),
  sample({
    id: "tcp-127.0.0.1-63342-7114",
    protocol: "tcp",
    address: "127.0.0.1",
    port: 63342,
    pid: 7114,
    processName: "WebStorm",
    portType: "dynamic",
    command: "/Applications/WebStorm.app/Contents/MacOS/webstorm",
    executable: "/Applications/WebStorm.app/Contents/MacOS/webstorm",
    parentChain: [],
    observationStatus: "partial",
    unavailableFields: ["parentPid", "workingDirectory", "parentChain"],
    evidence: [],
    exposure: "local",
  }),
];

export class PlaceholderPortScanner implements PortScanner {
  public constructor(private readonly platform: NodeJS.Platform) {}

  public async scan(): Promise<PortSnapshot> {
    return {
      scannedAt: new Date().toISOString(),
      platform: this.platform,
      listeners: sampleListeners,
      warnings: [
        `Live scanning is not implemented for ${this.platform}; showing sample data.`,
      ],
    };
  }
}
