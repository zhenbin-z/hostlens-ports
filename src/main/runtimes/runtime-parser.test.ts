import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseNpmGlobalList,
  parsePipList,
  parsePipxList,
  parsePnpmGlobalList,
  parseRuntimeVersion,
} from "./runtime-parser.ts";

const collectedAt = "2026-07-29T02:00:00.000Z";

describe("runtime and global package parsers", () => {
  it("classifies nvm Node and Homebrew Python runtimes", () => {
    const node = parseRuntimeVersion(
      "node",
      "/Users/test/.nvm/versions/node/v22.22.2/bin/node",
      "v22.22.2\n",
      collectedAt,
    );
    const python = parseRuntimeVersion(
      "python",
      "/opt/homebrew/bin/python3",
      "Python 3.13.5\n",
      collectedAt,
    );

    assert.equal(node?.source, "nvm");
    assert.equal(node?.version, "22.22.2");
    assert.equal(python?.source, "homebrew");
    assert.equal(python?.version, "3.13.5");
  });

  it("parses scoped npm package names, versions, paths, and bins", () => {
    const packages = parseNpmGlobalList(
      JSON.stringify({
        path: "/Users/test/.nvm/versions/node/v22.22.2/lib",
        dependencies: {
          "@openai/codex": {
            version: "1.2.3",
            path: "/global/node_modules/@openai/codex",
            bin: { codex: "bin/codex.js" },
          },
        },
      }),
      "/Users/test/.nvm/versions/node/v22.22.2/bin/npm",
      collectedAt,
    );

    assert.equal(packages[0]?.name, "@openai/codex");
    assert.equal(packages[0]?.version, "1.2.3");
    assert.deepEqual(packages[0]?.executables, ["codex"]);
    assert.equal(packages[0]?.observationStatus, "complete");
  });

  it("parses Yarn Classic newline-delimited tree output", () => {
    const packages = parseNpmGlobalList(
      [
        JSON.stringify({ type: "info", data: "yarn global v1.22.22" }),
        JSON.stringify({
          type: "tree",
          data: {
            type: "list",
            trees: [
              { name: "typescript@5.9.2", children: [], hint: null },
              { name: "@openai/codex@1.2.3", children: [], hint: null },
            ],
          },
        }),
      ].join("\n"),
      "/opt/homebrew/bin/yarn",
      collectedAt,
      "yarn",
    );

    assert.deepEqual(
      packages.map(({ name, version }) => ({ name, version })),
      [
        { name: "typescript", version: "5.9.2" },
        { name: "@openai/codex", version: "1.2.3" },
      ],
    );
  });

  it("parses pnpm dependency inventories defensively", () => {
    const packages = parsePnpmGlobalList(
      JSON.stringify([
        {
          path: "/Users/test/Library/pnpm/global/5",
          dependencies: {
            typescript: {
              version: "6.0.0",
              path: "/Users/test/Library/pnpm/global/5/typescript",
            },
          },
        },
      ]),
      "/opt/homebrew/bin/pnpm",
      collectedAt,
    );

    assert.equal(packages[0]?.manager, "pnpm");
    assert.equal(packages[0]?.name, "typescript");
    assert.equal(packages[0]?.environmentPath, "/Users/test/Library/pnpm/global/5");
  });

  it("keeps pip environment packages as partial when paths are unavailable", () => {
    const packages = parsePipList(
      JSON.stringify([{ name: "httpx", version: "0.28.1" }]),
      "/opt/homebrew/bin/pip3",
      collectedAt,
    );

    assert.equal(packages[0]?.manager, "pip");
    assert.equal(packages[0]?.observationStatus, "partial");
    assert.ok(packages[0]?.unavailableFields.includes("installPath"));
  });

  it("extracts pipx applications without assuming the venv key is the package", () => {
    const packages = parsePipxList(
      JSON.stringify({
        venvs: {
          black_env: {
            metadata: {
              main_package: {
                package: "black",
                package_version: "25.1.0",
                app_paths: ["/Users/test/.local/bin/black", "/Users/test/.local/bin/blackd"],
              },
            },
          },
        },
      }),
      "/opt/homebrew/bin/pipx",
      collectedAt,
    );

    assert.equal(packages[0]?.name, "black");
    assert.deepEqual(packages[0]?.executables, ["black", "blackd"]);
  });
});
