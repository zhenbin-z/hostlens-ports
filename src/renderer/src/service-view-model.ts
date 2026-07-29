import type {
  ServiceDefinition,
  ServiceManager,
  ServiceScope,
  ServiceStatus,
  StartupBehavior,
} from "../../shared/services";

export type ServiceSort = "name" | "status" | "manager" | "startup";

export interface ServiceViewOptions {
  query: string;
  manager: ServiceManager | "all";
  status: ServiceStatus | "all";
  startup: StartupBehavior | "all";
  scope: ServiceScope | "all";
  includeApple: boolean;
  includeApplicationJobs: boolean;
  sort: ServiceSort;
  locale: string;
}

const STATUS_ORDER: Record<ServiceStatus, number> = {
  failed: 0,
  running: 1,
  loaded: 2,
  disabled: 3,
  stopped: 4,
  unknown: 5,
};

function searchValues(service: ServiceDefinition): string[] {
  return [
    service.displayName,
    service.label,
    service.program,
    service.plistPath,
    service.homebrewName,
    ...service.arguments,
    ...service.relatedProcesses.flatMap(({ processName, command }) => [
      processName,
      command,
    ]),
  ].filter((value): value is string => Boolean(value));
}

export function filterAndSortServices(
  services: readonly ServiceDefinition[],
  options: ServiceViewOptions,
): ServiceDefinition[] {
  const normalizedQuery = options.query.trim().toLowerCase();

  return services
    .filter((service) => {
      if (!options.includeApple && service.ownership === "apple") return false;
      if (
        !options.includeApplicationJobs &&
        service.ownership === "application"
      ) {
        return false;
      }
      if (
        options.manager !== "all" &&
        service.manager !== options.manager
      ) {
        return false;
      }
      if (options.status !== "all" && service.status !== options.status) {
        return false;
      }
      if (options.startup !== "all" && service.startup !== options.startup) {
        return false;
      }
      if (options.scope !== "all" && service.scope !== options.scope) {
        return false;
      }
      if (!normalizedQuery) return true;
      return searchValues(service).some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      );
    })
    .sort((left, right) => {
      if (options.sort === "status") {
        const difference =
          STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
        if (difference !== 0) return difference;
      } else if (options.sort === "manager") {
        const difference = left.manager.localeCompare(right.manager);
        if (difference !== 0) return difference;
      } else if (options.sort === "startup") {
        const difference = left.startup.localeCompare(right.startup);
        if (difference !== 0) return difference;
      }
      return left.displayName.localeCompare(
        right.displayName,
        options.locale,
      );
    });
}
