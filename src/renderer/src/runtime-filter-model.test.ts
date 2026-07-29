import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  GlobalPackage,
  PackageManagerKind,
} from "../../shared/runtimes.ts";
import {
  availablePackageManagers,
  packageMatchesRuntimeFilter,
  packageRuntimeKind,
} from "./runtime-filter-model.ts";

function observedPackage(
  manager: PackageManagerKind,
  name = `${manager}-package`,
  runtimeId?: string,
): GlobalPackage {
  return {
    id: `${manager}:${name}`,
    name,
    version: "1.0.0",
    manager,
    managerExecutable: `/usr/local/bin/${manager}`,
    runtimeId,
    executables: [],
    observationStatus: "complete",
    unavailableFields: [],
    confidence: "high",
    evidence: [],
  };
}

describe("runtime package filters", () => {
  const packages = [
    observedPackage("pip"),
    observedPackage("npm"),
    observedPackage("pipx"),
    observedPackage("yarn"),
    observedPackage("pnpm"),
  ];

  it("maps package managers to their runtime families", () => {
    assert.equal(packageRuntimeKind("npm"), "node");
    assert.equal(packageRuntimeKind("yarn"), "node");
    assert.equal(packageRuntimeKind("pnpm"), "node");
    assert.equal(packageRuntimeKind("pip"), "python");
    assert.equal(packageRuntimeKind("pipx"), "python");
  });

  it("shows only Node.js package managers for Node.js", () => {
    assert.deepEqual(availablePackageManagers(packages, "kind:node"), [
      "npm",
      "yarn",
      "pnpm",
    ]);
  });

  it("shows only Python package managers for Python", () => {
    assert.deepEqual(availablePackageManagers(packages, "kind:python"), [
      "pip",
      "pipx",
    ]);
  });

  it("keeps a stable manager order and omits unobserved managers", () => {
    assert.deepEqual(
      availablePackageManagers(
        [observedPackage("pipx"), observedPackage("npm")],
        "all",
      ),
      ["npm", "pipx"],
    );
  });

  it("filters managers and packages to one runtime installation", () => {
    const versionedPackages = [
      observedPackage("npm", "codex-node-22", "node-22"),
      observedPackage("npm", "codex-node-25", "node-25"),
      observedPackage("yarn", "yarn-node-22", "node-22"),
      observedPackage("pip", "openpyxl-python-313", "python-313"),
    ];

    assert.deepEqual(
      availablePackageManagers(versionedPackages, "runtime:node-22"),
      ["npm", "yarn"],
    );
    assert.deepEqual(
      versionedPackages
        .filter((pkg) =>
          packageMatchesRuntimeFilter(pkg, "runtime:node-22"),
        )
        .map(({ name }) => name),
      ["codex-node-22", "yarn-node-22"],
    );
  });
});
