import { performance } from "node:perf_hooks";
import { MacOsPortScanner } from "../src/main/scanners/macos-scanner.ts";
import { MacOsServiceScanner } from "../src/main/services/macos-service-scanner.ts";

const runCount = Number.parseInt(process.argv[2] ?? "20", 10);
if (!Number.isInteger(runCount) || runCount < 1) {
  throw new Error("Run count must be a positive integer.");
}
if (process.platform !== "darwin") {
  throw new Error("The Services reference benchmark currently requires macOS.");
}

const portScanner = new MacOsPortScanner();
const serviceScanner = new MacOsServiceScanner();
const portDurations: number[] = [];
const serviceDurations: number[] = [];
const combinedDurations: number[] = [];
let listenerCount = 0;
let serviceCount = 0;
let defaultVisibleCount = 0;
let partialCount = 0;
let missingEvidenceCount = 0;
let relatedServiceCount = 0;

for (let index = 0; index < runCount; index += 1) {
  const combinedStartedAt = performance.now();
  const portStartedAt = performance.now();
  const portSnapshot = await portScanner.scan();
  portDurations.push(performance.now() - portStartedAt);

  const serviceStartedAt = performance.now();
  const serviceSnapshot = await serviceScanner.scan(portSnapshot.listeners);
  serviceDurations.push(performance.now() - serviceStartedAt);
  combinedDurations.push(performance.now() - combinedStartedAt);

  listenerCount = portSnapshot.listeners.length;
  serviceCount = serviceSnapshot.services.length;
  defaultVisibleCount = serviceSnapshot.services.filter(
    ({ ownership }) =>
      ownership !== "apple" && ownership !== "application",
  ).length;
  partialCount = serviceSnapshot.services.filter(
    ({ observationStatus }) => observationStatus === "partial",
  ).length;
  missingEvidenceCount = serviceSnapshot.services.filter(
    ({ evidence }) => evidence.length === 0,
  ).length;
  relatedServiceCount = serviceSnapshot.services.filter(
    ({ relatedListenerIds }) => relatedListenerIds.length > 0,
  ).length;
}

function summarize(durations: number[]): {
  minimum: number;
  median: number;
  p95: number;
  maximum: number;
} {
  const sorted = [...durations].sort((left, right) => left - right);
  const percentile = (value: number): number => {
    const index = Math.max(0, Math.ceil((value / 100) * sorted.length) - 1);
    return sorted[index] ?? 0;
  };
  const rounded = (value: number): number =>
    Math.round(value * 100) / 100;

  return {
    minimum: rounded(sorted[0] ?? 0),
    median: rounded(percentile(50)),
    p95: rounded(percentile(95)),
    maximum: rounded(sorted.at(-1) ?? 0),
  };
}

const portTiming = summarize(portDurations);
const serviceTiming = summarize(serviceDurations);
const combinedTiming = summarize(combinedDurations);

console.log(
  JSON.stringify(
    {
      platform: process.platform,
      architecture: process.arch,
      node: process.version,
      runs: runCount,
      finalScan: {
        listeners: listenerCount,
        services: serviceCount,
        defaultVisibleServices: defaultVisibleCount,
        partialServices: partialCount,
        servicesMissingEvidence: missingEvidenceCount,
        servicesRelatedToPorts: relatedServiceCount,
      },
      durationMs: {
        ports: portTiming,
        services: serviceTiming,
        combined: combinedTiming,
      },
      targets: {
        combinedP95UnderMs: 3_000,
        noServiceMissingEvidence: true,
      },
      passed:
        combinedTiming.p95 < 3_000 &&
        missingEvidenceCount === 0,
    },
    null,
    2,
  ),
);
