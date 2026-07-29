import type { ServiceScanner } from "../../shared/services.ts";
import { MacOsServiceScanner } from "./macos-service-scanner.ts";
import { PlaceholderServiceScanner } from "./placeholder-service-scanner.ts";

export function createServiceScanner(
  platform: NodeJS.Platform = process.platform,
): ServiceScanner {
  return platform === "darwin"
    ? new MacOsServiceScanner()
    : new PlaceholderServiceScanner(platform);
}

