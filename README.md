# HostLens Ports

A lightweight desktop app for viewing listening ports and their processes on
macOS and Linux.

The first usable macOS version includes:

- Electron + React + TypeScript + Vite
- menu bar / system tray entry
- custom popover-style window
- live TCP listener collection using macOS `lsof`
- process command and ownership enrichment using `ps`
- searchable port list with local/network exposure labels
- process detail panel
- platform scanner abstraction for future macOS and Linux implementations

The MVP intentionally has no LLM, database, history, elevated helper, or
mutation features.

## Development

```bash
yarn install
yarn dev
```

`yarn install` also downloads the Electron runtime required by development
mode.

## Validation

```bash
yarn typecheck
yarn build
yarn test
```

To create local macOS `.dmg` and `.zip` artifacts:

```bash
yarn dist:mac
```

The local packaging command intentionally skips signing. A public release
should be built with a Developer ID identity and notarized before distribution.

## Project boundaries

The renderer never executes system commands. Port collection belongs in the
Electron main process behind the `PortScanner` interface. The macOS adapter is
live; the Linux adapter remains isolated behind the same interface and
currently returns clearly labeled sample data until its `ss` implementation is
added.
