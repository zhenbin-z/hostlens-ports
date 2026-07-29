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

export function packageRuntimeKind(
  manager: PackageManagerKind,
): RuntimeKind {
  return manager === "pip" || manager === "pipx" ? "python" : "node";
}

export function availablePackageManagers(
  packages: readonly GlobalPackage[],
  runtimeKind: RuntimeKind | "all",
): PackageManagerKind[] {
  const observed = new Set(
    packages
      .filter(
        (pkg) =>
          runtimeKind === "all" ||
          packageRuntimeKind(pkg.manager) === runtimeKind,
      )
      .map((pkg) => pkg.manager),
  );

  return packageManagerOrder.filter((manager) => observed.has(manager));
}
