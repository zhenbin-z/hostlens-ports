import type { PortListener } from "../../shared/ports.ts";
import type {
  ServiceScanner,
  ServiceSnapshot,
} from "../../shared/services.ts";

export class PlaceholderServiceScanner implements ServiceScanner {
  public constructor(private readonly platform: string) {}

  public async scan(_listeners: PortListener[]): Promise<ServiceSnapshot> {
    return {
      scannedAt: new Date().toISOString(),
      platform: this.platform,
      services: [],
      warnings: [
        `Service inspection is not implemented for ${this.platform}.`,
      ],
    };
  }
}

