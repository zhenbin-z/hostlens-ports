import type {
  HostLensState,
  ListenerChange,
  PortSnapshot,
} from "../shared/ports.ts";
import type {
  ServiceScanner,
  ServiceSnapshot,
} from "../shared/services.ts";
import type {
  NetworkScanner,
  NetworkSnapshot,
} from "../shared/network.ts";
import { compareSnapshots } from "../shared/session-changes.ts";
import type { PortScanner } from "./scanners/port-scanner.ts";

const MAX_SESSION_EVENTS = 100;
const DEFAULT_COALESCE_SCAN_MS = 750;

export class SessionMonitor {
  private readonly scanner: PortScanner;
  private readonly serviceScanner: ServiceScanner;
  private readonly networkScanner: NetworkScanner;
  private readonly coalesceScanMs: number;
  private readonly startedAt = new Date().toISOString();
  private previousSnapshot: PortSnapshot | undefined;
  private latestState: HostLensState | undefined;
  private events: ListenerChange[] = [];
  private activeScan: Promise<HostLensState> | undefined;
  private lastScanStartedAt = 0;

  public constructor(
    scanner: PortScanner,
    serviceScanner: ServiceScanner,
    networkScanner: NetworkScanner,
    coalesceScanMs = DEFAULT_COALESCE_SCAN_MS,
  ) {
    this.scanner = scanner;
    this.serviceScanner = serviceScanner;
    this.networkScanner = networkScanner;
    this.coalesceScanMs = coalesceScanMs;
  }

  public scan(): Promise<HostLensState> {
    const now = Date.now();
    if (
      this.latestState &&
      now - this.lastScanStartedAt < this.coalesceScanMs
    ) {
      return Promise.resolve(this.latestState);
    }
    if (this.activeScan) return this.activeScan;

    this.lastScanStartedAt = now;
    this.activeScan = this.performScan().finally(() => {
      this.activeScan = undefined;
    });
    return this.activeScan;
  }

  private async performScan(): Promise<HostLensState> {
    const snapshot = await this.scanner.scan();
    const [services, network] = await Promise.all([
      this.scanServices(snapshot),
      this.scanNetwork(snapshot),
    ]);
    if (this.previousSnapshot) {
      const nextEvents = compareSnapshots(this.previousSnapshot, snapshot);
      if (nextEvents.length > 0) {
        this.events = [...nextEvents, ...this.events].slice(
          0,
          MAX_SESSION_EVENTS,
        );
      }
    }

    this.previousSnapshot = snapshot;
    this.latestState = {
      snapshot,
      services,
      network,
      changes: {
        startedAt: this.startedAt,
        events: this.events,
      },
    };
    return this.latestState;
  }

  private async scanNetwork(snapshot: PortSnapshot): Promise<NetworkSnapshot> {
    try {
      return await this.networkScanner.scan(snapshot.listeners);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown network scan error";

      return {
        scannedAt: snapshot.scannedAt,
        platform: snapshot.platform,
        interfaces: [],
        routes: [],
        dnsResolvers: [],
        vpnConnections: [],
        socketRelations: [],
        summary: {
          dnsServers: [],
          vpnActive: false,
        },
        warnings: [
          `Network inspection failed without affecting port results: ${message}`,
        ],
      };
    }
  }

  private async scanServices(snapshot: PortSnapshot): Promise<ServiceSnapshot> {
    try {
      return await this.serviceScanner.scan(snapshot.listeners);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown service scan error";

      return {
        scannedAt: snapshot.scannedAt,
        platform: snapshot.platform,
        services: [],
        warnings: [
          `Service inspection failed without affecting port results: ${message}`,
        ],
      };
    }
  }
}
