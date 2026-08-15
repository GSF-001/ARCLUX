---
title: How to Use ARCLUX
sidebar_position: 3
---

# How to Use ARCLUX

Everything ARCLUX can do today, from a one-off CLI check to always-on background analysis with editor integration.

## 1. One-off CLI commands

Point any command at a local repo path (defaults to .):

```bash
npx tsx apps/cli/index.ts analyze [path]
npx tsx apps/cli/index.ts graph [path]
npx tsx apps/cli/index.ts impact <file> [path]
npx tsx apps/cli/index.ts doctor [path]
npx tsx apps/cli/index.ts diagnose [path]
npx tsx apps/cli/index.ts diff <from> <to> [path]
npx tsx apps/cli/index.ts verify [path]
npx tsx apps/cli/index.ts config [path]
```

diagnose output includes clickable file paths (OSC 8 hyperlinks) in terminals that support it (Termux, iTerm2, VS Code integrated terminal) -- tap/click to open the file directly.

## 2. Always-on daemon

Instead of re-running commands by hand, start ARCLUX as a background process that watches your repo and re-analyzes on every save:

```bash
npx tsx apps/cli/index.ts daemon --detach
npx tsx apps/cli/index.ts daemon --status
npx tsx apps/cli/index.ts daemon --stop
```

Run without --detach to see live output in the foreground instead.

The daemon exposes a local HTTP+SSE bridge so any editor or terminal can connect:

```bash
curl http://127.0.0.1:<port>/analysis
curl http://127.0.0.1:<port>/events
```

Find the port from ~/.arclux/endpoints/<daemonId>.json, written automatically when the daemon starts.

## 3. Web dashboard

```bash
cd apps/web
pnpm run dev
```

Open localhost:3000/<org>/<repo> for a given GitHub URL. From the Overview page:
- Click any file in the Project structure tree to open it
- The File tab shows syntax-highlighted source (Python, JavaScript, TypeScript today) with inline diagnostic gutter markers -- a colored bar on any line with a finding, click it to expand the message + fix suggestion
- Dependencies and Impact tabs show what a file needs and what breaks if you change it
- Click the < chevron to collapse the tree and give the file panel full width

The Graph page renders the full dependency graph; selecting a node opens a focus panel showing what it needs and what it affects.

## 4. VS Code extension

Connects to a running daemon and surfaces diagnostics in VS Code's Problems panel + a status bar module count.

```bash
cd apps/vscode-extension
pnpm install && pnpm build
```

Then load it via VS Code's Extension Development Host. Requires a daemon already running for the workspace folder (daemon --detach from step 2).

## Where to go next

- architecture.md -- core vs extension-point package boundaries
- status.md -- what's solid vs still a stub
- gotchas.md -- environment traps worth knowing before debugging
