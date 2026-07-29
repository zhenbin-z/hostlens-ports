import type { NetworkScanner } from "../../shared/network.ts";
import { MacOsNetworkScanner } from "./macos-network-scanner.ts";
import { LinuxNetworkScanner } from "./linux-network-scanner.ts";
import { PlaceholderNetworkScanner } from "./placeholder-network-scanner.ts";

export function createNetworkScanner(
  platform: NodeJS.Platform = process.platform,
): NetworkScanner {
  if (platform === "darwin") return new MacOsNetworkScanner();
  if (platform === "linux") return new LinuxNetworkScanner();
  return new PlaceholderNetworkScanner(platform);
}
