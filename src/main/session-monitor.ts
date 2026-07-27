import type {
  HostLensState,
  ListenerChange,
  PortSnapshot,
} from "../shared/ports.ts";
import { compareSnapshots } from "../shared/session-changes.ts";
import type { PortScanner } from "./scanners/port-scanner.ts";

const MAX_SESSION_EVENTS = 100;
const DEFAULT_COALESCE_SCAN_MS = 750;

export class SessionMonitor {
  private readonly scanner: PortScanner;
  private readonly coalesceScanMs: number;
  private readonly startedAt = new Date().toISOString();
  private previousSnapshot: PortSnapshot | undefined;
  private latestState: HostLensState | undefined;
  private events: ListenerChange[] = [];
  private activeScan: Promise<HostLensState> | undefined;
  private lastScanStartedAt = 0;

  public constructor(
    scanner: PortScanner,
    coalesceScanMs = DEFAULT_COALESCE_SCAN_MS,
  ) {
    this.scanner = scanner;
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
      changes: {
        startedAt: this.startedAt,
        events: this.events,
      },
    };
    return this.latestState;
  }
}
