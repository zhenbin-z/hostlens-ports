import { performance } from "node:perf_hooks";
import { MacOsRuntimeScanner } from "../src/main/runtimes/macos-runtime-scanner.ts";

const runCount = Number.parseInt(process.argv[2] ?? "10", 10);
if (!Number.isInteger(runCount) || runCount < 2) {
  throw new Error("Run count must be an integer of at least 2.");
}
if (process.platform !== "darwin") {
  throw new Error("The runtime reference benchmark currently requires macOS.");
}

const scanner = new MacOsRuntimeScanner();
const durations: number[] = [];
let runtimeCount = 0;
let packageCount = 0;
let relationshipWithoutEvidenceCount = 0;
let warningCount = 0;

for (let index = 0; index < runCount; index += 1) {
  const startedAt = performance.now();
  const snapshot = await scanner.scan([], []);
  durations.push(performance.now() - startedAt);
  runtimeCount = snapshot.runtimes.length;
  packageCount = snapshot.packages.length;
  warningCount = snapshot.warnings.length;
  relationshipWithoutEvidenceCount = snapshot.relationships.filter(
    ({ evidence }) => evidence.length === 0,
  ).length;
}

const warmDurations = durations.slice(1).sort((left, right) => left - right);
const percentile = (values: number[], percentileValue: number): number => {
  const index = Math.max(
    0,
    Math.ceil((percentileValue / 100) * values.length) - 1,
  );
  return values[index] ?? 0;
};
const rounded = (value: number): number => Math.round(value * 100) / 100;
const warmTiming = {
  minimum: rounded(warmDurations[0] ?? 0),
  median: rounded(percentile(warmDurations, 50)),
  p95: rounded(percentile(warmDurations, 95)),
  maximum: rounded(warmDurations.at(-1) ?? 0),
};
const coldDuration = rounded(durations[0] ?? 0);

console.log(
  JSON.stringify(
    {
      platform: process.platform,
      architecture: process.arch,
      node: process.version,
      runs: runCount,
      finalScan: {
        runtimes: runtimeCount,
        packages: packageCount,
        warnings: warningCount,
        relationshipsMissingEvidence: relationshipWithoutEvidenceCount,
      },
      durationMs: {
        cold: coldDuration,
        warm: warmTiming,
      },
      targets: {
        coldUnderMs: 6_000,
        warmP95UnderMs: 100,
        noRelationshipMissingEvidence: true,
      },
      passed:
        coldDuration < 6_000 &&
        warmTiming.p95 < 100 &&
        relationshipWithoutEvidenceCount === 0,
    },
    null,
    2,
  ),
);
