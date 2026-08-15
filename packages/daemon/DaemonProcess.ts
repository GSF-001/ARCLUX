// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Detaches the daemon into a real background process, same pattern PM2
// (already referenced for packages/runtime/ProcessManager.ts) uses:
// spawn with detached:true + unref() so the child outlives the parent
// CLI invocation, stdio redirected to a log file since there's no
// terminal to write to once detached, and a pid file so `daemon stop`/
// `daemon status` from a LATER, unrelated CLI invocation can find it.

import { spawn } from "node:child_process";
import { openSync, existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import * as os from "os";
import * as path from "path";

function arcluxRoot(): string {
  return process.env.ARCLUX_ROOT || path.join(os.homedir(), ".arclux");
}

/**
 * Stable id derived from a repository root path. Used to key the pid file
 * here AND the service endpoint file in packages/networking/ServiceEndpoint.ts
 * -- same id, so `daemon status` and a future editor extension agree on
 * which daemon instance they're talking about for a given repo.
 */
export function computeDaemonId(rootPath: string): string {
  return createHash("sha1").update(rootPath).digest("hex").slice(0, 12);
}

function pidFilePath(daemonId: string): string {
  return path.join(arcluxRoot(), "daemons", `${daemonId}.pid.json`);
}

function logFilePath(daemonId: string): string {
  return path.join(arcluxRoot(), "daemons", `${daemonId}.log`);
}

interface DaemonPidRecord {
  pid: number;
  rootPath: string;
  startedAt: number;
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Spawns `node <cliEntry> daemon <rootPath>` as a detached background
 * process and returns immediately -- does not wait for the daemon to
 * finish starting (the caller should check ServiceEndpoint / daemon
 * status separately if it needs to confirm the bridge is listening).
 */
export function spawnDetached(rootPath: string, cliEntry: string): { pid: number; logFile: string } {
  const daemonId = computeDaemonId(rootPath);
  const dir = path.join(arcluxRoot(), "daemons");
  mkdirSync(dir, { recursive: true });

  const logFile = logFilePath(daemonId);
  const logFd = openSync(logFile, "a");

  // Dev-mode cliEntry is a .ts file whose ESM imports are extensionless
  // (resolved by tsx). Bare `node <cliEntry>` fails with ERR_MODULE_NOT_FOUND
  // on the very first import — found by the #347 runtime verification. The
  // tsx loader fixes it; built .js entries don't need it.
  const loaderArgs = cliEntry.endsWith(".ts") ? ["--import", "tsx"] : [];
  const child = spawn(process.execPath, [...loaderArgs, cliEntry, "daemon", rootPath], {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: { ...process.env, ARCLUX_DAEMON_CHILD: "1" },
  });

  child.unref();

  const record: DaemonPidRecord = { pid: child.pid!, rootPath, startedAt: Date.now() };
  writeFileSync(pidFilePath(daemonId), JSON.stringify(record, null, 2), "utf8");

  return { pid: child.pid!, logFile };
}

/** Returns the pid record for rootPath's daemon if it's currently running, null otherwise (also cleans up a stale pid file if the process has died). */
export function getDaemonStatus(rootPath: string): DaemonPidRecord | null {
  const daemonId = computeDaemonId(rootPath);
  const file = pidFilePath(daemonId);
  if (!existsSync(file)) return null;

  let record: DaemonPidRecord;
  try {
    record = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    unlinkSync(file);
    return null;
  }

  if (!isPidAlive(record.pid)) {
    unlinkSync(file);
    return null;
  }

  return record;
}

export interface DaemonHealthStatus {
  running: boolean;
  pid: number | null;
  startedAt: number | null;
  /** true only if the pid is alive AND the local bridge HTTP server actually
   * responded -- a stale pid file with a crashed bridge server otherwise
   * looks identical to getDaemonStatus()'s pid-only check. */
  bridgeReachable: boolean;
}

/**
 * Like getDaemonStatus(), but also verifies the local bridge server is
 * actually answering HTTP requests, not just that the pid is alive. Reads
 * the port from the service endpoint file written by
 * packages/networking/ServiceEndpoint.ts (createServiceEndpoint /
 * writeServiceEndpoint, called from ArcluxDaemon.start()).
 */
export async function getDaemonHealth(rootPath: string): Promise<DaemonHealthStatus> {
  const status = getDaemonStatus(rootPath);
  if (!status) {
    return { running: false, pid: null, startedAt: null, bridgeReachable: false };
  }

  const daemonId = computeDaemonId(rootPath);
  let bridgeReachable = false;
  try {
    const { readServiceEndpoint } = await import("../networking/ServiceEndpoint");
    const endpoint = readServiceEndpoint(daemonId);
    if (endpoint) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`http://127.0.0.1:${endpoint.port}/analysis`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      bridgeReachable = res.ok;
    }
  } catch {
    bridgeReachable = false;
  }

  return { running: true, pid: status.pid, startedAt: status.startedAt, bridgeReachable };
}

/** Sends SIGTERM to a running detached daemon for rootPath. Returns false if none was running. */
export function stopDetached(rootPath: string): boolean {
  const status = getDaemonStatus(rootPath);
  if (!status) return false;

  process.kill(status.pid, "SIGTERM");
  unlinkSync(pidFilePath(computeDaemonId(rootPath)));
  return true;
}
