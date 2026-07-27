import type { PortSnapshot } from "../../shared/ports";
import type { PortScanner } from "./port-scanner";
import { PlaceholderPortScanner } from "./placeholder-scanner";

/**
 * macOS scanner boundary.
 *
 * The MVP delegates to placeholder data. A later iteration can replace the
 * implementation with lsof/ps parsing without changing the renderer contract.
 */
export class MacOsPortScanner implements PortScanner {
  private readonly placeholder = new PlaceholderPortScanner("darwin");

  public scan(): Promise<PortSnapshot> {
    return this.placeholder.scan();
  }
}

