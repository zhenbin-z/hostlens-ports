# Why HostLens Is Open Source

[English](OPEN_SOURCE.md) | [日本語](OPEN_SOURCE.ja.md) | [简体中文](OPEN_SOURCE.zh-CN.md)

## Trust requires visibility

HostLens inspects sensitive local context: processes, commands, paths, ports,
startup sources, network information, and eventually relationships between
devices and services.

Users should be able to verify:

- what HostLens collects;
- which system interfaces it uses;
- what remains on the machine;
- whether data is sent over the network;
- how an identity or warning was derived; and
- what privileges an operation would require.

For a local system inspector, source visibility is part of the trust model.

## Compatibility is a community problem

Operating systems vary by version, installation method, package manager,
hardware, desktop environment, and local configuration. macOS, Ubuntu, Red Hat
Enterprise Linux, launchd, systemd, Homebrew, Docker, and development tooling
all produce edge cases that one maintainer cannot reproduce alone.

Open development makes it possible to:

- report sanitized platform-specific failures;
- contribute parser fixtures and compatibility fixes;
- review collector safety;
- improve accessibility and localization;
- build integrations against stable interfaces; and
- prevent HostLens from becoming correct only on the maintainer's machines.

## A useful public foundation

The community foundation should remain valuable on its own:

- single-host, read-only inspection;
- transparent collectors and evidence;
- shared schemas and foundational interfaces;
- local-first desktop use;
- provider-neutral, optional AI integration; and
- safe read-only query and MCP capabilities when those interfaces mature.

AI and cloud services are optional consumers, not requirements for understanding
the local machine.

## A long-lived public technical project

HostLens is intended to be durable public engineering work, not a disposable
demo or a thin AI wrapper.

Keeping a useful foundation open:

- demonstrates systems and infrastructure engineering quality;
- creates reusable public knowledge;
- builds trust and reputation over time;
- invites contributors who care about the same problems; and
- ensures that the project can outlive a single employer, model provider, or
  commercial product cycle.

## Open source does not mean publishing every future product

The open-source promise applies to the code released in this repository under
its license. It does not require every future HostLens service, compatibility
pack, managed deployment, business coordination feature, model, or operations
capability to use identical packaging or licensing.

Future boundaries should follow real product needs and be documented clearly.
They must not weaken the usefulness, privacy promises, or license rights of
versions already released.

## Current license

HostLens Ports is currently released under the
[Apache License, Version 2.0](../LICENSE).

Apache-2.0 permits use, modification, and redistribution under its terms and
includes an explicit patent grant. The HostLens name and logo are addressed
separately in [NOTICE](../NOTICE); an open-source code license does not grant
trademark rights.

This document explains project intent and is not legal advice.

