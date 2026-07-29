# HostLens Scanner Benchmarks

[English](BENCHMARKS.md) | [日本語](BENCHMARKS.ja.md) | [简体中文](BENCHMARKS.zh-CN.md)

This document records reproducible scanner checks rather than a marketing
performance claim. Results vary with the number of listeners, running
applications, permissions, storage load, and operating-system version.

## Version 0.6 local history reference run

Recorded on July 29, 2026:

| Item | Result |
| --- | --- |
| Platform | macOS, Apple Silicon (`arm64`) |
| Runtime | Node.js `v22.22.2` |
| Generated snapshot changes | 250 |
| Stored typed events | 500 |
| Record median | 0.97 ms |
| Record p95 | 1.86 ms |
| Record maximum | 5.81 ms |
| Read 500-event timeline | 1.43 ms |

The benchmark replaces one listener per observation, producing one Removed and
one Added event for each of 250 changes. The targets are record p95 and timeline
read below 25 ms with all expected events retained. This run passed all
targets.

```bash
yarn benchmark:history
```

## Version 0.5 reference run

Recorded on July 29, 2026:

| Item | Result |
| --- | --- |
| Platform | macOS, Apple Silicon (`arm64`) |
| Runtime | Node.js `v22.22.2` |
| Consecutive cached scans | 10 |
| Runtime installations | 5 |
| Packages | 34 |
| Collector warnings | 2 |
| Relationships missing evidence | 0 |
| Cold scan | 3,034.22 ms |
| Cached minimum | 0.01 ms |
| Cached median | 0.01 ms |
| Cached p95 | 0.03 ms |
| Cached maximum | 0.03 ms |

The cold measurement discovers observable runtime installations and queries
available package managers. Results are then cached in memory for 60 seconds
because this inventory changes much less frequently than sockets. Unavailable
package managers produce partial warnings instead of deleting successful
observations. The targets are a cold scan below six seconds, cached p95 below
100 ms, and evidence on every relationship. This run passed all targets.

```bash
yarn benchmark:runtimes
```

## Version 0.4 reference run

Recorded on July 29, 2026:

| Item | Result |
| --- | --- |
| Platform | macOS, Apple Silicon (`arm64`) |
| Runtime | Node.js `v22.22.2` |
| Consecutive scans | 20 |
| Interfaces in the final scan | 29 |
| Routes in the final scan | 52 |
| Socket relations | 30 |
| Relations missing evidence | 0 |
| Network minimum | 7.45 ms |
| Network median | 7.98 ms |
| Network p95 | 12.13 ms |
| Network maximum | 14.73 ms |

The network measurement runs the production macOS interface, route, DNS, and
relationship collector after obtaining the current port snapshot. The
completion target is a network p95 below one second and evidence on every
socket relation. This run passed both targets.

```bash
yarn benchmark:network
```

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
