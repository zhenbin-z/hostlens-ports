import type {
  NetworkScanner,
  NetworkSnapshot,
} from "../../shared/network.ts";
import type { PortListener } from "../../shared/ports.ts";

export class PlaceholderNetworkScanner implements NetworkScanner {
  public constructor(private readonly platform: string) {}

  public async scan(_listeners: PortListener[]): Promise<NetworkSnapshot> {
    return {
      scannedAt: new Date().toISOString(),
      platform: this.platform,
      interfaces: [],
      routes: [],
      dnsResolvers: [],
      vpnConnections: [],
      socketRelations: [],
      summary: {
        dnsServers: [],
        vpnActive: false,
      },
      warnings: [
        `Network context inspection is not implemented for ${this.platform}.`,
      ],
    };
  }
}
