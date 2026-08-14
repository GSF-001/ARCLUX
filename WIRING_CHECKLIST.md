# ARCLUX — Wiring Checklist

Read this after implementing a stub file or creating a new package.
Writing logic alone is not enough if nothing calls it.

## 1. Who calls this file?
New code must be called from somewhere already live (CLI, API route,
or the daemon). Otherwise it's "implemented" but not "integrated" --
see the definition of done in ARCHITECTURE_MAP.md.

## 2. Does this need to connect to the Daemon?
The daemon (packages/daemon/ArcluxDaemon.ts) automatically re-reads
files in the analyzed repository on every change. That part is free.
A NEW package/feature in ARCLUX itself is NOT automatically picked up.
To wire it in: open ArcluxDaemon.ts, add your call inside
`this.watcher.on("analysis:updated", ...)` (follow the runDiagnostics
pattern already there), emit via kernel.signalBus if needed, and add a
route in LocalBridgeServer.ts if it should be exposed externally.

## 3. Does this need to connect to the CLI?
Create apps/cli/<name>.ts, register it in apps/cli/index.ts (import +
register<Name>Command(program)) -- follow the diagnose.ts pattern.

## 4. Check the real data shape, don't guess
cat the actual file before calling it. Detectors/modules have
non-uniform return shapes -- confirmed individually, never assumed.

## 5. Verify before committing
Run tsc --noEmit AND actually run the CLI command if applicable.
Typecheck passing does not guarantee runtime works.

## 6. Check you're on the right branch
Always start from ARCLUX.main, not main -- they have diverged before.

## 7. Document it
Use scripts/log-progress.sh. State what's implemented, what calls it,
whether it's verified running, and what's still not wired up.
