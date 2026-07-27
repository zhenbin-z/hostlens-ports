# HostLens Roadmap

[English](ROADMAP.md) | [日本語](ROADMAP.ja.md) | [简体中文](ROADMAP.zh-CN.md)

This roadmap describes product order, not fixed dates. Later phases may change
as HostLens is tested on real macOS and Linux environments.

The guiding sequence is:

```text
See
  ↓
Identify
  ↓
Relate
  ↓
Remember
  ↓
Explain
  ↓
Advise
  ↓
Operate safely
```

## Released: 0.1.0 — See listening ports

Version 0.1.0 established the first useful product:

- live macOS TCP listener scanning;
- PID, parent PID, user, command, and executable-oriented details;
- local-only and network-facing classification;
- process and port filters and sorting;
- menu bar and full application windows;
- English, Japanese, and Simplified Chinese; and
- a read-only, local-first architecture.

## In development: 0.2.0 — Host Identity

Version 0.2 should answer:

> **Who is really behind this port, where did it come from, and what changed
> during this HostLens session?**

### Scanner reliability

- improve PID, PPID, user, command, executable, and working-directory
  collection;
- inspect the parent-process chain without blocking the complete scan;
- make collection failures and permission restrictions explicit;
- continue improving macOS parser fixtures and regression coverage; and
- preserve usable socket observations when process enrichment fails.

### Process and project identity

- recognize common development servers such as Vite, Next.js, React tooling,
  Nuxt, and webpack;
- derive project identity from command, executable, working directory, and
  parent processes;
- separate the raw process name from the friendly display identity;
- retain the original evidence used for every attribution; and
- attach a confidence level to inferred identities.

### Source attribution

Start with:

- launchd;
- Homebrew Services;
- Docker Desktop and containers;
- npm, yarn, and pnpm package scripts;
- native macOS applications; and
- manual or unknown launch sources.

### Session changes

Without adding a database:

- keep the previous successful scan in memory;
- identify new, changed, and closed listeners;
- show changes in the application and menu bar quick view; and
- reset the history when HostLens exits.

### 0.2 completion criteria

The release should not be considered complete only because fields exist.

- Existing scanner tests continue to pass.
- Representative sanitized fixtures cover supported development-server and
  source-attribution patterns.
- Every inferred identity includes evidence and confidence.
- Missing process details degrade to an unknown or partial result without
  losing the socket.
- A normal scan remains responsive on a developer Mac.
- New, changed, and closed states are deterministic across identical snapshots.
- HostLens remains read-only and sends no machine information over the network.

### Explicitly out of scope for 0.2

- a database or persistent history;
- UDP scanning;
- full macOS host inventory;
- Linux GUI parity;
- MCP;
- LLM or chat features;
- firewall modification;
- process termination; and
- automatic remediation.

## Next: Unified Host Model and macOS Inspector

After 0.2 validates Host Identity:

- formalize `Process`, `Socket`, `Project`, `LaunchSource`, and `Evidence`;
- add launchd services and startup items;
- add Homebrew Services and Docker relationships;
- show network interfaces, routes, DNS, and VPN context;
- add a macOS host overview; and
- introduce new resource types only with real collectors and UI.

## Linux first-class support

Linux will use the shared host concepts with platform-specific evidence.

Recommended order:

1. processes and listening sockets;
2. systemd services;
3. systemd timers and cron;
4. startup-source attribution;
5. firewalld;
6. journal summaries;
7. Docker and Podman; and
8. package and runtime inventory.

Initial work should target Ubuntu and Red Hat Enterprise Linux. Headless and
multi-host operation are separate later concerns.

## Persistent changes and alerts

Once normalized identities are stable:

- persist lightweight snapshots;
- create typed `ChangeEvent` records;
- provide a timeline;
- support alert rules and cooldowns;
- provide desktop notifications; and
- let users mark resources they care about.

Alerts should explain evidence and change, not manufacture security verdicts.

## Local Query API, MCP, and Explain

A stable query layer can serve:

- the desktop UI;
- a read-only local API;
- MCP tools; and
- an optional Explain feature.

The first AI feature should remain narrow:

```text
Selected structured object
  ↓
Minimal sanitized JSON
  ↓
External LLM chosen by the user
  ↓
Explanation, implications, and next investigation steps
```

No unrestricted shell, free-form agent, or automatic tool execution is part
of this stage.

## Advisory and supervised operations

Only after reliable identity, relationships, snapshots, and evidence:

1. generate diagnostic checklists and operations plans;
2. show risk, impact, verification, and rollback;
3. introduce predefined approved operations;
4. capture before and after snapshots;
5. verify outcomes; and
6. retain audit records.

## Policy automation and bounded autonomy

Low-risk automation may follow after supervised operations are proven safe.
Every policy requires explicit scope, allowed tools, retry limits, cooldowns,
failure behavior, and user override.

The long-term agent remains bounded. HostLens should never become a generic
root shell controlled by an LLM.

## Multi-host

Multi-host management should build on the proven single-host model:

- a headless Linux collector;
- read-only SSH collection where appropriate;
- host lists and host comparison;
- centralized changes and alerts;
- host-scoped MCP queries; and
- separately authorized remote operations.

Multi-host scale is not a prerequisite for making the single-host inspector
excellent.

## Related documents

- [Product philosophy](PRODUCT.md)
- [Architecture](ARCHITECTURE.md)
- [Safety model](SAFETY.md)
