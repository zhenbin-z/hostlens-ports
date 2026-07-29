# HostLens Architecture

[English](ARCHITECTURE.md) | [日本語](ARCHITECTURE.ja.md) | [简体中文](ARCHITECTURE.zh-CN.md)

## Architectural objective

HostLens converts fragmented platform observations into a normalized,
evidence-backed model of a host.

```text
Platform Collectors
        ↓
Normalizer
        ↓
Unified Host Model
        ↓
Identity and Relationship Resolution
        ↓
Snapshot and Change Engine
        ↓
Query and Context Selection
        ↓
UI, Alerts, MCP, and Explain
```

The UI, future MCP server, and future LLM features should consume the same
structured model. They should not parse command output independently.

## Layer responsibilities

### Collectors

Collectors gather platform facts and preserve collection failures.

Examples:

- macOS: `lsof`, `ps`, launchd, Homebrew, network configuration;
- Linux: `/proc`, `ss`, systemd, cron, firewalld, nftables; and
- containers: Docker or Podman APIs and command-line adapters.

A collector should not decide whether an observation is important or compose
user-facing explanations.

### Normalizer

The normalizer maps platform-specific output to stable shared types. Missing
or permission-restricted values remain absent or unknown; they must not be
invented.

### Identity resolver

The identity resolver turns low-level observations into candidate identities.

```text
process name + command + executable + cwd + parent chain
        ↓
candidate application / runtime / project / launch source
        ↓
confidence and evidence
```

Resolution should be deterministic where possible. Rules and structured
catalogues should run before probabilistic explanation.

### Relationship engine

Relationships connect independently collected resources:

```text
Process listensOn Socket
Process startedBy LaunchSource
Process belongsTo Project
Service launches Process
Container exposes Socket
Package provides Executable
```

### Snapshot and change engine

Snapshots record normalized state. Comparisons produce typed changes rather
than prose:

```text
Created
Started
Stopped
Changed
Opened
Closed
Enabled
Disabled
Added
Removed
```

The first implementation may compare snapshots only in memory during the
current HostLens session. Persistence is a later concern.

### Query and presentation

The desktop UI, local API, MCP tools, alerts, and Explain feature should query
the host model. Presentation code may format facts, but should not create a
second identity system.

### Context selection

Future explanations and external queries should receive the minimum relevant
facts, relationships, changes, policies, and evidence for the task. Context
selection is a privacy and accuracy boundary, not merely an LLM optimization.

Version 0.2 applies the same principle to exports: a sanitized summary is a
deliberate projection of the host model, not a dump of every collected field.

## Version 0.2 host model

Version 0.2 intentionally starts with a small model.

```ts
interface Evidence {
  source: string;
  collectedAt: string;
  confidence: "high" | "medium" | "low";
  detail?: string;
}

interface ProcessIdentity {
  displayName: string;
  kind:
    | "system"
    | "application"
    | "service"
    | "development"
    | "unknown";
  project?: ProjectIdentity;
  launchSource?: LaunchSource;
  evidence: Evidence[];
}

interface LaunchSource {
  kind:
    | "launchd"
    | "homebrew"
    | "docker"
    | "package-script"
    | "manual"
    | "unknown";
  label?: string;
  confidence: "high" | "medium" | "low";
}
```

The exact TypeScript types may evolve during implementation. The important
constraint is that identity, source, confidence, and evidence are separate
concepts.

The released 0.2 implementation stores `ProcessIdentity` and `LaunchSource` as
separate fields on each listener, and wraps each successful `PortSnapshot`
with deterministic in-memory `SessionChanges`. `SessionMonitor` owns the last
successful snapshot and accumulated New / Changed / Closed events. Nothing in
that session state is written to disk.

Version 0.2 focuses on:

- `Process`;
- `Socket`;
- `ProjectIdentity`;
- `LaunchSource`; and
- `Evidence`.

Objects such as `Service`, `FirewallPolicy`, `ScheduledJob`, and `Package`
should be added only when their collectors and UI are actively implemented.

## Version 0.3 service model

Version 0.3 adds `Service` because both its collectors and its first-class UI
now exist. A service is not inferred to be the same object as a process,
socket, or launch source.

```text
Configured Plist ─┐
launchctl State ──┼─→ Service ─→ direct/descendant Process ─→ Socket
Homebrew State ───┘
```

Each service preserves manager, label, kind, scope, ownership, normalized
status, startup behavior, program, arguments, plist path, PID, exit status,
observation completeness, confidence, and evidence. Failed or
permission-limited collection creates a partial object instead of deleting the
known configuration.

Relationships are evidence-backed identifiers. Homebrew and launchd
observations for the same plist label are merged into one service. Apple jobs
and transient application runtime jobs remain in the model but are hidden by
default so the ordinary view prioritizes configured third-party services.

## Version 0.5 runtime and package model

Version 0.5 adds runtime installations and package-manager environments without
turning HostLens into a package manager:

```text
Runtime installation
  └── Package-manager environment
        └── Package
              └── Provided executable
                    └── Process / Service / Socket
```

`RuntimeInstallation`, `GlobalPackage`, and `RuntimeRelationship` retain stable
identifiers, observation completeness, unavailable fields, confidence, and
evidence. A relationship is created only from observable executable or
installation-path evidence; a matching package name alone is not sufficient.

Node.js managers may expose a conventional global inventory. Python has no
universal global scope, so pip results are explicitly described as packages in
each discovered environment. Missing managers, restricted paths, and command
failures produce warnings and partial results rather than false empty
inventories.

Runtime/package collection uses a 60-second in-memory cache. This keeps frequent
socket refreshes responsive while preserving the current release's
non-persistent architecture. Copy/export summaries are projections of the
structured model and sanitized exports remove private home-directory paths and
common secret-bearing arguments.

## Future model

The long-term model may include:

```text
Environment
Host
NetworkDevice
Peripheral
User
Process
Service
Socket
NetworkInterface
Route
FirewallPolicy
ScheduledJob
StartupItem
Package
Runtime
Project
Container
ConfigFile
LogSource
Snapshot
ChangeEvent
AlertRule
ActionPlan
ActionExecution
AuditEvent
```

This list is a direction, not a requirement to create empty abstractions early.

## One model, multiple views

The same observed facts should support different experiences without creating
different truths:

```text
Unified Environment Model
  ├── Personal view
  ├── Developer view
  ├── IT view
  ├── Small-business view
  └── MCP and AI view
```

Views may change terminology, defaults, and information density. A personal
view may say “starts automatically in the background,” while an evidence view
shows the launchd label and plist path. Both must refer to the same object and
evidence.

## From a host to an environment

Single-host inspection and small-business environment intelligence should
share concepts but use different deployment shapes.

```text
Desktop
local collectors → local model → local UI / query

Small business
host and device collectors → local hub → environment graph
  → business console / alerts / local AI
```

Future environment resources may include PCs, Macs, Linux servers, NAS
appliances, printers, routers, switches, Wi-Fi access points, and selected
cloud services.

This is not a reason to introduce multi-host complexity into version 0.2. A
reliable single-host identity model is the prerequisite for meaningful
topology and cross-device diagnosis.

## Network semantics

HostLens must distinguish:

```text
Bound
Reachable
Allowed
Tested
```

For example:

```text
Binding
0.0.0.0:8080

Host firewall
Unknown

LAN reachability
Not tested

Internet reachability
Unknown
```

A non-loopback binding is network-facing, but it does not prove LAN or internet
reachability.

## Failure and permission semantics

Collection is best effort. A missing value can mean:

- the process exited during the scan;
- the operating system restricted access;
- the platform does not expose the field;
- a collector is unavailable; or
- parsing failed.

These cases should be represented as warnings or evidence status, not silently
collapsed into false values.

HostLens should work without administrator access and degrade gracefully.

## Privacy boundaries

Commands, environment variables, paths, and config files may contain secrets.

- Do not collect environment variables by default.
- Do not expose arbitrary filesystem reads to the renderer.
- Do not retain raw command output longer than required.
- Sanitize fixtures and bug reports.
- Do not send host data to an external service without explicit user action.

## Schema evolution

Shared host-model types should be versionable before they become a public API.
MCP and local API work should begin only after the relevant types have stable
identifiers, nullability rules, evidence semantics, and compatibility tests.
