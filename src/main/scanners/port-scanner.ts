import type { PortSnapshot } from "../../shared/ports";

export interface PortScanner {
  scan(): Promise<PortSnapshot>;
}

