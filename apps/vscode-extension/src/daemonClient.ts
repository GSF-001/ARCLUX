// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Reads the daemon's ServiceEndpoint discovery file (same file
// packages/networking/ServiceEndpoint.ts writes -- see
// computeDaemonId in packages/daemon/DaemonProcess.ts for how the id
// is derived from a repo root path) and subscribes to its SSE stream.
// Also exposes the /analysis and /impact endpoints for polling and
// editor-side impact queries, plus auto-reconnecting SSE so the
// extension recovers when the daemon restarts or the connection drops.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as https from "https";
import * as http from "http";

export interface DaemonEndpoint {
  host: string;
  port: number;
  baseUrl: string;
}

export interface AnalysisSnapshot {
  moduleCount: number;
  meta: { name?: string; defaultBranch?: string; provider?: string };
  graph?: { nodes: number; edges: number };
  scan?: { filesScanned: number; filesParsed: number };
}

export interface ImpactQuery {
  ok: boolean;
  file: string;
  moduleId?: string;
  error?: string;
  suggestions?: string[];
  consumers?: string[];
  directConsumers?: number;
  affected?: { moduleId: string; filePath: string; distance: number }[];
  totalAffected?: number;
}

function arcluxRoot(): string {
  return process.env.ARCLUX_ROOT || path.join(os.homedir(), ".arclux");
}

function endpointsDir(): string {
  return path.join(arcluxRoot(), "endpoints");
}

/** Same id derivation as packages/daemon/DaemonProcess.ts's computeDaemonId -- duplicated here (not imported) because the extension is a separate npm package with no dependency on the monorepo's packages/*. */
function computeDaemonId(rootPath: string): string {
  const crypto = require("crypto");
  return crypto.createHash("sha1").update(rootPath).digest("hex").slice(0, 12);
}

export function findDaemonEndpoint(repositoryRoot: string): DaemonEndpoint | null {
  const daemonId = computeDaemonId(repositoryRoot);
  const file = path.join(endpointsDir(), `${daemonId}.json`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as DaemonEndpoint;
  } catch {
    return null;
  }
}

/**
 * Watches the daemon endpoint directory. Fires immediately if endpoints
 * already exist, then whenever a file is added/removed/renamed. Returns a
 * dispose function. The watcher survives endpoint files appearing later
 * (daemon started after the editor) or being removed (daemon stopped).
 */
export function watchEndpointsDir(onChange: (endpoints: DaemonEndpoint[]) => void): () => void {
  let disposed = false;
  const dir = endpointsDir();

  const scan = () => {
    if (disposed) return;
    let endpoints: DaemonEndpoint[] = [];
    try {
      endpoints = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as DaemonEndpoint);
    } catch {
      // Directory doesn't exist yet — the daemon creates it on first start.
    }
    onChange(endpoints);
  };

  scan();

  let watcher: fs.FSWatcher | null = null;
  try {
    fs.mkdirSync(dir, { recursive: true });
    watcher = fs.watch(dir, (eventType, filename) => {
      if (filename?.endsWith(".json")) scan();
    });
  } catch {
    // Fall back to polling in case fs.watch is unavailable (some
    // network filesystems).
    const timer = setInterval(scan, 5000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }

  return () => {
    disposed = true;
    watcher?.close();
  };
}

function requestJson<T>(baseUrl: string, route: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = http.get(`${baseUrl}${route}`, (res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => (body += chunk.toString()));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error((parsed && parsed.error) || `HTTP ${res.statusCode}`));
            return;
          }
          resolve(parsed as T);
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    });
    req.on("error", reject);
  });
}

/** GET /analysis — current analysis state, for polling. */
export function fetchAnalysis(endpoint: DaemonEndpoint): Promise<AnalysisSnapshot> {
  return requestJson<AnalysisSnapshot>(endpoint.baseUrl, "/analysis");
}

/** GET /impact?file= — consumers + transitive affected set for one file. */
export function fetchImpact(endpoint: DaemonEndpoint, filePath: string): Promise<ImpactQuery> {
  return requestJson<ImpactQuery>(endpoint.baseUrl, `/impact?file=${encodeURIComponent(filePath)}`);
}

export interface DaemonSseHandlers {
  onAnalysis?: (data: unknown) => void;
  onDiagnostics?: (data: unknown) => void;
  onError?: (err: Error) => void;
}

/**
 * Subscribes to the daemon's GET /events SSE stream with automatic
 * reconnect. Reconnects on any connection drop with backoff (1s, 2s,
 * 4s, …, capped at 30s) while the stream is not explicitly closed.
 * Returns a function to close the connection permanently.
 */
export function subscribeDaemonEvents(endpoint: DaemonEndpoint, handlers: DaemonSseHandlers): () => void {
  let closed = false;
  let req: http.ClientRequest | null = null;
  let retryDelay = 1000;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (closed) return;
    req = http.get(`${endpoint.baseUrl}/events`, (res) => {
      retryDelay = 1000; // reset backoff on successful (re)connect
      let buffer = "";
      res.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const eventLine = part.split("\n").find((l) => l.startsWith("event: "));
          const dataLine = part.split("\n").find((l) => l.startsWith("data: "));
          if (!eventLine || !dataLine) continue;
          const event = eventLine.slice("event: ".length);
          try {
            const data = JSON.parse(dataLine.slice("data: ".length));
            if (event === "analysis") handlers.onAnalysis?.(data);
            if (event === "diagnostics") handlers.onDiagnostics?.(data);
          } catch {
            // Skip malformed frames rather than killing the stream.
          }
        }
      });
      res.on("end", () => scheduleReconnect());
      res.on("error", () => scheduleReconnect());
    });

    req.on("error", (err) => {
      handlers.onError?.(err);
      scheduleReconnect();
    });
  };

  const scheduleReconnect = () => {
    if (closed || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (closed) return;
      connect();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30000);
  };

  connect();

  return () => {
    closed = true;
    if (retryTimer) clearTimeout(retryTimer);
    req?.destroy();
  };
}