import type { PortListener, PortSnapshot } from "../../shared/ports";
import type { PortScanner } from "./port-scanner";

const sampleListeners: PortListener[] = [
  {
    id: "tcp-0.0.0.0-3000-48291",
    protocol: "tcp",
    address: "0.0.0.0",
    port: 3000,
    pid: 48291,
    processName: "node",
    command: "vite --host 0.0.0.0",
    executable: "/opt/homebrew/bin/node",
    exposure: "network",
    source: "Development server",
  },
  {
    id: "tcp-127.0.0.1-5432-931",
    protocol: "tcp",
    address: "127.0.0.1",
    port: 5432,
    pid: 931,
    processName: "postgres",
    command: "postgres -D /opt/homebrew/var/postgresql@16",
    executable: "/opt/homebrew/opt/postgresql@16/bin/postgres",
    exposure: "local",
    source: "Homebrew service",
  },
  {
    id: "tcp-*-5000-614",
    protocol: "tcp",
    address: "*",
    port: 5000,
    pid: 614,
    processName: "ControlCenter",
    exposure: "network",
    source: "macOS system service",
  },
  {
    id: "tcp-127.0.0.1-63342-7114",
    protocol: "tcp",
    address: "127.0.0.1",
    port: 63342,
    pid: 7114,
    processName: "WebStorm",
    exposure: "local",
    source: "Desktop application",
  },
];

export class PlaceholderPortScanner implements PortScanner {
  public constructor(private readonly platform: NodeJS.Platform) {}

  public async scan(): Promise<PortSnapshot> {
    return {
      scannedAt: new Date().toISOString(),
      platform: this.platform,
      listeners: sampleListeners,
    };
  }
}

