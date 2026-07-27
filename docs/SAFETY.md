# HostLens Safety Model

[English](SAFETY.md) | [日本語](SAFETY.ja.md) | [简体中文](SAFETY.zh-CN.md)

## Principle

HostLens should gain authority more slowly than it gains understanding.

The safe long-term progression is:

```text
Inspector
  ↓
Explainer
  ↓
Advisor
  ↓
Supervised Operator
  ↓
Policy Automation
  ↓
Bounded Autonomous Agent
```

Each level depends on the reliability, evidence, and auditability of the level
before it.

## Level 0: Inspector

HostLens collects and displays host state.

- read-only;
- no shell supplied by an LLM;
- no process, service, firewall, or file modifications;
- conclusions carry evidence; and
- unknowns remain visible.

This is the current product level.

## Level 1: Explainer

Rules and an optional LLM explain selected structured objects.

Examples:

- Why is this port open?
- What is this process?
- Why does this service start at boot?
- What changed during this session?

The LLM receives selected structured data, not unrestricted machine access. It
cannot execute commands.

## Level 2: Advisor

HostLens may generate an operations plan without executing it.

Every plan should include:

- the observed problem;
- supporting evidence;
- proposed steps;
- risk and expected impact;
- how the result would be verified; and
- a rollback approach where relevant.

## Level 3: Supervised Operator

HostLens may execute predefined operations after explicit user approval.

```text
Detect
  ↓
Create exact action plan
  ↓
Show target, parameters, risk, and impact
  ↓
User approval
  ↓
Execute predefined operation
  ↓
Collect new state and verify
  ↓
Record audit event
```

There is no unrestricted shell tool. Each operation has a typed target and
validated parameters.

## Level 4: Policy Automation

Users may authorize narrow, low-risk operations under explicit rules.

Every policy requires:

- a resource scope;
- an allowed operation set;
- preconditions;
- a maximum attempt count;
- a cooldown;
- a time window where appropriate;
- failure and escalation behavior; and
- an immediate disable mechanism.

## Level 5: Bounded Autonomous Agent

The agent may observe, diagnose, plan, execute, verify, and escalate only within
an explicitly granted boundary.

Example boundary:

```text
Hosts
- development-server-01

Services
- nginx
- application-api

Allowed operations
- read logs
- restart service
- reload configuration
- run health check

Forbidden operations
- delete files
- modify users
- modify firewall
- reboot host

Maximum retries
1
```

Root access alone is never treated as authorization.

## Operations Engine requirements

Future write capabilities belong in an Operations Engine, not in an LLM
prompt.

```ts
interface OperationDefinition {
  id: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  requiredPrivileges: string[];
  supportedPlatforms: string[];
  reversible: boolean;
  requiresApproval: boolean;
  preconditions: string[];
  verificationSteps: string[];
}
```

Operations should be:

- predefined;
- narrowly parameterized;
- allowlisted by platform and resource;
- independently authorized;
- observable before and after execution;
- safe to retry only when explicitly declared; and
- recorded in an audit log.

## LLM boundary

An LLM may:

- interpret user intent;
- select read-only structured queries;
- explain evidence;
- summarize changes;
- draft a diagnostic checklist; and
- propose an operations plan.

An LLM must not, by default:

- execute arbitrary shell commands;
- read arbitrary files;
- obtain administrator privileges;
- kill processes;
- change startup configuration;
- modify firewall policy;
- label software as malware from a process name; or
- send unreviewed machine data to an external provider.

## Evidence and language

Safety is also a presentation concern. HostLens should say:

```text
New network-facing listener observed
```

rather than:

```text
Dangerous port detected
```

unless a stronger conclusion is supported by explicit policy and evidence.

## Preconditions for operations work

HostLens should not begin supervised operations until it has:

- stable resource identifiers;
- reliable collection and source attribution;
- snapshots and typed changes;
- deterministic operation definitions;
- permission and approval flows;
- precondition and postcondition checks;
- audit storage;
- failure handling; and
- tests that demonstrate dangerous operations cannot bypass approval.
