import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PortListener } from "../../shared/ports.ts";
import {
  inferVpnConnections,
  parseDnsResolvers,
  parseHardwarePorts,
  parseIfconfig,
  parseRoutes,
  relateSocketsToInterfaces,
} from "./macos-network-parser.ts";

const collectedAt = "2026-07-29T01:00:00.000Z";

const hardwareFixture = `Hardware Port: Wi-Fi
Device: en0
Ethernet Address: aa:bb:cc:dd:ee:ff

Hardware Port: Thunderbolt Ethernet
Device: en7
Ethernet Address: 11:22:33:44:55:66
`;

const ifconfigFixture = `lo0: flags=8049<UP,LOOPBACK,RUNNING,MULTICAST> mtu 16384
\tinet 127.0.0.1 netmask 0xff000000
\tinet6 ::1 prefixlen 128
en0: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500
\tether aa:bb:cc:dd:ee:ff
\tinet6 fe80::1234%en0 prefixlen 64 secured scopeid 0xf
\tinet 192.168.10.25 netmask 0xffffff00 broadcast 192.168.10.255
utun5: flags=8051<UP,POINTOPOINT,RUNNING,MULTICAST> mtu 1380
\tinet6 fe80::abcd%utun5 prefixlen 64 scopeid 0x16
\tinet 10.8.0.2 netmask 0xffffffff
`;

function listener(
  id: string,
  address: string,
): PortListener {
  return {
    id,
    protocol: "tcp",
    address,
    port: 3000,
    processName: "node",
    portType: "service",
    parentChain: [],
    observationStatus: "complete",
    unavailableFields: [],
    evidence: [],
    identity: {
      displayName: "Vite",
      kind: "development",
      confidence: "high",
      evidence: [],
    },
    launchSource: {
      kind: "package-script",
      label: "yarn dev",
      automatic: "no",
      confidence: "high",
      evidence: [],
    },
    exposure: address === "127.0.0.1" ? "local" : "network",
  };
}

describe("macOS network parsers", () => {
  it("maps friendly hardware names and parses interface evidence", () => {
    const hardware = parseHardwarePorts(hardwareFixture);
    const interfaces = parseIfconfig(
      ifconfigFixture,
      hardware,
      collectedAt,
    );

    assert.equal(hardware.get("en0"), "Wi-Fi");
    const wifi = interfaces.find((item) => item.name === "en0");
    assert.equal(wifi?.displayName, "Wi-Fi");
    assert.equal(wifi?.kind, "wifi");
    assert.equal(wifi?.status, "up");
    assert.equal(wifi?.macAddress, "aa:bb:cc:dd:ee:ff");
    assert.deepEqual(wifi?.addresses, [
      {
        family: "ipv6",
        address: "fe80::1234",
        prefixLength: 64,
        scope: "link",
      },
      {
        family: "ipv4",
        address: "192.168.10.25",
        prefixLength: 24,
        scope: "network",
      },
    ]);
  });

  it("parses default routes without claiming reachability", () => {
    const routes = parseRoutes(
      `Routing tables

Internet:
Destination        Gateway            Flags               Netif Expire
default            192.168.10.1       UGScg                 en0
127                127.0.0.1          UCS                   lo0
`,
      "ipv4",
      collectedAt,
    );

    assert.equal(routes[0]?.isDefault, true);
    assert.equal(routes[0]?.gateway, "192.168.10.1");
    assert.equal(routes[0]?.interfaceName, "en0");
  });

  it("parses scoped DNS resolvers", () => {
    const resolvers = parseDnsResolvers(
      `DNS configuration

resolver #1
  search domain[0] : example.internal
  nameserver[0] : 192.168.10.1
  if_index : 15 (en0)

resolver #2
  nameserver[0] : fe80::1%en0
  if_index : 15 (en0)
`,
      collectedAt,
    );

    assert.equal(resolvers.length, 2);
    assert.equal(resolvers[0]?.interfaceName, "en0");
    assert.deepEqual(resolvers[0]?.searchDomains, ["example.internal"]);
    assert.deepEqual(resolvers[1]?.nameservers, ["fe80::1%en0"]);
  });

  it("marks active tunnel interfaces as inferred VPN observations", () => {
    const interfaces = parseIfconfig(
      ifconfigFixture,
      parseHardwarePorts(hardwareFixture),
      collectedAt,
    );
    const vpns = inferVpnConnections(interfaces, collectedAt);

    assert.equal(vpns.length, 1);
    assert.equal(vpns[0]?.interfaceName, "utun5");
    assert.equal(vpns[0]?.confidence, "medium");
    assert.equal(vpns[0]?.evidence[0]?.kind, "inferred");
  });

  it("relates exact, loopback, and wildcard sockets to interfaces", () => {
    const interfaces = parseIfconfig(
      ifconfigFixture,
      parseHardwarePorts(hardwareFixture),
      collectedAt,
    );
    const relations = relateSocketsToInterfaces(
      [
        listener("local", "127.0.0.1"),
        listener("exact", "192.168.10.25"),
        listener("wildcard", "*"),
      ],
      interfaces,
      collectedAt,
    );

    assert.deepEqual(relations[0]?.interfaceIds, ["interface:lo0"]);
    assert.equal(relations[0]?.reachability, "local");
    assert.deepEqual(relations[1]?.interfaceIds, ["interface:en0"]);
    assert.equal(relations[1]?.kind, "bound");
    assert.equal(relations[1]?.reachability, "potential");
    assert.equal(relations[2]?.kind, "potential");
    assert.deepEqual(relations[2]?.interfaceIds, [
      "interface:en0",
      "interface:utun5",
    ]);
    assert.match(relations[2]?.reason ?? "", /not actively tested/);
  });
});
