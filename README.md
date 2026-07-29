<div align="center">
  <img src="build/icon.png" width="128" alt="HostLens Ports icon">

  # HostLens Ports

  **See what is listening on your Mac or Linux host — and which process opened it.**

  [![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-1f7040.svg)](LICENSE)
  ![Platform: macOS + Linux](https://img.shields.io/badge/platform-macOS%20%2B%20Linux-lightgrey.svg)
  ![Built with Electron](https://img.shields.io/badge/Electron-React%20%2B%20TypeScript-47848f.svg)
</div>

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/English-1f7040?style=for-the-badge" alt="English"></a>
  <a href="README.ja.md"><img src="https://img.shields.io/badge/日本語-6f7d72?style=for-the-badge" alt="日本語"></a>
  <a href="README.zh-CN.md"><img src="https://img.shields.io/badge/简体中文-6f7d72?style=for-the-badge" alt="简体中文"></a>
</p>

HostLens Ports is a lightweight, open-source desktop utility for inspecting
TCP listening ports without memorizing `lsof`, `netstat`, or `ss` commands.
It connects each port to its owning process, command, bind address, and
network exposure, then presents the result in a searchable interface.
Version 0.7 makes Ubuntu and Red Hat Enterprise Linux first-class desktop
targets with `ss`/process inspection, systemd services, iproute2 network
context, read-only firewalld observations, and Node/Python package inventory.

The current release is intentionally local and read-only. Its lightweight
SQLite history stays on the host; it has no LLM, telemetry, account, or cloud
service.

![HostLens Ports application](docs/images/hostlens-ports-app.png)

![HostLens Host Overview](docs/images/hostlens-overview-app.jpg)

![HostLens Services inspector](docs/images/hostlens-services-app.jpg)

![HostLens Runtimes inspector](docs/images/hostlens-runtimes-app.jpg)

![HostLens Changes inspector](docs/images/hostlens-changes-app.jpg)

## Features

- Live TCP listener discovery on macOS, Ubuntu, and RHEL
- Host Overview for current network, services, exposed listeners, and session
  changes
- Local collection of interfaces, IPv4/IPv6 addresses, routes, DNS, and
  observable VPN interfaces
- Socket-to-interface relationships that distinguish observed bindings from
  potential reachability
- Process, PID, parent PID, user, and full command inspection
- Executable, working-directory, and parent-process-chain evidence
- Project-aware names for Vite, Next.js, React tooling, Nuxt, webpack, and
  other common development servers
- Launch-source attribution for package scripts, launchd, Homebrew Services,
  Docker, native applications, and manually started processes
- First-class Services view for launchd, Homebrew Services, and systemd
- Running, Loaded, Stopped, Failed, Disabled, and Unknown service states
- Automatic, On-demand, Disabled, and Unknown startup behavior
- Service-to-process and service-to-listening-port relationships
- Configured-but-stopped service discovery from LaunchAgent and LaunchDaemon
  plist locations
- Apple system jobs and transient application jobs retained but hidden by
  default
- Service search, manager/status/startup/scope filters, and deterministic
  sorting
- Node.js and Python runtime discovery across system, Homebrew, nvm, pyenv, and
  other observable installations
- npm, Yarn, pnpm, pip, and pipx package inventories with manager, version,
  environment, installation path, and provided executable evidence
- Package search, runtime/manager filters, deterministic sorting, and
  high-confidence relationships to listeners and services
- Confidence and inspectable evidence for inferred identities
- In-memory New, Changed, and Closed listener detection for the current session
- Persistent, typed Added / Changed / Removed events in a bounded local
  timeline
- Watch / Ignore preferences, retention controls, notification cooldowns, and
  desktop alerts for new network-facing ports or watched-resource changes
- Search by port, process, project, address, or command
- Filter by port range, process owner, and bind scope
- Sort by port, process name, owner, or scope
- Distinguish loopback-only listeners from network-facing listeners
- Menu bar Quick View plus a complete desktop window
- English, Japanese, and Simplified Chinese interfaces
- Friendly summaries with expandable technical details
- Full and sanitized copy/export summaries with point-in-time disclaimers
- Copyable, fully visible commands and explicit partial-observation states
- Read-only operation with no administrator helper
- Native `.AppImage`, `.deb`, and `.rpm` packaging for Linux desktops
- Graceful partial results when Linux tools or process ownership are unavailable

<p align="center">
  <img src="docs/images/hostlens-ports-quick-view.png"
       width="430"
       alt="HostLens Ports menu bar Quick View">
</p>

## Who it is for

- **Personal users:** understand background and network-facing activity in
  ordinary language, with technical evidence available when needed.
- **Developers:** connect ports to projects, commands, runtimes, parent
  processes, and launch sources.
- **Small-business IT:** inspect important Macs and Linux hosts consistently,
  review changes, and produce evidence-backed summaries without an enterprise
  monitoring stack.

HostLens begins with one machine. Its long-term direction includes local-first
environment understanding across computers, servers, NAS devices, printers,
routers, Wi-Fi, and shared services.

## Quick start

### Requirements

- macOS 13+, Ubuntu 22.04+/24.04, or RHEL 9
- Node.js 22 or later
- Yarn Classic 1.22

### Run in development mode

```bash
git clone https://github.com/zhenbin-z/hostlens-ports.git
cd hostlens-ports
yarn install
yarn dev
```

The development renderer runs on port `5190`. Electron opens the full app
window and keeps HostLens Ports available in both the Dock and menu bar.

## How to read the results

HostLens keeps three different concepts separate:

| Dimension | Values | Meaning |
| --- | --- | --- |
| Port range | System, Service, Dynamic | Numeric range of the port |
| Owner | System, Service, Application, Development, Unknown | Heuristic classification of the process |
| Scope | Local only, Network-facing, Unknown | Interfaces on which the socket is listening |

The current numeric ranges are:

- **System:** `0–1023`
- **Service:** `1024–49151`
- **Dynamic:** `49152–65535`

`Network-facing` means the process is bound to a non-loopback address or all
interfaces. It does **not** prove that the port is reachable through the
firewall, router, VPN, or internet.

Process owner and display names are best-effort classifications derived from
the executable path, command, app bundle, and project directory. HostLens
always keeps the original process name and command visible as evidence.

## Privacy and security

HostLens Ports:

- runs locally;
- executes port inspection only in the Electron main process;
- exposes a small, typed API to the renderer;
- never sends machine information over the network;
- never modifies processes, services, firewall rules, or sockets;
- does not request administrator access.

Some system-owned processes may provide incomplete information when inspected
without elevated permissions. HostLens treats missing information as unknown
rather than requesting broad access.

## Platform support

| Platform | Status |
| --- | --- |
| macOS | Supported: live `lsof` and `ps` scanner |
| Ubuntu | Supported: `ss`, process, systemd, iproute2, packages |
| Red Hat Enterprise Linux | Supported: `ss`, process, systemd, iproute2, firewalld |

Linux tray availability depends on the desktop environment. The full
application window remains available on GNOME even when a
StatusNotifier/AppIndicator extension is not installed.

## Project structure

```text
src/
├── main/
│   ├── index.ts                 Electron windows, tray, and IPC
│   ├── network/                 Network collectors and relationships
│   ├── runtimes/                Runtime/package collectors and relationships
│   ├── scanners/                Port scanners and process identity
│   └── services/                Service collectors and relationships
├── preload/
│   └── index.ts                 Restricted renderer bridge
├── renderer/
│   └── src/                     React interface
└── shared/
    ├── ports.ts                 Port and host snapshot types
    ├── network.ts               Network context and relationship types
    ├── runtimes.ts              Runtime and package inventory types
    └── services.ts              Service and startup types
```

## Development commands

```bash
yarn dev                # Start Electron in development mode
yarn typecheck          # Check main, preload, and renderer TypeScript
yarn test               # Run scanner, identity, session, and privacy tests
yarn benchmark:scanner  # Run the 20-scan macOS reference benchmark
yarn benchmark:services # Benchmark ports, services, and relationships
yarn benchmark:network  # Benchmark macOS network context collection
yarn benchmark:runtimes # Benchmark runtime/package cold and cached scans
yarn build              # Create a production application build
yarn dist:mac           # Create unsigned local .dmg and .zip artifacts
yarn dist:linux         # Create .AppImage, .deb, and .rpm artifacts
```

`yarn dist:mac` intentionally disables automatic certificate discovery.
Public macOS releases should be signed with a Developer ID certificate and
notarized before distribution.

## Why open source

HostLens inspects private local system context, so users should be able to
verify what it collects and whether data leaves the machine. Open development
also lets the community improve compatibility across operating-system versions,
installation methods, hardware, and local configurations.

HostLens is intended to be a long-lived public infrastructure project, not a
thin AI wrapper. Read [Why HostLens Is Open Source](docs/OPEN_SOURCE.md) for the
full project position.

## Roadmap

HostLens is being built in layers:

```text
See → Identify → Relate → Remember → Explain → Advise → Operate safely
```

- **0.1.0 — See:** live macOS TCP listeners and their processes.
- **0.2.0 — Host Identity and Session Awareness:** improve scanner reliability,
  identify projects and launch sources, attach evidence and confidence, show
  in-memory New / Changed / Closed states, and provide friendly and technical
  views plus a shareable current-state summary.
- **0.3.0 — Services & Startup Inspector:** inventory launchd and Homebrew
  services, retain stopped configuration, normalize status and startup
  behavior, and connect services to processes and listening ports.
- **0.4.0 — Host Overview & Network Context:** released with interfaces,
  addresses, routes, DNS, VPN context, and socket-to-interface relationships.
- **0.5.0 — Runtimes & Global Packages:** released with Node.js/Python
  runtimes and npm/Yarn/pnpm/pip/pipx packages related to host activity.
- **0.6.0 — Persistent Changes & Alerts:** released with local snapshots, typed
  changes, a bounded timeline, Watch / Ignore preferences, cooldowns, and
  desktop notifications.
- **0.7.0 — Ubuntu / RHEL First-class Support:** released with Linux
  collectors, systemd, networking, firewalld observations, packages,
  persistence, alerts, and desktop packaging.
- **Later:** read-only MCP, optional Explain, environment intelligence, and
  only then supervised operations.

HostLens will remain useful without AI. Future AI features must operate on
minimal, explicitly selected structured data and will not receive an
unrestricted shell.

Read the full [Roadmap](docs/ROADMAP.md).

## Project documents

- [Product philosophy](docs/PRODUCT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Safety model](docs/SAFETY.md)
- [Roadmap](docs/ROADMAP.md)
- [Scanner benchmark](docs/BENCHMARKS.md)
- [Why HostLens is open source](docs/OPEN_SOURCE.md)

## Contributing

Issues and pull requests are welcome. Please read
[CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change.

If you find an incorrect port/process association, include the operating
system version and a sanitized command output that reproduces it. Do not post
secrets, customer names, usernames, or private filesystem paths.

## License

HostLens Ports is released under the
[Apache License, Version 2.0](LICENSE).

Copyright 2026 Zhenbin Zhang. The HostLens name and HostLens logo are
trademarks of Zhenbin Zhang. See [NOTICE](NOTICE) for attribution and trademark
information.
