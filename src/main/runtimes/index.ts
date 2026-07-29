import type { RuntimeScanner } from "../../shared/runtimes.ts";
import { LinuxRuntimeScanner } from "./linux-runtime-scanner.ts";
import { MacOsRuntimeScanner } from "./macos-runtime-scanner.ts";
import { PlaceholderRuntimeScanner } from "./placeholder-runtime-scanner.ts";

export function createRuntimeScanner(
  platform: NodeJS.Platform = process.platform,
): RuntimeScanner {
  if (platform === "darwin") return new MacOsRuntimeScanner();
  if (platform === "linux") return new LinuxRuntimeScanner();
  return new PlaceholderRuntimeScanner(platform);
}
