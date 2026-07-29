import { basename, dirname } from "node:path";
import type {
  GlobalPackage,
  PackageManagerKind,
  RuntimeEvidence,
  RuntimeInstallation,
  RuntimeKind,
  RuntimeSource,
} from "../../shared/runtimes.ts";

function sourceFromPath(path: string): RuntimeSource {
  if (path.includes("/.nvm/")) return "nvm";
  if (path.includes("/.pyenv/")) return "pyenv";
  if (
    path.startsWith("/opt/homebrew/") ||
    path.startsWith("/usr/local/Cellar/") ||
    path.startsWith("/usr/local/opt/")
  ) {
    return "homebrew";
  }
  if (
    path.startsWith("/usr/bin/") ||
    path.startsWith("/bin/") ||
    path.startsWith("/System/")
  ) {
    return "system";
  }
  return path.startsWith("/") ? "standalone" : "unknown";
}

function evidence(
  collectedAt: string,
  source: string,
  detail: string,
  fields: RuntimeEvidence["fields"],
  kind: RuntimeEvidence["kind"] = "observed",
  confidence: RuntimeEvidence["confidence"] = "high",
): RuntimeEvidence {
  return { collectedAt, source, detail, fields, kind, confidence };
}

export function parseRuntimeVersion(
  kind: RuntimeKind,
  executable: string,
  output: string,
  collectedAt: string,
): RuntimeInstallation | undefined {
  const match =
    kind === "node"
      ? output.trim().match(/^v?(\d+\.\d+\.\d+(?:[-+][^\s]+)?)$/)
      : output.trim().match(/^Python\s+(\d+\.\d+(?:\.\d+)?(?:[^\s]*)?)/i);
  if (!match?.[1]) return undefined;
  const runtimeSource = sourceFromPath(executable);

  return {
    id: `runtime:${kind}:${executable}`,
    kind,
    version: match[1],
    executable,
    source: runtimeSource,
    environmentPath: dirname(dirname(executable)),
    observationStatus: "complete",
    unavailableFields: [],
    confidence: "high",
    evidence: [
      evidence(
        collectedAt,
        `${kind} --version`,
        `${executable} reported ${match[1]}`,
        ["kind", "version", "executable", "environment"],
      ),
      evidence(
        collectedAt,
        "HostLens runtime source classification",
        `${executable} was classified as ${runtimeSource}`,
        ["source"],
        "inferred",
        runtimeSource === "unknown" ? "low" : "high",
      ),
    ],
  };
}

interface PackageSeed {
  name: string;
  version: string;
  installPath?: string;
  executables?: string[];
}

function packageObservation(
  manager: PackageManagerKind,
  managerExecutable: string,
  seed: PackageSeed,
  collectedAt: string,
  sourceDetail: string,
  environmentPath?: string,
): GlobalPackage {
  const unavailableFields: GlobalPackage["unavailableFields"] = [
    ...(!seed.installPath ? (["installPath"] as const) : []),
    ...(!seed.executables || seed.executables.length === 0
      ? (["executables"] as const)
      : []),
  ];
  return {
    id: `package:${manager}:${managerExecutable}:${seed.name}`,
    name: seed.name,
    version: seed.version,
    manager,
    managerExecutable,
    installPath: seed.installPath,
    environmentPath,
    executables: [...new Set(seed.executables ?? [])],
    observationStatus:
      unavailableFields.length === 0 ? "complete" : "partial",
    unavailableFields,
    confidence: "high",
    evidence: [
      evidence(
        collectedAt,
        `${manager} package inventory`,
        sourceDetail,
        [
          "packageName",
          "packageVersion",
          "manager",
          ...(seed.installPath ? (["installPath"] as const) : []),
          ...(seed.executables?.length ? (["executables"] as const) : []),
        ],
      ),
    ],
  };
}

function executableNames(value: unknown): string[] {
  if (typeof value === "string") return [basename(value)];
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => basename(item));
  }
  if (value && typeof value === "object") return Object.keys(value);
  return [];
}

function parseJsonOrJsonLines(output: string): unknown[] {
  try {
    return [JSON.parse(output)];
  } catch {
    return output
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      });
  }
}

export function parseNpmGlobalList(
  output: string,
  managerExecutable: string,
  collectedAt: string,
  manager: "npm" | "yarn" = "npm",
): GlobalPackage[] {
  const documents = parseJsonOrJsonLines(output);
  const parsed =
    manager === "yarn"
      ? documents.find((document) => {
          if (!document || typeof document !== "object") return false;
          const record = document as { data?: { trees?: unknown } };
          return Array.isArray(record.data?.trees);
        })
      : documents[0];
  if (!parsed || typeof parsed !== "object") return [];
  const root = parsed as {
    path?: unknown;
    data?: { trees?: unknown };
    dependencies?: Record<string, unknown>;
  };

  if (manager === "yarn" && Array.isArray(root.data?.trees)) {
    return root.data.trees.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const nameValue = (item as { name?: unknown }).name;
      if (typeof nameValue !== "string") return [];
      const at = nameValue.lastIndexOf("@");
      const name = at > 0 ? nameValue.slice(0, at) : nameValue;
      const version = at > 0 ? nameValue.slice(at + 1) : "unknown";
      return [
        packageObservation(
          manager,
          managerExecutable,
          { name, version },
          collectedAt,
          `Yarn reported ${nameValue}`,
        ),
      ];
    });
  }

  return Object.entries(root.dependencies ?? {}).flatMap(([name, value]) => {
    if (!value || typeof value !== "object") return [];
    const record = value as {
      version?: unknown;
      path?: unknown;
      resolved?: unknown;
      bin?: unknown;
    };
    const version =
      typeof record.version === "string" ? record.version : "unknown";
    const installPath =
      typeof record.path === "string"
        ? record.path
        : typeof root.path === "string"
          ? `${root.path}/node_modules/${name}`
          : undefined;
    return [
      packageObservation(
        manager,
        managerExecutable,
        {
          name,
          version,
          installPath,
          executables: executableNames(record.bin),
        },
        collectedAt,
        `${manager} reported ${name}@${version}`,
        typeof root.path === "string" ? root.path : undefined,
      ),
    ];
  });
}

export function parsePnpmGlobalList(
  output: string,
  managerExecutable: string,
  collectedAt: string,
): GlobalPackage[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    return [];
  }
  const roots = Array.isArray(parsed) ? parsed : [parsed];
  return roots.flatMap((root) => {
    if (!root || typeof root !== "object") return [];
    const record = root as {
      path?: unknown;
      dependencies?: Record<string, unknown>;
    };
    return Object.entries(record.dependencies ?? {}).flatMap(([name, value]) => {
      if (!value || typeof value !== "object") return [];
      const dependency = value as { version?: unknown; path?: unknown };
      const version =
        typeof dependency.version === "string"
          ? dependency.version
          : "unknown";
      return [
        packageObservation(
          "pnpm",
          managerExecutable,
          {
            name,
            version,
            installPath:
              typeof dependency.path === "string"
                ? dependency.path
                : undefined,
          },
          collectedAt,
          `pnpm reported ${name}@${version}`,
          typeof record.path === "string" ? record.path : undefined,
        ),
      ];
    });
  });
}

export function parsePipList(
  output: string,
  managerExecutable: string,
  collectedAt: string,
): GlobalPackage[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as { name?: unknown; version?: unknown };
    if (typeof record.name !== "string") return [];
    const version =
      typeof record.version === "string" ? record.version : "unknown";
    return [
      packageObservation(
        "pip",
        managerExecutable,
        { name: record.name, version },
        collectedAt,
        `pip reported ${record.name}==${version}`,
        dirname(dirname(managerExecutable)),
      ),
    ];
  });
}

export function parsePipxList(
  output: string,
  managerExecutable: string,
  collectedAt: string,
): GlobalPackage[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const venvs = (parsed as { venvs?: Record<string, unknown> }).venvs ?? {};
  return Object.entries(venvs).flatMap(([venvName, value]) => {
    if (!value || typeof value !== "object") return [];
    const mainPackage = (
      value as {
        metadata?: {
          main_package?: {
            package?: unknown;
            package_version?: unknown;
            app_paths?: unknown;
          };
        };
      }
    ).metadata?.main_package;
    const name =
      typeof mainPackage?.package === "string"
        ? mainPackage.package
        : venvName;
    const version =
      typeof mainPackage?.package_version === "string"
        ? mainPackage.package_version
        : "unknown";
    return [
      packageObservation(
        "pipx",
        managerExecutable,
        {
          name,
          version,
          executables: executableNames(mainPackage?.app_paths),
        },
        collectedAt,
        `pipx reported ${name}==${version}`,
      ),
    ];
  });
}

export { sourceFromPath };
