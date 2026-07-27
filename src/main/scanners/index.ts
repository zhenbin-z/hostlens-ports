import type { PortScanner } from "./port-scanner";
import { LinuxPortScanner } from "./linux-scanner";
import { MacOsPortScanner } from "./macos-scanner";
import { PlaceholderPortScanner } from "./placeholder-scanner";

export function createPortScanner(platform: NodeJS.Platform = process.platform): PortScanner {
  switch (platform) {
    case "darwin":
      return new MacOsPortScanner();
    case "linux":
      return new LinuxPortScanner();
    default:
      return new PlaceholderPortScanner(platform);
  }
}

