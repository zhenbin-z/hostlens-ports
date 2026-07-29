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

## Released: 0.3.0 — Services & Startup Inspector

Version 0.3 should answer:

> **Which services and startup items are configured on this Mac, which are
> running now, and which processes and listening ports belong to them?**

### Service inventory

- collect the current user launchd domain, including loaded but inactive jobs;
- discover configured third-party LaunchAgents and LaunchDaemons from user and
  local-library plist locations;
- collect Homebrew Services when Homebrew is available;
- keep configured-but-stopped items instead of showing only running processes;
- distinguish user agents, system agents, and system daemons; and
- classify Apple-owned system jobs separately so the default view remains
  useful without discarding technical evidence.

### Status and startup behavior

- normalize Running, Loaded, Stopped, Failed, Disabled, and Unknown states;
- show PID and last exit status when observed;
- derive Automatic, On demand, Disabled, or Unknown startup behavior from
  plist configuration, launchd state, and Homebrew evidence;
- display program, arguments, plist path, service label, manager, and scope;
- retain partial objects when a plist or command cannot be inspected; and
- attach confidence and evidence to every inferred status or startup policy.

### Unified relationships

- model `Service` separately from `Process`, `Socket`, and `LaunchSource`;
- relate services to direct and descendant processes;
- relate services to listening sockets owned by those processes;
- merge Homebrew and launchd observations that describe the same service; and
- let users move between a service and its related ports without inventing a
  second identity system.

### Services interface

- add first-class Ports and Services views in the full app and menu-bar panel;
- provide search, manager, status, startup, scope, and Apple-system filters;
- provide deterministic sorting;
- show an ordinary-language service summary before technical fields;
- expose exact labels, paths, arguments, relationships, confidence, and
  evidence in expandable technical details; and
- support English, Japanese, and Simplified Chinese.

### 0.3 completion criteria

- sanitized fixtures cover launchctl, plist, disabled-state, and Homebrew
  output, including malformed and permission-limited cases;
- relationship tests cover direct processes, descendants, multiple sockets,
  stopped services, and Homebrew/launchd deduplication;
- configured-but-stopped services remain visible;
- a failed optional collector does not remove port or service facts obtained
  from other collectors;
- the UI clearly separates observed facts from inferred status and startup
  behavior;
- the default personal view is understandable without raw launchd knowledge;
- technical users can inspect the evidence behind every relationship;
- a documented 20-scan benchmark remains responsive under the reference
  development workload;
- production build and real macOS UI/collector checks pass in all three
  languages; and
- HostLens remains read-only, local, free of persistent history, and sends no
  machine information over the network.

Completion evidence recorded on the `develop/0.3.0` branch on July 28, 2026:

- 52 automated tests pass across port and service parsing, permission-limited
  partial objects, status/startup normalization, relationships, deduplication,
  optional-collector failure, filtering, sorting, and localization;
- the production Electron build passes TypeScript validation;
- a live macOS collector found configured, running, loaded, and stopped
  third-party services while retaining Apple and application runtime jobs
  behind explicit filters;
- live English, Japanese, and Simplified Chinese UI checks passed, including
  default filtering and navigation from a service to its related port; and
- the documented 20-scan combined benchmark recorded a p95 of 751.64 ms with
  no service missing evidence. See [Scanner Benchmarks](BENCHMARKS.md).

### Explicitly out of scope for 0.3

- starting, stopping, enabling, disabling, or deleting services;
- editing plist files;
- persistent history or alerts;
- network interfaces, routes, DNS, VPN, or firewall inspection;
- Linux service parity;
- login-item management through privileged/private APIs;
- MCP, LLM, or chat features; and
- multi-host management.

## Released: 0.4.0 — macOS Host Overview & Network Context

Version 0.4 should answer:

> **Which networks is this Mac connected to, and through which interfaces can
> its listening services be reached?**

- formalize the shared `Process`, `Service`, `Socket`, `Project`,
  `LaunchSource`, `NetworkInterface`, `Route`, `DnsConfiguration`,
  `VpnConnection`, and `Evidence` relationships;
- collect macOS interfaces, IPv4/IPv6 addresses, default routes, DNS
  configuration, and observable VPN interfaces;
- relate socket bind addresses to concrete interfaces without claiming
  firewall or internet reachability;
- distinguish Bound, Potentially reachable, and Actively tested states;
- add a Host Overview for current network, background services, startup
  behavior, network-facing ports, and session changes;
- provide personal-language summaries and expandable developer/IT evidence;
- keep all collection local, read-only, and free of active LAN scanning; and
- verify collectors, relationships, performance, and all three languages on a
  real Mac.

Completion evidence recorded on July 29, 2026:

- 58 automated tests pass, including sanitized interface, route, DNS, VPN, and
  socket-relation fixtures plus optional-collector isolation;
- the production Electron build passes TypeScript validation;
- a real Mac Host Overview correctly displayed the primary network, active
  interfaces, default gateway, DNS, observable VPN context, background
  services, and potentially reachable listeners;
- English, Japanese, and Simplified Chinese UI and cross-view navigation were
  checked in the live Electron application;
- wildcard listeners are related only to active interfaces with network-scope
  addresses, avoiding link-local virtual-interface noise; and
- the 20-scan network benchmark recorded a p95 of 12.13 ms with evidence on
  every socket relation. See [Scanner Benchmarks](BENCHMARKS.md).

### Explicitly out of scope for 0.4

- active LAN, firewall, or internet reachability testing;
- packet capture or network traffic inspection;
- network or VPN configuration changes;
- persistent network history;
- Linux network parity;
- MCP, LLM, or chat features; and
- multi-host management.

## Planned: 0.5.0 — Runtimes & Global Packages Inspector

Version 0.5 should connect installed developer tooling to what is running:

- inventory Node.js and Python runtimes from system, Homebrew, nvm, pyenv, and
  other observable installations;
- inventory npm, Yarn, pnpm, pip, and pipx global packages;
- show package name, version, manager, runtime, installation path, and exposed
  executables;
- relate package executables to running processes, services, projects, and
  listening ports;
- preserve unknown and permission-limited observations with evidence;
- provide search, filters, summaries, export, and English/Japanese/Chinese UI;
  and
- remain read-only: no install, update, uninstall, vulnerability verdict, or
  full per-project dependency scan.

## Planned: 0.6.0 — Persistent Changes & Alerts

Once normalized identities are stable:

- persist lightweight, versioned local snapshots;
- create typed `ChangeEvent` records for ports, services, network context, and
  runtime/package inventory;
- provide a bounded timeline with retention controls;
- let users watch or ignore resources;
- support evidence-backed alert rules, cooldowns, and desktop notifications;
- provide reviewable current-state and change summaries; and
- keep the database local with tested migrations and no telemetry.

Alerts should explain evidence and change, not manufacture security verdicts.

## Planned: 0.7.0 — Ubuntu / RHEL First-class Support

Linux should use the same host concepts with platform-specific evidence.

- support processes and listening sockets through `ss` and `/proc`;
- support systemd services and startup behavior;
- collect interfaces, routes, DNS, VPN context, and firewalld observations;
- inventory Docker/Podman, runtimes, and global packages where available;
- reuse relationships, persistent changes, alerts, reports, and the
  trilingual UI;
- provide `.deb`, `.rpm`, and practical GNOME desktop packaging;
- validate Ubuntu and Red Hat Enterprise Linux behavior with fixtures and
  representative real environments; and
- preserve partial results when commands, permissions, or optional tools are
  unavailable.

Headless agents, multi-host management, service mutation, and unrestricted
shell access remain later concerns.

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
