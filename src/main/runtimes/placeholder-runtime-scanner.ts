import type { PortListener } from "../../shared/ports.ts";
import type {
  RuntimeScanner,
  RuntimeSnapshot,
} from "../../shared/runtimes.ts";
import type { ServiceDefinition } from "../../shared/services.ts";

export class PlaceholderRuntimeScanner implements RuntimeScanner {
  public constructor(private readonly platform: string) {}

  public async scan(
    _listeners: PortListener[],
    _services: ServiceDefinition[],
  ): Promise<RuntimeSnapshot> {
    return {
      scannedAt: new Date().toISOString(),
      platform: this.platform,
      runtimes: [],
      packages: [],
      relationships: [],
      warnings: [
        `Runtime and package inspection is not available on ${this.platform} yet.`,
      ],
    };
  }
}
