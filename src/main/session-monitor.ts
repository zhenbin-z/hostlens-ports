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
import type {
  RuntimeScanner,
  RuntimeSnapshot,
} from "../shared/runtimes.ts";
import {
  HOST_SNAPSHOT_SCHEMA_VERSION,
  emptyHistoryState,
  type HistoryState,
  type HistoryUpdate,
  type HostObservationSnapshot,
} from "../shared/history.ts";
import { compareSnapshots } from "../shared/session-changes.ts";
import type { PortScanner } from "./scanners/port-scanner.ts";

const MAX_SESSION_EVENTS = 100;
const DEFAULT_COALESCE_SCAN_MS = 750;

export interface HistoryPersistence {
  record(snapshot: HostObservationSnapshot): HistoryState;
  readState(): HistoryState;
  update(update: HistoryUpdate): HistoryState;
  clearHistory(): HistoryState;
}

export class SessionMonitor {
  private readonly scanner: PortScanner;
  private readonly serviceScanner: ServiceScanner;
  private readonly networkScanner: NetworkScanner;
  private readonly runtimeScanner: RuntimeScanner;
  private readonly historyPersistence: HistoryPersistence | undefined;
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
    runtimeScanner: RuntimeScanner,
    coalesceScanMs = DEFAULT_COALESCE_SCAN_MS,
    historyPersistence?: HistoryPersistence,
  ) {
    this.scanner = scanner;
    this.serviceScanner = serviceScanner;
    this.networkScanner = networkScanner;
    this.runtimeScanner = runtimeScanner;
    this.coalesceScanMs = coalesceScanMs;
    this.historyPersistence = historyPersistence;
  }

  public updateHistory(update: HistoryUpdate): HistoryState {
    return this.historyPersistence?.update(update) ?? emptyHistoryState();
  }

  public clearHistory(): HistoryState {
    return this.historyPersistence?.clearHistory() ?? emptyHistoryState();
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
    const runtimes = await this.scanRuntimes(snapshot, services);
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
    const observation: HostObservationSnapshot = {
      schemaVersion: HOST_SNAPSHOT_SCHEMA_VERSION,
      observedAt: snapshot.scannedAt,
      ports: snapshot,
      services,
      network,
      runtimes,
    };
    const history =
      this.historyPersistence?.record(observation) ?? emptyHistoryState();

    this.latestState = {
      snapshot,
      services,
      network,
      runtimes,
      changes: {
        startedAt: this.startedAt,
        events: this.events,
      },
      history,
    };
    return this.latestState;
  }

  private async scanRuntimes(
    snapshot: PortSnapshot,
    services: ServiceSnapshot,
  ): Promise<RuntimeSnapshot> {
    try {
      return await this.runtimeScanner.scan(
        snapshot.listeners,
        services.services,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown runtime scan error";

      return {
        scannedAt: snapshot.scannedAt,
        platform: snapshot.platform,
        runtimes: [],
        packages: [],
        relationships: [],
        warnings: [
          `Runtime inspection failed without affecting other results: ${message}`,
        ],
      };
    }
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
