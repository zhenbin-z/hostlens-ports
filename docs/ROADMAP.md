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

## Released: 0.2.0 — Host Identity and Session Awareness

Version 0.2 answers:

> **Who is really behind this port, where did it come from, and what changed
> during this HostLens session?**

It is still a focused single-host port inspector. The goal is to make the same
trusted facts useful to personal users, developers, and small-company IT—not to
build three separate products.

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

### Audience-aware presentation

Use one identity and evidence model with different levels of detail:

- **Personal:** show a plain-language identity, why it is likely running,
  whether it starts automatically, and whether it is local-only or
  network-facing. Keep commands and evidence expandable.
- **Developer:** prioritize project, tool, package script, working directory,
  parent chain, runtime, and exact command.
- **IT:** provide a consistent technical identity, collection status, evidence,
  and a copyable current-state summary suitable for an inventory, support
  ticket, or manual review.

Version 0.2 does not need a full persona-switching system. The UI should prove
that friendly summaries and technical evidence can refer to the same object.

### Shareable current-state summary

Without a database or cloud service:

- let the user copy or export the current selected listener details;
- provide a sanitized summary option that omits or shortens private paths and
  other sensitive fields;
- include collection time, identity confidence, source, exposure, and evidence;
  and
- make clear that the export is a point-in-time observation, not a security
  certification.

### 0.2 implementation order

Implement the release as vertical slices:

1. make raw socket and process observations reliable;
2. introduce identity, evidence, confidence, and partial-result semantics;
3. add source-attribution resolvers with sanitized fixtures;
4. add deterministic in-memory session changes; and
5. add friendly/technical presentation and sanitized current-state summaries.

Do not begin a later slice by bypassing unfinished shared-model work in an
earlier slice.

### 0.2 completion criteria

The release should not be considered complete only because fields exist.

- Existing scanner tests continue to pass.
- Representative sanitized fixtures cover supported development-server and
  source-attribution patterns.
- A documented 20-scan benchmark on the reference Mac records a p95 scan time
  below two seconds under a normal development workload.
- Every inferred identity includes evidence and confidence.
- Missing process details degrade to an unknown or partial result without
  losing the socket.
- A normal scan remains responsive on a developer Mac.
- New, changed, and closed states are deterministic across identical snapshots.
- A non-technical user can understand the primary identity and exposure without
  opening the raw command.
- A technical user can inspect the evidence behind every friendly identity.
- The current-state summary can be copied without introducing persistence or
  background network traffic.
- Sanitization tests demonstrate that private home-directory prefixes and
  common secret-bearing command arguments are not included in sanitized output.
- HostLens remains read-only and sends no machine information over the network.

Completion evidence recorded on July 27, 2026:

- 36 automated tests pass across scanner parsing, identity, source attribution,
  localization, session changes, and summary sanitization;
- the production Electron build passes TypeScript validation;
- a real macOS scan identified package scripts, native applications, Docker,
  launchd, and unknown sources without losing partial socket observations;
- a live UI check confirmed New and Closed listener transitions and all three
  interface languages; and
- the documented 20-scan reference benchmark recorded a p95 of 78.24 ms with
  30 listeners. See [Scanner Benchmarks](BENCHMARKS.md).

### Explicitly out of scope for 0.2

- a database or persistent history;
- UDP scanning;
- full macOS host inventory;
- Linux GUI parity;
- device discovery, multi-host management, or a business hub;
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
- add a personal overview for background activity and startup behavior;
- add a developer view for projects, runtimes, and local services;
- add an IT view for machine inventory, evidence, and reviewable summaries; and
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

## Personal and small-business experiences

The shared model should grow into two additional experiences without forking
the underlying facts.

### Personal host understanding

- background applications and startup behavior;
- ordinary-language explanations with expandable evidence;
- recent changes;
- resource and network context; and
- attention guidance that avoids unsupported security claims.

### Small-business IT

- consistent inspection across Macs and Linux hosts;
- current-state inventory and reviewable reports;
- changes and alerts for important machines;
- service, startup, schedule, and firewall context;
- local deployment and local processing; and
- evidence suitable for troubleshooting and handoff.

These begin as single-host capabilities. They do not require enterprise fleet
management.

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

## Small-business environment intelligence

Only after the single-host model and changes are trustworthy, HostLens may
connect the office environment:

- Macs, PCs, and Linux servers;
- NAS devices and shared storage;
- printers;
- routers, switches, Wi-Fi, and local network services;
- selected cloud dependencies;
- a local business hub;
- topology and dependency relationships;
- centralized changes, alerts, and reports; and
- local-first AI context.

The exit criterion is not “many devices are listed.” HostLens should help
determine whether an office-wide symptom comes from an endpoint, shared
service, network device, or upstream dependency.

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

## Related documents

- [Product philosophy](PRODUCT.md)
- [Architecture](ARCHITECTURE.md)
- [Safety model](SAFETY.md)
- [Why HostLens is open source](OPEN_SOURCE.md)
