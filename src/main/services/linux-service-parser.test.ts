import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseSystemdUnitNames,
  parseSystemdUnits,
} from "./linux-service-parser.ts";

describe("parseSystemdUnits", () => {
  it("collects unique service names from list-units and list-unit-files output", () => {
    assert.deepEqual(
      parseSystemdUnitNames(`sshd.service loaded active running OpenSSH
dbus.socket loaded active running D-Bus socket
sshd.service enabled enabled
postgresql.service disabled enabled
`),
      ["postgresql.service", "sshd.service"],
    );
  });

  it("normalizes running enabled and failed disabled units", () => {
    const services = parseSystemdUnits(
      `Id=sshd.service
Description=OpenSSH server daemon
LoadState=loaded
ActiveState=active
SubState=running
MainPID=701
ExecStart={ path=/usr/sbin/sshd ; argv[]=/usr/sbin/sshd -D ; }
FragmentPath=/usr/lib/systemd/system/sshd.service
UnitFileState=enabled

Id=example.service
Description=Example worker
LoadState=loaded
ActiveState=failed
SubState=failed
MainPID=0
ExecStart={ path=/opt/example/bin/worker ; argv[]=/opt/example/bin/worker ; }
FragmentPath=/etc/systemd/system/example.service
UnitFileState=disabled
`,
      "2026-07-29T00:00:00.000Z",
    );
    assert.equal(services.length, 2);
    const sshd = services.find(({ label }) => label === "sshd.service");
    assert.equal(sshd?.manager, "systemd");
    assert.equal(sshd?.status, "running");
    assert.equal(sshd?.startup, "automatic");
    assert.equal(sshd?.pid, 701);
    assert.equal(sshd?.program, "/usr/sbin/sshd");
    const failed = services.find(({ label }) => label === "example.service");
    assert.equal(failed?.status, "failed");
    assert.equal(failed?.startup, "disabled");
  });

  it("keeps static stopped units as on-demand observations", () => {
    const [service] = parseSystemdUnits(
      `Id=dbus.service
Description=D-Bus System Message Bus
LoadState=loaded
ActiveState=inactive
SubState=dead
MainPID=0
ExecStart=
FragmentPath=/usr/lib/systemd/system/dbus.service
UnitFileState=static
`,
      "2026-07-29T00:00:00.000Z",
    );
    assert.equal(service?.status, "stopped");
    assert.equal(service?.startup, "on-demand");
    assert.equal(service?.observationStatus, "partial");
  });
});
