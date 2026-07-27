import { performance } from "node:perf_hooks";
import { MacOsPortScanner } from "../src/main/scanners/macos-scanner.ts";

const runCount = Number.parseInt(process.argv[2] ?? "20", 10);
if (!Number.isInteger(runCount) || runCount < 1) {
  throw new Error("Run count must be a positive integer.");
}
if (process.platform !== "darwin") {
  throw new Error("The 0.2 reference benchmark currently requires macOS.");
}

const scanner = new MacOsPortScanner();
const durations: number[] = [];
let listenerCount = 0;
let partialCount = 0;
let missingIdentityEvidence = 0;
let missingSourceEvidence = 0;

for (let index = 0; index < runCount; index += 1) {
  const startedAt = performance.now();
  const snapshot = await scanner.scan();
  durations.push(performance.now() - startedAt);
  listenerCount = snapshot.listeners.length;
  partialCount = snapshot.listeners.filter(
    (listener) => listener.observationStatus === "partial",
  ).length;
  missingIdentityEvidence = snapshot.listeners.filter(
    (listener) => listener.identity.evidence.length === 0,
  ).length;
  missingSourceEvidence = snapshot.listeners.filter(
    (listener) => listener.launchSource.evidence.length === 0,
  ).length;
}

const sorted = [...durations].sort((left, right) => left - right);
const percentile = (value: number): number => {
  const index = Math.max(0, Math.ceil((value / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
};
const rounded = (value: number): number => Math.round(value * 100) / 100;

console.log(
  JSON.stringify(
    {
      platform: process.platform,
      architecture: process.arch,
      node: process.version,
      runs: runCount,
      listenersOnFinalScan: listenerCount,
      partialListenersOnFinalScan: partialCount,
      missingIdentityEvidence,
      missingSourceEvidence,
      durationMs: {
        minimum: rounded(sorted[0] ?? 0),
        median: rounded(percentile(50)),
        p95: rounded(percentile(95)),
        maximum: rounded(sorted.at(-1) ?? 0),
      },
      passed: percentile(95) < 2_000,
    },
    null,
    2,
  ),
);
