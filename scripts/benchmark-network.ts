import { performance } from "node:perf_hooks";
import { MacOsNetworkScanner } from "../src/main/network/macos-network-scanner.ts";
import { MacOsPortScanner } from "../src/main/scanners/macos-scanner.ts";

const runCount = Number.parseInt(process.argv[2] ?? "20", 10);
if (!Number.isInteger(runCount) || runCount < 1) {
  throw new Error("Run count must be a positive integer.");
}
if (process.platform !== "darwin") {
  throw new Error("The Network reference benchmark currently requires macOS.");
}

const portScanner = new MacOsPortScanner();
const networkScanner = new MacOsNetworkScanner();
const durations: number[] = [];
let interfaceCount = 0;
let routeCount = 0;
let resolverCount = 0;
let relationCount = 0;
let relationWithoutEvidenceCount = 0;

for (let index = 0; index < runCount; index += 1) {
  const portSnapshot = await portScanner.scan();
  const startedAt = performance.now();
  const networkSnapshot = await networkScanner.scan(portSnapshot.listeners);
  durations.push(performance.now() - startedAt);

  interfaceCount = networkSnapshot.interfaces.length;
  routeCount = networkSnapshot.routes.length;
  resolverCount = networkSnapshot.dnsResolvers.length;
  relationCount = networkSnapshot.socketRelations.length;
  relationWithoutEvidenceCount = networkSnapshot.socketRelations.filter(
    ({ evidence }) => evidence.length === 0,
  ).length;
}

const sorted = [...durations].sort((left, right) => left - right);
const percentile = (value: number): number => {
  const index = Math.max(0, Math.ceil((value / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
};
const rounded = (value: number): number => Math.round(value * 100) / 100;
const timing = {
  minimum: rounded(sorted[0] ?? 0),
  median: rounded(percentile(50)),
  p95: rounded(percentile(95)),
  maximum: rounded(sorted.at(-1) ?? 0),
};

console.log(
  JSON.stringify(
    {
      platform: process.platform,
      architecture: process.arch,
      node: process.version,
      runs: runCount,
      finalScan: {
        interfaces: interfaceCount,
        routes: routeCount,
        resolvers: resolverCount,
        socketRelations: relationCount,
        relationsMissingEvidence: relationWithoutEvidenceCount,
      },
      durationMs: timing,
      targets: {
        networkP95UnderMs: 1_000,
        noRelationMissingEvidence: true,
      },
      passed:
        timing.p95 < 1_000 &&
        relationWithoutEvidenceCount === 0,
    },
    null,
    2,
  ),
);
