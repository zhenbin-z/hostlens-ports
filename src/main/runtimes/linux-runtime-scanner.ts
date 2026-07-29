import {
  type RuntimeCommandRunner,
  UnixRuntimeScanner,
} from "./macos-runtime-scanner.ts";

export class LinuxRuntimeScanner extends UnixRuntimeScanner {
  public constructor(runner?: RuntimeCommandRunner) {
    super("linux", runner);
  }
}
