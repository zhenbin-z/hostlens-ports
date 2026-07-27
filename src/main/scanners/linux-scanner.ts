import type { PortSnapshot } from "../../shared/ports";
import type { PortScanner } from "./port-scanner";
import { PlaceholderPortScanner } from "./placeholder-scanner";

/**
 * Linux scanner boundary for future ss/procfs based collection.
 */
export class LinuxPortScanner implements PortScanner {
  private readonly placeholder = new PlaceholderPortScanner("linux");

  public scan(): Promise<PortSnapshot> {
    return this.placeholder.scan();
  }
}

