<div align="center">
  <img src="build/icon.png" width="128" alt="HostLens Ports icon">

  # HostLens Ports

  **See what is listening on your Mac — and which process opened it.**

  [![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-1f7040.svg)](LICENSE)
  ![Platform: macOS](https://img.shields.io/badge/platform-macOS-lightgrey.svg)
  ![Built with Electron](https://img.shields.io/badge/Electron-React%20%2B%20TypeScript-47848f.svg)
</div>

HostLens Ports is a lightweight, open-source desktop utility for inspecting
TCP listening ports without memorizing `lsof`, `netstat`, or `ss` commands.
It connects each port to its owning process, command, bind address, and
network exposure, then presents the result in a searchable interface.

The current release is intentionally local and read-only. It has no LLM,
database, telemetry, account, or cloud service.

![HostLens Ports application](docs/images/hostlens-ports-app.png)

## Features

- Live TCP listener discovery on macOS
- Process, PID, parent PID, user, and full command inspection
- Human-friendly names such as `Vite · project-name` and
  `Docker Desktop Service`
- Search by port, process, project, address, or command
- Filter by port range, process owner, and bind scope
- Sort by port, process name, owner, or scope
- Distinguish loopback-only listeners from network-facing listeners
- Menu bar Quick View plus a complete desktop window
- Copyable, fully visible command details
- Read-only operation with no administrator helper
- Platform scanner abstraction prepared for future Linux support

<p align="center">
  <img src="docs/images/hostlens-ports-quick-view.png"
       width="430"
       alt="HostLens Ports menu bar Quick View">
</p>

## Quick start

### Requirements

- macOS
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
| Ubuntu | Planned |
| Red Hat Enterprise Linux | Planned |

The scanner is behind a platform-neutral interface so Linux can use `ss`,
`/proc`, and `systemd` without changing the renderer.

## Project structure

```text
src/
├── main/
│   ├── index.ts                 Electron windows, tray, and IPC
│   └── scanners/                Platform scanners and process identity
├── preload/
│   └── index.ts                 Restricted renderer bridge
├── renderer/
│   └── src/                     React interface
└── shared/
    └── ports.ts                 Shared typed data model
```

## Development commands

```bash
yarn dev        # Start Electron in development mode
yarn typecheck  # Check main, preload, and renderer TypeScript
yarn test       # Run scanner and process-identity tests
yarn build      # Create a production application build
yarn dist:mac   # Create unsigned local .dmg and .zip artifacts
```

`yarn dist:mac` intentionally disables automatic certificate discovery.
Public macOS releases should be signed with a Developer ID certificate and
notarized before distribution.

## Roadmap

- UDP sockets
- Linux scanners for Ubuntu and RHEL
- launchd, Homebrew, Docker, and systemd source attribution
- Port-change history and notifications
- Optional multi-host view
- Accessibility and localization improvements

HostLens will remain useful without AI. Any future diagnostic assistant should
be optional and operate on structured, explicitly selected local information.

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
