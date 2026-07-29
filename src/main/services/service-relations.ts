import type { PortListener } from "../../shared/ports.ts";
import type { ServiceDefinition } from "../../shared/services.ts";

export interface ServiceProcessCandidate {
  pid: number;
  parentPid?: number;
  processName: string;
  command?: string;
}

function listenerBelongsToService(
  service: ServiceDefinition,
  listener: PortListener,
): boolean {
  if (service.pid !== undefined) {
    if (listener.pid === service.pid) return true;
    if (listener.parentChain.some(({ pid }) => pid === service.pid)) return true;
  }

  if (
    listener.launchSource.kind === "launchd" ||
    listener.launchSource.kind === "homebrew"
  ) {
    const evidenceText = [
      listener.launchSource.label,
      listener.launchSource.detail,
      ...listener.launchSource.evidence.map(({ detail }) => detail),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (
      evidenceText.includes(service.label.toLowerCase()) ||
      (service.homebrewName &&
        evidenceText.includes(service.homebrewName.toLowerCase()))
    ) {
      return true;
    }
  }

  return false;
}

export function relateServicesToListeners(
  services: ServiceDefinition[],
  listeners: PortListener[],
  processes: ServiceProcessCandidate[] = [],
): ServiceDefinition[] {
  return services.map((service) => {
    const relatedProcesses = new Map<
      number,
      ServiceDefinition["relatedProcesses"][number]
    >();
    if (service.pid !== undefined) {
      const direct = processes.find(({ pid }) => pid === service.pid);
      relatedProcesses.set(service.pid, {
        pid: service.pid,
        parentPid: direct?.parentPid,
        processName: direct?.processName ?? service.displayName,
        command: direct?.command,
        relationship: "direct",
      });

      let addedDescendant = true;
      while (addedDescendant) {
        addedDescendant = false;
        for (const process of processes) {
          if (
            process.parentPid !== undefined &&
            relatedProcesses.has(process.parentPid) &&
            !relatedProcesses.has(process.pid)
          ) {
            relatedProcesses.set(process.pid, {
              ...process,
              relationship: "descendant",
            });
            addedDescendant = true;
          }
        }
      }
    }

    const related = listeners.filter((listener) =>
      listenerBelongsToService(service, listener),
    );
    for (const listener of related) {
      if (listener.pid === undefined || relatedProcesses.has(listener.pid)) {
        continue;
      }
      relatedProcesses.set(listener.pid, {
        pid: listener.pid,
        parentPid: listener.parentPid,
        processName: listener.processName,
        command: listener.command,
        relationship: "descendant",
      });
    }
    const relatedProcessList = [...relatedProcesses.values()].sort(
      (left, right) => left.pid - right.pid,
    );
    return {
      ...service,
      relatedListenerIds: related.map(({ id }) => id).sort(),
      relatedProcessIds: relatedProcessList.map(({ pid }) => pid),
      relatedProcesses: relatedProcessList,
      evidence:
        related.length === 0
          ? service.evidence
          : [
              ...service.evidence,
              {
                kind: "inferred" as const,
                source: "HostLens service relationships",
                detail: `${related.length} listening socket(s) matched by service PID, descendants, or launch source`,
                collectedAt: service.evidence[0]?.collectedAt ?? new Date().toISOString(),
                confidence: service.pid !== undefined ? "high" as const : "medium" as const,
                fields: ["relationships" as const],
              },
            ],
    };
  });
}
