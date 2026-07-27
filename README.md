# HostLens Ports

A lightweight desktop app for viewing listening ports and their processes on
macOS and Linux.

This repository currently contains the first UI scaffold:

- Electron + React + TypeScript + Vite
- menu bar / system tray entry
- custom popover-style window
- searchable placeholder port list
- process detail panel
- platform scanner abstraction for future macOS and Linux implementations

The MVP intentionally has no LLM, database, history, or mutation features.

## Development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run typecheck
npm run build
```

## Project boundaries

The renderer never executes system commands. Port collection belongs in the
Electron main process behind the `PortScanner` interface. The macOS and Linux
adapters currently return placeholder data and are ready to be replaced with
real `lsof` and `ss` implementations.

