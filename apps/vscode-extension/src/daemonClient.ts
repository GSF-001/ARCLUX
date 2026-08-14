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
// NOT built/typechecked here -- this repo's Termux environment has no
// network access to install the `vscode` API types package, so this
// file is written against the documented VS Code Extension API but has
// only been reviewed, not compiled. Build with `pnpm install && pnpm
// build` in an environment with npm registry access before relying on it.

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

function arcluxRoot(): string {
  return process.env.ARCLUX_ROOT || path.join(os.homedir(), ".arclux");
}

/** Same id derivation as packages/daemon/DaemonProcess.ts's computeDaemonId -- duplicated here (not imported) because the extension is a separate npm package with no dependency on the monorepo's packages/*. */
function computeDaemonId(rootPath: string): string {
  const crypto = require("crypto");
  return crypto.createHash("sha1").update(rootPath).digest("hex").slice(0, 12);
}

export function findDaemonEndpoint(repositoryRoot: string): DaemonEndpoint | null {
  const daemonId = computeDaemonId(repositoryRoot);
  const file = path.join(arcluxRoot(), "endpoints", `${daemonId}.json`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export interface DaemonSseHandlers {
  onAnalysis?: (data: unknown) => void;
  onDiagnostics?: (data: unknown) => void;
  onError?: (err: Error) => void;
}

/** Subscribes to the daemon's GET /events SSE stream. Returns a function to close the connection. */
export function subscribeDaemonEvents(endpoint: DaemonEndpoint, handlers: DaemonSseHandlers): () => void {
  const req = http.get(`${endpoint.baseUrl}/events`, (res) => {
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
        const data = JSON.parse(dataLine.slice("data: ".length));
        if (event === "analysis") handlers.onAnalysis?.(data);
        if (event === "diagnostics") handlers.onDiagnostics?.(data);
      }
    });
  });

  req.on("error", (err) => handlers.onError?.(err));

  return () => req.destroy();
}
