# HostLens Product Philosophy

[English](PRODUCT.md) | [日本語](PRODUCT.ja.md) | [简体中文](PRODUCT.zh-CN.md)

## Vision

HostLens is a human-friendly system inspector and operating-system knowledge
layer.

Its purpose is to explain:

- what is running on a machine;
- why it is running;
- how it was started;
- which project, application, service, container, or package it belongs to;
- which ports and other resources it uses;
- how those resources relate to one another; and
- what changed recently.

The concise product promise is:

> **Understand what is really running on your machine.**

HostLens starts as an inspector. It may eventually become a bounded operations
agent, but only after it can reliably observe, identify, relate, and explain
host state.

## Product principles

### Information before intervention

The initial product loop is:

```text
Collect
  ↓
Normalize
  ↓
Relate
  ↓
Explain
  ↓
Notify
```

HostLens should understand a system before it attempts to control it.

### Structured facts are the core asset

HostLens is not valuable because it can invoke `lsof`, `ps`, `launchctl`,
`systemctl`, or an LLM. Its durable value is the normalized, queryable host
model produced from those sources.

Raw observations:

```text
node
PID 1234
127.0.0.1:5173
```

Useful host identity:

```text
Vite Development Server

Project
~/Developer/example-app

Started by
yarn dev

Runtime
Node.js 22

Listening
127.0.0.1:5173

Exposure
Local machine only
```

### Relationships, not command-output screens

HostLens should model relationships such as:

```text
Project
  ↓ defines
package script
  ↓ launches
Process
  ↓ listens on
Socket
```

It should not become a collection of unrelated GUI wrappers for operating
system commands.

### Facts, inference, and unknowns must remain distinct

Every non-trivial conclusion should communicate:

- what was directly observed;
- what was inferred;
- the confidence of the inference; and
- what remains unknown.

HostLens must not turn best-effort attribution into an unsupported fact.

### Useful without AI

The core inspector must remain useful without an LLM. AI may explain
explicitly selected structured information, but it must not define the basic
product value.

### Privacy first

Host data may contain usernames, paths, project names, commands, network
addresses, and secrets. Collection stays local by default. Any future external
AI feature must show and minimize the exact structured information being sent.

## Who HostLens serves

HostLens should maintain one evidence-backed environment model while presenting
different views for different users.

### Personal users

Personal users care about outcomes, not operating-system vocabulary:

- What is running in the background?
- Why does this application start automatically?
- What changed recently?
- What is using memory, storage, battery, or network access?
- Is this network-facing process expected?

HostLens should use ordinary language by default and keep technical evidence
one level deeper for users who want to verify the explanation.

### Developers

Developers need precise local relationships:

- sockets, processes, parent processes, commands, and working directories;
- launchd, Homebrew, Docker, and development servers;
- runtimes, projects, package scripts, and configuration; and
- local network exposure and source attribution.

HostLens Ports is the first concrete product for this audience.

### Small-business IT

An owner, part-time administrator, or small-company information-systems team
needs reliable answers without deploying an enterprise observability stack:

- which services and startup items exist on each important machine;
- what changed since the last check;
- why a shared printer, NAS, server, or local application is unavailable;
- which machine or dependency is responsible for an office-wide symptom;
- which findings need attention and which are normal; and
- how to produce a reviewable inventory or report.

The long-term experience should extend from a single host to a local-first view
of PCs, Macs, Linux servers, NAS devices, printers, routers, Wi-Fi, and selected
cloud dependencies.

### AI and external tools

External assistants need a stable, safe source of current facts. Read-only
queries and MCP should expose focused structured context without granting
arbitrary shell access.

## What HostLens is

- a host information inspector;
- a developer-friendly process and service explainer;
- a normalized operating-system data layer;
- a local source of truth for host identity and relationships;
- a change-awareness tool;
- a foundation for personal and small-business environment understanding;
- a future read-only API and MCP server; and
- eventually, a supervised and policy-bounded operations system.

## What HostLens is not

At least during its early stages, HostLens is not:

- antivirus software;
- an EDR platform;
- a vulnerability scanner;
- a disk cleaner;
- an automatic system optimizer;
- a malware verdict engine;
- an unrestricted shell agent; or
- an autonomous program that requires root access by default.

Security-related output should prefer:

```text
Observation
Evidence
Possible implication
Recommended investigation
```

It should avoid unsupported labels such as:

```text
Malicious
Dangerous
Safe to delete
```

## Platform direction

macOS is the first product environment. Linux is a first-class target, not a
secondary port. Ubuntu and Red Hat Enterprise Linux should share the same
normalized concepts while retaining platform-specific collectors and evidence.

Windows may be considered only after the host model and collector boundaries
are stable.

## Success criteria

HostLens succeeds when it can:

- identify a resource accurately;
- explain how that identity was derived;
- relate processes, sockets, services, projects, and startup sources;
- distinguish facts from inference;
- explain changes without manufacturing alarm;
- remain useful without an LLM;
- expose stable structured data to future clients;
- propose verifiable operations plans; and
- eventually execute only explicitly bounded, auditable operations.

Feature count and the number of wrapped shell commands are not success metrics.
