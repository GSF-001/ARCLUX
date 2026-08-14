/**
 * Copyright 2026 Mikatoshi
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { ProcessEntry } from "../shared/types";
import { writeTransactional } from "./RecoveryManager";

/**
 * File-based persistence for kernel process state.
 *
 * The Kernel's ProcessTable is in-memory and scoped to a single Node
 * process. Any command that runs as a separate process (e.g. the CLI's
 * `ps`) needs a way to see what's registered without sharing memory.
 *
 * This module writes one small JSON file per process under
 * `~/.arclux/pids/<id>.json`, and treats the filesystem as the source
 * of truth across process boundaries. Reads are always "live-checked":
 * before returning a record, we confirm the OS still has that PID
 * running via `process.kill(pid, 0)` (a no-op signal used purely to
 * test existence — it does not kill anything). Records for PIDs that
 * are no longer alive are deleted as they're found, so the directory
 * self-cleans instead of accumulating stale entries left behind by
 * processes that died without a clean shutdown.
 */

function arcluxRoot(): string {
  return process.env.ARCLUX_ROOT || path.join(os.homedir(), ".arclux");
}

function pidsDir(): string {
  return path.join(arcluxRoot(), "pids");
}

function recordPath(id: string): string {
  return path.join(pidsDir(), `${id}.json`);
}

function ensurePidsDir(): void {
  fs.mkdirSync(pidsDir(), { recursive: true });
}

/**
 * Returns true if the given pid is currently alive on this machine.
 * `process.kill(pid, 0)` sends no actual signal — it only asks the OS
 * whether it *could* deliver one, throwing ESRCH if the pid is gone.
 */
function isPidAlive(pid: number | null): boolean {
  if (pid === null) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Write (or overwrite) the on-disk record for a single process entry. */
export function writeProcessRecord(entry: ProcessEntry): void {
  ensurePidsDir();
  // Goes through the journal (packages/storage/RecoveryManager.ts) instead
  // of a plain writeFileSync, so a crash mid-write is redoable on next
  // startup instead of leaving a half-written record that readLiveProcessRecords
  // would otherwise have to detect-and-delete (data loss) further down.
  writeTransactional(recordPath(entry.id), JSON.stringify(entry, null, 2));
}

/** Remove the on-disk record for a process, if it exists. */
export function removeProcessRecord(id: string): void {
  try {
    fs.unlinkSync(recordPath(id));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

/**
 * Read every persisted process record, dropping (and deleting) any
 * whose PID is no longer alive. This is the function CLI/dashboard
 * code should call to list processes — it never returns a record for
 * something that has actually died, even if the process itself
 * crashed before it could clean up its own record.
 */
export function readLiveProcessRecords(): ProcessEntry[] {
  let files: string[];
  try {
    files = fs.readdirSync(pidsDir());
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const live: ProcessEntry[] = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const fullPath = path.join(pidsDir(), file);

    let entry: ProcessEntry;
    try {
      entry = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    } catch {
      // Corrupt or half-written record (e.g. crash mid-write) — remove
      // it rather than let a bad file crash every future `ps` call.
      fs.unlinkSync(fullPath);
      continue;
    }

    if (isPidAlive(entry.pid)) {
      live.push(entry);
    } else {
      removeProcessRecord(entry.id);
    }
  }

  return live;
}
