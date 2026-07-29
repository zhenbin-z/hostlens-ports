import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, readdir, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, delimiter, dirname, join } from "node:path";
import { promisify } from "node:util";
import type { PortListener } from "../../shared/ports.ts";
import type {
  GlobalPackage,
  PackageManagerKind,
  RuntimeInstallation,
  RuntimeScanner,
  RuntimeSnapshot,
} from "../../shared/runtimes.ts";
import type { ServiceDefinition } from "../../shared/services.ts";
import {
  parseNpmGlobalList,
  parsePipList,
  parsePipxList,
  parsePnpmGlobalList,
  parseRuntimeVersion,
} from "./runtime-parser.ts";
import { relatePackagesToHost } from "./runtime-relations.ts";

const execFileAsync = promisify(execFile);
const MAX_BUFFER_BYTES = 16 * 1024 * 1024;
const COMMAND_TIMEOUT_MS = 3_000;
const INVENTORY_CACHE_MS = 60_000;

interface CommandObservation {
  stdout: string;
  warning?: string;
}

export interface RuntimeCommandRunner {
  run(executable: string, args: string[], label: string): Promise<CommandObservation>;
}

interface RuntimeInventoryCache {
  expiresAt: number;
  runtimes: RuntimeInstallation[];
  packages: GlobalPackage[];
  warnings: string[];
}

class DefaultRuntimeCommandRunner implements RuntimeCommandRunner {
  public async run(
    executable: string,
    args: string[],
    label: string,
  ): Promise<CommandObservation> {
    try {
      const { stdout } = await execFileAsync(executable, args, {
        encoding: "utf8",
        maxBuffer: MAX_BUFFER_BYTES,
        timeout: COMMAND_TIMEOUT_MS,
      });
      return { stdout };
    } catch (cause) {
      const partial = cause as {
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      return {
        stdout: partial.stdout ?? "",
        warning: `${label} was unavailable: ${partial.stderr?.trim() || partial.message || "unknown error"}`,
      };
    }
  }
}

async function executableFiles(
  directories: string[],
  names: string[],
): Promise<string[]> {
  const candidates = directories.flatMap((directory) =>
    names.map((name) => join(directory, name)),
  );
  const available = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        await access(candidate, constants.X_OK);
        return {
          candidate,
          canonical: await realpath(candidate),
        };
      } catch {
        return undefined;
      }
    }),
  );
  const byCanonicalPath = new Map<string, string>();
  for (const value of available) {
    if (!value || byCanonicalPath.has(value.canonical)) continue;
    byCanonicalPath.set(value.canonical, value.candidate);
  }
  return [...byCanonicalPath.values()];
}

async function versionManagerBinDirectories(): Promise<string[]> {
  const roots = [
    join(homedir(), ".nvm/versions/node"),
    join(homedir(), ".pyenv/versions"),
  ];
  const directories: string[] = [];
  for (const root of roots) {
    try {
      const entries = await readdir(root, { withFileTypes: true });
      directories.push(
        ...entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => join(root, entry.name, "bin")),
      );
    } catch {
      // Version managers are optional.
    }
  }
  return directories;
}

async function discoverExecutables(names: string[]): Promise<string[]> {
  const pathDirectories = (process.env.PATH ?? "")
    .split(delimiter)
    .filter(
      (directory) =>
        Boolean(directory) &&
        !directory.includes("/.cache/codex-runtimes/") &&
        !/\/(?:yarn|npm)-{2}[^/]+$/.test(directory),
    );
  const managerDirectories = await versionManagerBinDirectories();
  return executableFiles(
    [
      ...pathDirectories,
      ...managerDirectories,
      "/opt/homebrew/bin",
      "/usr/local/bin",
      "/usr/bin",
    ],
    names,
  );
}

function packageManagerKind(executable: string): PackageManagerKind | undefined {
  const name = basename(executable);
  if (name === "npm" || name === "yarn" || name === "pnpm" || name === "pipx") {
    return name;
  }
  if (name === "pip" || /^pip\d+(?:\.\d+)?$/.test(name)) return "pip";
  return undefined;
}

function packagesFor(
  manager: PackageManagerKind,
  output: string,
  executable: string,
  collectedAt: string,
): GlobalPackage[] {
  switch (manager) {
    case "npm":
      return parseNpmGlobalList(output, executable, collectedAt);
    case "yarn":
      return parseNpmGlobalList(output, executable, collectedAt, "yarn");
    case "pnpm":
      return parsePnpmGlobalList(output, executable, collectedAt);
    case "pip":
      return parsePipList(output, executable, collectedAt);
    case "pipx":
      return parsePipxList(output, executable, collectedAt);
  }
}

function inventoryArgs(manager: PackageManagerKind): string[] {
  switch (manager) {
    case "npm":
      return ["ls", "-g", "--depth=0", "--json", "--long"];
    case "yarn":
      return ["global", "list", "--json"];
    case "pnpm":
      return ["list", "-g", "--depth=0", "--json"];
    case "pip":
      return ["list", "--format=json"];
    case "pipx":
      return ["list", "--json"];
  }
}

function bindPackagesToRuntimes(
  packages: GlobalPackage[],
  runtimes: RuntimeInstallation[],
): void {
  for (const pkg of packages) {
    const managerEnvironment = dirname(dirname(pkg.managerExecutable));
    const kind = pkg.manager === "pip" || pkg.manager === "pipx" ? "python" : "node";
    const runtime =
      runtimes.find(
        (item) =>
          item.kind === kind &&
          (item.environmentPath === managerEnvironment ||
            item.executable.startsWith(`${managerEnvironment}/`)),
      ) ?? runtimes.find((item) => item.kind === kind);
    if (runtime) pkg.runtimeId = runtime.id;
  }
}

export class UnixRuntimeScanner implements RuntimeScanner {
  private readonly runner: RuntimeCommandRunner;
  private readonly platform: "darwin" | "linux";
  private inventoryCache: RuntimeInventoryCache | undefined;

  public constructor(
    platform: "darwin" | "linux",
    runner: RuntimeCommandRunner = new DefaultRuntimeCommandRunner(),
  ) {
    this.platform = platform;
    this.runner = runner;
  }

  public async scan(
    listeners: PortListener[],
    services: ServiceDefinition[],
  ): Promise<RuntimeSnapshot> {
    const collectedAt = new Date().toISOString();
    const inventory = await this.inspectInventory(collectedAt);

    return {
      scannedAt: collectedAt,
      platform: this.platform,
      runtimes: inventory.runtimes,
      packages: inventory.packages,
      relationships: relatePackagesToHost(
        inventory.packages,
        listeners,
        services,
        collectedAt,
      ),
      warnings: inventory.warnings,
    };
  }

  private async inspectInventory(
    collectedAt: string,
  ): Promise<RuntimeInventoryCache> {
    if (this.inventoryCache && this.inventoryCache.expiresAt > Date.now()) {
      return this.inventoryCache;
    }

    const [nodeExecutables, pythonExecutables, managerExecutables] =
      await Promise.all([
        discoverExecutables(["node"]),
        discoverExecutables(["python3", "python"]),
        discoverExecutables(["npm", "yarn", "pnpm", "pip3", "pip", "pipx"]),
      ]);

    const warnings: string[] = [];
    const runtimeResults = await Promise.all([
      ...nodeExecutables.map(async (executable) => {
        const result = await this.runner.run(
          executable,
          ["--version"],
          `Node runtime ${executable}`,
        );
        if (result.warning) warnings.push(result.warning);
        return parseRuntimeVersion("node", executable, result.stdout, collectedAt);
      }),
      ...pythonExecutables.map(async (executable) => {
        const result = await this.runner.run(
          executable,
          ["--version"],
          `Python runtime ${executable}`,
        );
        if (result.warning) warnings.push(result.warning);
        return parseRuntimeVersion("python", executable, result.stdout, collectedAt);
      }),
    ]);
    const runtimes = runtimeResults.filter(
      (runtime): runtime is RuntimeInstallation => Boolean(runtime),
    );

    const packageResults = await Promise.all(
      managerExecutables.map(async (executable) => {
        const manager = packageManagerKind(executable);
        if (!manager) return [];
        const result = await this.runner.run(
          executable,
          inventoryArgs(manager),
          `${manager} package inventory ${executable}`,
        );
        if (result.warning) warnings.push(result.warning);
        return packagesFor(manager, result.stdout, executable, collectedAt);
      }),
    );
    const packages = packageResults.flat();
    bindPackagesToRuntimes(packages, runtimes);

    this.inventoryCache = {
      expiresAt: Date.now() + INVENTORY_CACHE_MS,
      runtimes,
      packages,
      warnings,
    };
    return this.inventoryCache;
  }
}

export class MacOsRuntimeScanner extends UnixRuntimeScanner {
  public constructor(runner?: RuntimeCommandRunner) {
    super("darwin", runner);
  }
}
