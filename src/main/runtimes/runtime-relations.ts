import { basename } from "node:path";
import type { PortListener } from "../../shared/ports.ts";
import type {
  GlobalPackage,
  PackageRelationship,
  RuntimeEvidence,
} from "../../shared/runtimes.ts";
import type { ServiceDefinition } from "../../shared/services.ts";

function relationshipEvidence(
  collectedAt: string,
  source: string,
  detail: string,
): RuntimeEvidence {
  return {
    kind: "inferred",
    source,
    detail,
    collectedAt,
    confidence: "high",
    fields: ["relationship"],
  };
}

function commandContainsExecutable(
  command: string | undefined,
  executable: string,
): boolean {
  if (!command) return false;
  const escaped = executable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(?:^|[/\\s])${escaped}(?:$|[\\s.])`,
    "i",
  ).test(command);
}

export function relatePackagesToHost(
  packages: GlobalPackage[],
  listeners: PortListener[],
  services: ServiceDefinition[],
  collectedAt: string,
): PackageRelationship[] {
  const relationships: PackageRelationship[] = [];

  for (const pkg of packages) {
    const executableNames = new Set(
      pkg.executables.map((value) => basename(value).toLowerCase()),
    );

    for (const listener of listeners) {
      const processNames = [
        listener.processName,
        listener.identity.displayName,
        listener.executable ? basename(listener.executable) : undefined,
      ]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLowerCase());
      const executableMatch = processNames.some((value) =>
        executableNames.has(value),
      );
      const commandMatch = pkg.executables.some((value) =>
        commandContainsExecutable(listener.command, basename(value)),
      );
      const installPathMatch =
        Boolean(pkg.installPath) &&
        Boolean(listener.command?.includes(pkg.installPath ?? ""));

      if (!executableMatch && !commandMatch && !installPathMatch) continue;
      const reason = installPathMatch
        ? `The listener command references ${pkg.installPath}.`
        : `The listener uses the ${[...executableNames].find((name) => processNames.includes(name)) ?? pkg.name} executable reported by ${pkg.manager}.`;
      relationships.push({
        packageId: pkg.id,
        targetType: "listener",
        targetId: listener.id,
        reason,
        confidence: "high",
        evidence: [
          relationshipEvidence(
            collectedAt,
            "HostLens package-to-listener resolver",
            reason,
          ),
        ],
      });
    }

    for (const service of services) {
      const serviceProgram = service.program
        ? basename(service.program).toLowerCase()
        : undefined;
      const executableMatch =
        Boolean(serviceProgram) && executableNames.has(serviceProgram ?? "");
      const argumentMatch = pkg.executables.some((value) =>
        service.arguments.some((argument) =>
          commandContainsExecutable(argument, basename(value)),
        ),
      );
      const installPathMatch =
        Boolean(pkg.installPath) &&
        [service.program, ...service.arguments].some((value) =>
          value?.includes(pkg.installPath ?? ""),
        );

      if (!executableMatch && !argumentMatch && !installPathMatch) continue;
      const reason = installPathMatch
        ? `The service configuration references ${pkg.installPath}.`
        : `The service uses an executable reported by ${pkg.manager} for ${pkg.name}.`;
      relationships.push({
        packageId: pkg.id,
        targetType: "service",
        targetId: service.id,
        reason,
        confidence: "high",
        evidence: [
          relationshipEvidence(
            collectedAt,
            "HostLens package-to-service resolver",
            reason,
          ),
        ],
      });
    }
  }

  return relationships;
}
