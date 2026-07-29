import type { RuntimeScanner } from "../../shared/runtimes.ts";
import { MacOsRuntimeScanner } from "./macos-runtime-scanner.ts";
import { PlaceholderRuntimeScanner } from "./placeholder-runtime-scanner.ts";

export function createRuntimeScanner(
  platform: NodeJS.Platform = process.platform,
): RuntimeScanner {
  return platform === "darwin"
    ? new MacOsRuntimeScanner()
    : new PlaceholderRuntimeScanner(platform);
}
