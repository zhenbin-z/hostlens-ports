import type { NetworkScanner } from "../../shared/network.ts";
import { MacOsNetworkScanner } from "./macos-network-scanner.ts";
import { PlaceholderNetworkScanner } from "./placeholder-network-scanner.ts";

export function createNetworkScanner(
  platform: NodeJS.Platform = process.platform,
): NetworkScanner {
  return platform === "darwin"
    ? new MacOsNetworkScanner()
    : new PlaceholderNetworkScanner(platform);
}
