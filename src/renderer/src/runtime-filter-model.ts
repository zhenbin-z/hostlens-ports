import type {
  GlobalPackage,
  PackageManagerKind,
  RuntimeKind,
} from "../../shared/runtimes";

const packageManagerOrder: readonly PackageManagerKind[] = [
  "npm",
  "yarn",
  "pnpm",
  "pip",
  "pipx",
];

export type RuntimeFilter =
  | "all"
  | `kind:${RuntimeKind}`
  | `runtime:${string}`;

export function packageRuntimeKind(
  manager: PackageManagerKind,
): RuntimeKind {
  return manager === "pip" || manager === "pipx" ? "python" : "node";
}

export function packageMatchesRuntimeFilter(
  pkg: GlobalPackage,
  runtimeFilter: RuntimeFilter,
): boolean {
  if (runtimeFilter === "all") return true;

  if (runtimeFilter.startsWith("kind:")) {
    return packageRuntimeKind(pkg.manager) === runtimeFilter.slice(5);
  }

  return pkg.runtimeId === runtimeFilter.slice(8);
}

export function availablePackageManagers(
  packages: readonly GlobalPackage[],
  runtimeFilter: RuntimeFilter,
): PackageManagerKind[] {
  const observed = new Set(
    packages
      .filter((pkg) => packageMatchesRuntimeFilter(pkg, runtimeFilter))
      .map((pkg) => pkg.manager),
  );

  return packageManagerOrder.filter((manager) => observed.has(manager));
}
