import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inferLinuxVpnConnections,
  parseFirewalldObservation,
  parseIpAddressJson,
  parseIpRouteJson,
  parseResolvConf,
} from "./linux-network-parser.ts";

const collectedAt = "2026-07-29T00:00:00.000Z";

describe("Linux network parsers", () => {
  it("parses iproute2 address JSON and classifies common interfaces", () => {
    const interfaces = parseIpAddressJson(
      JSON.stringify([
        {
          ifname: "lo",
          operstate: "UNKNOWN",
          mtu: 65536,
          link_type: "loopback",
          addr_info: [
            { family: "inet", local: "127.0.0.1", prefixlen: 8, scope: "host" },
          ],
        },
        {
          ifname: "ens192",
          operstate: "UP",
          mtu: 1500,
          address: "52:54:00:12:34:56",
          link_type: "ether",
          addr_info: [
            {
              family: "inet",
              local: "192.168.10.20",
              prefixlen: 24,
              scope: "global",
            },
          ],
        },
        {
          ifname: "wg0",
          operstate: "UP",
          mtu: 1420,
          link_type: "none",
          addr_info: [
            { family: "inet", local: "10.8.0.2", prefixlen: 24, scope: "global" },
          ],
        },
      ]),
      collectedAt,
    );
    assert.deepEqual(
      interfaces.map(({ name, kind }) => ({ name, kind })),
      [
        { name: "lo", kind: "loopback" },
        { name: "ens192", kind: "ethernet" },
        { name: "wg0", kind: "vpn" },
      ],
    );
    assert.equal(inferLinuxVpnConnections(interfaces, collectedAt).length, 1);
  });

  it("parses IPv4 and IPv6 routes including defaults", () => {
    const routes = parseIpRouteJson(
      JSON.stringify([
        { dst: "default", gateway: "192.168.10.1", dev: "ens192" },
        { dst: "192.168.10.0/24", dev: "ens192" },
      ]),
      "ipv4",
      collectedAt,
    );
    assert.equal(routes[0]?.isDefault, true);
    assert.equal(routes[0]?.gateway, "192.168.10.1");
  });

  it("parses nameservers and search domains from resolv.conf", () => {
    const [resolver] = parseResolvConf(
      "nameserver 192.168.10.1\nnameserver 1.1.1.1\nsearch corp.example local\n",
      collectedAt,
    );
    assert.deepEqual(resolver?.nameservers, ["192.168.10.1", "1.1.1.1"]);
    assert.deepEqual(resolver?.searchDomains, ["corp.example", "local"]);
  });

  it("records firewalld state and active zones without inferring policy", () => {
    const firewall = parseFirewalldObservation(
      "running\n",
      "public\n  interfaces: ens192\ntrusted\n  interfaces: wg0\n",
      collectedAt,
    );
    assert.equal(firewall.status, "running");
    assert.deepEqual(firewall.activeZones, ["public", "trusted"]);
  });
});
