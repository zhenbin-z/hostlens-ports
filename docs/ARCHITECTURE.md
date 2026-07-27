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
Query, UI, Alerts, MCP, and Explain
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

Version 0.2 focuses on:

- `Process`;
- `Socket`;
- `ProjectIdentity`;
- `LaunchSource`; and
- `Evidence`.

Objects such as `Service`, `FirewallPolicy`, `ScheduledJob`, and `Package`
should be added only when their collectors and UI are actively implemented.

## Future model

The long-term model may include:

```text
Host
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
