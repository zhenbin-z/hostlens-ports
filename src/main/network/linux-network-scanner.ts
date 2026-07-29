import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { promisify } from "node:util";
import type {
  NetworkScanner,
  NetworkSnapshot,
} from "../../shared/network.ts";
import type { PortListener } from "../../shared/ports.ts";
import { relateSocketsToInterfaces } from "./macos-network-parser.ts";
import {
  inferLinuxVpnConnections,
  parseIpAddressJson,
  parseIpRouteJson,
  parseResolvConf,
} from "./linux-network-parser.ts";

const execFileAsync = promisify(execFile);
const IP_PATHS = ["/usr/sbin/ip", "/usr/bin/ip", "/sbin/ip"];
const MAX_BUFFER_BYTES = 8 * 1024 * 1024;

async function findIp(): Promise<string | undefined> {
  for (const path of IP_PATHS) {
    try {
      await access(path);
      return path;
    } catch {
      // Keep checking iproute2 locations used by Ubuntu and RHEL.
    }
  }
  return undefined;
}

async function observe(
  executable: string,
  args: string[],
  label: string,
): Promise<{ stdout: string; warning?: string }> {
  try {
    const { stdout } = await execFileAsync(executable, args, {
      encoding: "utf8",
      maxBuffer: MAX_BUFFER_BYTES,
      timeout: 5_000,
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

export class LinuxNetworkScanner implements NetworkScanner {
  public async scan(listeners: PortListener[]): Promise<NetworkSnapshot> {
    const collectedAt = new Date().toISOString();
    const ip = await findIp();
    if (!ip) {
      throw new Error(
        "The Linux ip utility is unavailable. Install the iproute/iproute2 package.",
      );
    }
    const [addresses, ipv4Routes, ipv6Routes, resolvConf] = await Promise.all([
      observe(ip, ["-j", "address", "show"], "Network interface"),
      observe(ip, ["-j", "-4", "route", "show"], "IPv4 route"),
      observe(ip, ["-j", "-6", "route", "show"], "IPv6 route"),
      readFile("/etc/resolv.conf", "utf8")
        .then(
          (stdout): { stdout: string; warning?: string } => ({ stdout }),
        )
        .catch((cause: unknown) => ({
          stdout: "",
          warning: `DNS inspection was unavailable: ${
            cause instanceof Error ? cause.message : "unknown error"
          }`,
        })),
    ]);

    const interfaces = parseIpAddressJson(addresses.stdout, collectedAt);
    const routes = [
      ...parseIpRouteJson(ipv4Routes.stdout, "ipv4", collectedAt),
      ...parseIpRouteJson(ipv6Routes.stdout, "ipv6", collectedAt),
    ];
    const dnsResolvers = parseResolvConf(resolvConf.stdout, collectedAt);
    const vpnConnections = inferLinuxVpnConnections(interfaces, collectedAt);
    const socketRelations = relateSocketsToInterfaces(
      listeners,
      interfaces,
      collectedAt,
    );
    const defaultRoute =
      routes.find(({ family, isDefault }) => family === "ipv4" && isDefault) ??
      routes.find(({ isDefault }) => isDefault);
    const defaultInterface = interfaces.find(
      ({ name }) => name === defaultRoute?.interfaceName,
    );
    const primaryAddress =
      defaultInterface?.addresses.find(
        ({ family }) => family === defaultRoute?.family,
      ) ?? defaultInterface?.addresses[0];

    return {
      scannedAt: collectedAt,
      platform: "linux",
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
          ...new Set(dnsResolvers.flatMap(({ nameservers }) => nameservers)),
        ],
        vpnActive: vpnConnections.length > 0,
      },
      warnings: [
        addresses.warning,
        ipv4Routes.warning,
        ipv6Routes.warning,
        resolvConf.warning,
      ].filter((warning): warning is string => Boolean(warning)),
    };
  }
}
