import type { ServiceScanner } from "../../shared/services.ts";
import { MacOsServiceScanner } from "./macos-service-scanner.ts";
import { LinuxServiceScanner } from "./linux-service-scanner.ts";
import { PlaceholderServiceScanner } from "./placeholder-service-scanner.ts";

export function createServiceScanner(
  platform: NodeJS.Platform = process.platform,
): ServiceScanner {
  if (platform === "darwin") return new MacOsServiceScanner();
  if (platform === "linux") return new LinuxServiceScanner();
  return new PlaceholderServiceScanner(platform);
}
