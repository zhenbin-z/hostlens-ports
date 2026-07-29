import type { HostObservationSnapshot, ChangeEvent, ChangeResourceKind } from "./history.ts";
import type { PortListener } from "./ports.ts";

interface ResourceProjection {
  kind: ChangeResourceKind;
  id: string;
  key: string;
  label: string;
  value: Record<string, unknown>;
  evidenceCount: number;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stable).sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(
          ([key]) =>
            !["evidence", "scannedAt", "collectedAt", "warnings"].includes(key),
        )
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  return value;
}

function record(value: unknown): Record<string, unknown> {
  return stable(value) as Record<string, unknown>;
}

function resourceKey(kind: ChangeResourceKind, id: string): string {
  return `${kind}:${id}`;
}

function listenerEvidenceCount(listener: PortListener): number {
  return (
    listener.evidence.length +
    listener.identity.evidence.length +
    listener.launchSource.evidence.length
  );
}

function listenerSocketKey(listener: PortListener): string {
  return [
    listener.protocol,
    listener.address.replace(/^\[(.*)]$/, "$1").toLowerCase(),
    listener.port,
  ].join(":");
}

function project(snapshot: HostObservationSnapshot): ResourceProjection[] {
  const ports: ResourceProjection[] = snapshot.ports.listeners.map((listener) => {
    const id = listenerSocketKey(listener);
    return {
      kind: "port",
      id,
      key: resourceKey("port", id),
      label: `${listener.identity.displayName} · ${listener.protocol.toUpperCase()} ${listener.address}:${listener.port}`,
      value: record(listener),
      evidenceCount: listenerEvidenceCount(listener),
    };
  });

  const services: ResourceProjection[] = snapshot.services.services.map(
    (service) => ({
      kind: "service",
      id: service.id,
      key: resourceKey("service", service.id),
      label: service.displayName,
      value: record(service),
      evidenceCount: service.evidence.length,
    }),
  );

  const networkValue = {
    interfaces: snapshot.network.interfaces,
    routes: snapshot.network.routes,
    dnsResolvers: snapshot.network.dnsResolvers,
    vpnConnections: snapshot.network.vpnConnections,
    summary: snapshot.network.summary,
  };
  const network: ResourceProjection = {
    kind: "network",
    id: "host",
    key: resourceKey("network", "host"),
    label: "Host network context",
    value: record(networkValue),
    evidenceCount:
      snapshot.network.interfaces.reduce(
        (count, item) => count + item.evidence.length,
        0,
      ) +
      snapshot.network.routes.reduce(
        (count, item) => count + item.evidence.length,
        0,
      ) +
      snapshot.network.dnsResolvers.reduce(
        (count, item) => count + item.evidence.length,
        0,
      ) +
      snapshot.network.vpnConnections.reduce(
        (count, item) => count + item.evidence.length,
        0,
      ),
  };

  const runtimes: ResourceProjection[] = snapshot.runtimes.runtimes.map(
    (runtime) => ({
      kind: "runtime",
      id: runtime.id,
      key: resourceKey("runtime", runtime.id),
      label: `${runtime.kind} ${runtime.version}`,
      value: record(runtime),
      evidenceCount: runtime.evidence.length,
    }),
  );

  const packages: ResourceProjection[] = snapshot.runtimes.packages.map(
    (pkg) => ({
      kind: "package",
      id: pkg.id,
      key: resourceKey("package", pkg.id),
      label: `${pkg.name}@${pkg.version} · ${pkg.manager}`,
      value: record(pkg),
      evidenceCount: pkg.evidence.length,
    }),
  );

  return [...ports, ...services, network, ...runtimes, ...packages].sort(
    (left, right) => left.key.localeCompare(right.key),
  );
}

function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(
      (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
    )
    .sort();
}

function shortHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

export function compareHostObservations(
  before: HostObservationSnapshot,
  after: HostObservationSnapshot,
  detectedAt = after.observedAt,
): ChangeEvent[] {
  const previous = new Map(project(before).map((item) => [item.key, item]));
  const current = new Map(project(after).map((item) => [item.key, item]));
  const keys = [...new Set([...previous.keys(), ...current.keys()])].sort();
  const events: ChangeEvent[] = [];

  for (const key of keys) {
    const oldResource = previous.get(key);
    const newResource = current.get(key);
    const resource = newResource ?? oldResource;
    if (!resource) continue;

    let kind: ChangeEvent["kind"];
    let fields: string[] = [];
    if (!oldResource) {
      kind = "added";
    } else if (!newResource) {
      kind = "removed";
    } else {
      fields = changedFields(oldResource.value, newResource.value);
      if (fields.length === 0) continue;
      kind = "changed";
    }

    const fingerprint = JSON.stringify([
      detectedAt,
      kind,
      key,
      oldResource?.value,
      newResource?.value,
    ]);
    events.push({
      id: `${detectedAt}:${kind}:${shortHash(fingerprint)}`,
      detectedAt,
      resourceKind: resource.kind,
      resourceId: resource.id,
      resourceKey: key,
      label: resource.label,
      kind,
      changedFields: fields,
      before: oldResource?.value,
      after: newResource?.value,
      evidenceCount: resource.evidenceCount,
    });
  }

  return events;
}
