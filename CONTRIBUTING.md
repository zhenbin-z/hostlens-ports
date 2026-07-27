# Contributing to HostLens Ports

Thanks for helping improve HostLens Ports.

## Before you start

- Search existing issues before opening a new one.
- Keep changes focused on one problem.
- Do not include usernames, secrets, customer names, or private paths in
  screenshots, logs, fixtures, or test output.
- Discuss large features in an issue before investing in an implementation.

## Development setup

```bash
git clone https://github.com/zhenbin-z/hostlens-ports.git
cd hostlens-ports
yarn install
yarn dev
```

HostLens currently uses Yarn Classic. Please do not commit an npm or pnpm lock
file.

## Architecture rules

- React renderer code must not execute shell commands.
- System inspection belongs in the Electron main process.
- Renderer access must pass through the typed preload API.
- Platform-specific collection belongs behind the scanner abstraction.
- Collection must remain read-only unless a future feature explicitly
  introduces a reviewed and confirmed mutation.
- Prefer structured scanner results over parsing data in the UI.

## Validate your change

Run all checks before submitting a pull request:

```bash
yarn typecheck
yarn test
yarn build
```

Scanner parsing, classification, and process-name heuristics should include
tests for both expected and malformed input.

## Pull requests

A useful pull request includes:

1. A concise description of the problem.
2. The approach taken.
3. Platforms and versions tested.
4. Screenshots for visible UI changes.
5. Any permission or privacy implications.

By contributing, you agree that your contribution will be licensed under the
Apache License, Version 2.0 used by this repository.
