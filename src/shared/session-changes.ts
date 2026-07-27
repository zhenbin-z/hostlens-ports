import type {
  ListenerChange,
  PortListener,
  PortSnapshot,
} from "./ports";

function normalizedAddress(address: string): string {
  return address.replace(/^\[(.*)]$/, "$1").toLowerCase();
}

export function listenerSocketKey(listener: PortListener): string {
  return [
    listener.protocol,
    normalizedAddress(listener.address),
    listener.port,
  ].join(":");
}

interface ComparableListener {
  pid?: number;
  processName: string;
  command?: string;
  executable?: string;
  workingDirectory?: string;
  exposure: PortListener["exposure"];
  observationStatus: PortListener["observationStatus"];
  identity: {
    displayName: string;
    kind: PortListener["identity"]["kind"];
    project?: PortListener["identity"]["project"];
    confidence: PortListener["identity"]["confidence"];
  };
  launchSource: {
    kind: PortListener["launchSource"]["kind"];
    label: string;
    detail?: string;
    automatic: PortListener["launchSource"]["automatic"];
    confidence: PortListener["launchSource"]["confidence"];
  };
}

function comparable(listener: PortListener): ComparableListener {
  return {
    pid: listener.pid,
    processName: listener.processName,
    command: listener.command,
    executable: listener.executable,
    workingDirectory: listener.workingDirectory,
    exposure: listener.exposure,
    observationStatus: listener.observationStatus,
    identity: {
      displayName: listener.identity.displayName,
      kind: listener.identity.kind,
      project: listener.identity.project,
      confidence: listener.identity.confidence,
    },
    launchSource: {
      kind: listener.launchSource.kind,
      label: listener.launchSource.label,
      detail: listener.launchSource.detail,
      automatic: listener.launchSource.automatic,
      confidence: listener.launchSource.confidence,
    },
  };
}

function changedFields(
  before: ComparableListener,
  after: ComparableListener,
): string[] {
  const fields: string[] = [];
  for (const key of Object.keys(after) as Array<keyof ComparableListener>) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      fields.push(key);
    }
  }
  return fields;
}

function stableListenerMap(
  listeners: readonly PortListener[],
): Map<string, PortListener> {
  const result = new Map<string, PortListener>();
  for (const listener of [...listeners].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    const baseKey = listenerSocketKey(listener);
    let key = baseKey;
    let suffix = 2;
    while (result.has(key)) {
      key = `${baseKey}#${suffix}`;
      suffix += 1;
    }
    result.set(key, listener);
  }
  return result;
}

export function compareSnapshots(
  before: PortSnapshot,
  after: PortSnapshot,
  detectedAt = after.scannedAt,
): ListenerChange[] {
  const previous = stableListenerMap(before.listeners);
  const current = stableListenerMap(after.listeners);
  const allKeys = [...new Set([...previous.keys(), ...current.keys()])].sort();
  const events: ListenerChange[] = [];

  for (const socketKey of allKeys) {
    const oldListener = previous.get(socketKey);
    const newListener = current.get(socketKey);

    if (!oldListener && newListener) {
      events.push({
        id: `new:${socketKey}:${newListener.id}`,
        kind: "new",
        detectedAt,
        socketKey,
        changedFields: [],
        after: newListener,
      });
      continue;
    }

    if (oldListener && !newListener) {
      events.push({
        id: `closed:${socketKey}:${oldListener.id}`,
        kind: "closed",
        detectedAt,
        socketKey,
        changedFields: [],
        before: oldListener,
      });
      continue;
    }

    if (oldListener && newListener) {
      const fields = changedFields(
        comparable(oldListener),
        comparable(newListener),
      );
      if (fields.length > 0) {
        events.push({
          id: `changed:${socketKey}:${oldListener.id}:${newListener.id}`,
          kind: "changed",
          detectedAt,
          socketKey,
          changedFields: fields,
          before: oldListener,
          after: newListener,
        });
      }
    }
  }

  return events;
}
