// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Shape of a reachable service address, plus where the daemon persists
// its own endpoint so any editor/terminal on the same machine can
// discover it without a hardcoded port. Mirrors how packages/storage's
// pids/ directory lets `ps` discover live processes across process
// boundaries -- same pattern, applied to network endpoints.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface ServiceEndpoint {
  host: string;
  port: number;
  /** absolute base URL, e.g. "http://127.0.0.1:4869" */
  baseUrl: string;
}

export function createServiceEndpoint(port: number, host: string = "127.0.0.1"): ServiceEndpoint {
  return { host, port, baseUrl: `http://${host}:${port}` };
}

function arcluxRoot(): string {
  return process.env.ARCLUX_ROOT || path.join(os.homedir(), ".arclux");
}

/** One endpoint file per watched repository root, keyed by an id the caller supplies (e.g. a hash or sanitized path) -- mirrors packages/storage's per-process record-per-file pattern. */
function endpointPath(daemonId: string): string {
  return path.join(arcluxRoot(), "endpoints", `${daemonId}.json`);
}

export function writeServiceEndpoint(daemonId: string, endpoint: ServiceEndpoint): void {
  const dir = path.dirname(endpointPath(daemonId));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(endpointPath(daemonId), JSON.stringify(endpoint, null, 2), "utf8");
}

export function readServiceEndpoint(daemonId: string): ServiceEndpoint | null {
  try {
    return JSON.parse(fs.readFileSync(endpointPath(daemonId), "utf8"));
  } catch {
    return null;
  }
}

export function removeServiceEndpoint(daemonId: string): void {
  try {
    fs.unlinkSync(endpointPath(daemonId));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
