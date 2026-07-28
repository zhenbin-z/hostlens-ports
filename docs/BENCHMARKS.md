# HostLens Scanner Benchmarks

[English](BENCHMARKS.md) | [日本語](BENCHMARKS.ja.md) | [简体中文](BENCHMARKS.zh-CN.md)

This document records reproducible scanner checks rather than a marketing
performance claim. Results vary with the number of listeners, running
applications, permissions, storage load, and operating-system version.

## Version 0.3 reference run

Recorded on July 28, 2026:

| Item | Result |
| --- | --- |
| Platform | macOS, Apple Silicon (`arm64`) |
| Runtime | Node.js `v22.22.2` |
| Consecutive scans | 20 |
| Listeners in the final scan | 29 |
| Services in the final scan | 535 |
| Services visible by default | 18 |
| Services related to listening ports | 5 |
| Services missing evidence | 0 |
| Combined minimum | 710.34 ms |
| Combined median | 726.53 ms |
| Combined p95 | 751.64 ms |
| Combined maximum | 2,262.05 ms |

The combined measurement runs the production port scanner followed by the
Services scanner and relationship resolver. The first scan also populates the
configured-service cache. The 0.3 completion target is a combined p95 below
three seconds and evidence on every service. This run passed both targets.

The macOS user launchd domain contains hundreds of runtime jobs. Most are
partial observations because launchd exposes a label and state but no
configured plist or program path. Apple-owned and transient application jobs
are retained for technical inspection but hidden from the default view; 18
configured third-party services remained visible in this reference run.

Run the same benchmark locally:

```bash
yarn benchmark:services
```

## Version 0.2 reference run

Recorded on July 27, 2026:

| Item | Result |
| --- | --- |
| Platform | macOS, Apple Silicon (`arm64`) |
| Runtime | Node.js `v22.22.2` |
| Consecutive scans | 20 |
| Listeners in the final scan | 30 |
| Partial observations | 0 |
| Missing identity evidence | 0 |
| Missing source evidence | 0 |
| Minimum | 67.38 ms |
| Median | 69.78 ms |
| p95 | 78.24 ms |
| Maximum | 100.45 ms |

The 0.2 completion target is a p95 below two seconds under a normal
development workload. This run passed that target.

Run the same benchmark locally:

```bash
yarn benchmark:scanner
```

The benchmark uses the production macOS scanner, performs 20 sequential
read-only observations, verifies that every listener has identity and source
evidence, then reports latency statistics. It does not persist or upload the
observed machine information.
