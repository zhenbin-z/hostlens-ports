import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  NetworkScanner,
  NetworkSnapshot,
} from "../../shared/network.ts";
import type { PortListener } from "../../shared/ports.ts";
import {
  inferVpnConnections,
  parseDnsResolvers,
  parseHardwarePorts,
  parseIfconfig,
  parseRoutes,
  relateSocketsToInterfaces,
} from "./macos-network-parser.ts";

const execFileAsync = promisify(execFile);
const IFCONFIG_PATH = "/sbin/ifconfig";
const NETSTAT_PATH = "/usr/sbin/netstat";
const SCUTIL_PATH = "/usr/sbin/scutil";
const NETWORKSETUP_PATH = "/usr/sbin/networksetup";
const MAX_BUFFER_BYTES = 4 * 1024 * 1024;

interface CommandObservation {
  stdout: string;
  warning?: string;
}

async function observe(
  executable: string,
  args: string[],
  label: string,
): Promise<CommandObservation> {
  try {
    const { stdout } = await execFileAsync(executable, args, {
      encoding: "utf8",
      maxBuffer: MAX_BUFFER_BYTES,
      timeout: 4_000,
    });
    return { stdout };
  } catch (cause) {
    const partial = cause as { stdout?: string; message?: string };
    return {
      stdout: partial.stdout ?? "",
      warning: `${label} inspection was unavailable: ${partial.message ?? "unknown error"}`,
    };
  }
}

export class MacOsNetworkScanner implements NetworkScanner {
  public async scan(listeners: PortListener[]): Promise<NetworkSnapshot> {
    const collectedAt = new Date().toISOString();
    const [ifconfig, hardware, ipv4Routes, ipv6Routes, dns] =
      await Promise.all([
        observe(IFCONFIG_PATH, ["-a"], "Network interface"),
        observe(
          NETWORKSETUP_PATH,
          ["-listallhardwareports"],
          "Hardware port",
        ),
        observe(NETSTAT_PATH, ["-rn", "-f", "inet"], "IPv4 route"),
        observe(NETSTAT_PATH, ["-rn", "-f", "inet6"], "IPv6 route"),
        observe(SCUTIL_PATH, ["--dns"], "DNS"),
      ]);

    const hardwarePorts = parseHardwarePorts(hardware.stdout);
    const interfaces = parseIfconfig(
      ifconfig.stdout,
      hardwarePorts,
      collectedAt,
    );
    const routes = [
      ...parseRoutes(ipv4Routes.stdout, "ipv4", collectedAt),
      ...parseRoutes(ipv6Routes.stdout, "ipv6", collectedAt),
    ];
    const dnsResolvers = parseDnsResolvers(dns.stdout, collectedAt);
    const vpnConnections = inferVpnConnections(interfaces, collectedAt);
    const socketRelations = relateSocketsToInterfaces(
      listeners,
      interfaces,
      collectedAt,
    );
    const defaultRoute =
      routes.find((route) => route.isDefault && route.family === "ipv4") ??
      routes.find((route) => route.isDefault);
    const defaultInterface = interfaces.find(
      (item) => item.name === defaultRoute?.interfaceName,
    );
    const primaryAddress =
      defaultInterface?.addresses.find(
        (address) => address.family === defaultRoute?.family,
      ) ?? defaultInterface?.addresses[0];

    return {
      scannedAt: collectedAt,
      platform: "darwin",
      interfaces,
      routes,
      dnsResolvers,
      vpnConnections,
      socketRelations,
      summary: {
        defaultInterfaceName: defaultRoute?.interfaceName,
        defaultGateway: defaultRoute?.gateway,
        primaryAddress: primaryAddress?.address,
        dnsServers: [
          ...new Set(dnsResolvers.flatMap((resolver) => resolver.nameservers)),
        ],
        vpnActive: vpnConnections.length > 0,
      },
      warnings: [
        ifconfig.warning,
        hardware.warning,
        ipv4Routes.warning,
        ipv6Routes.warning,
        dns.warning,
      ].filter((warning): warning is string => Boolean(warning)),
    };
  }
}
