// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// The "any editor/terminal can talk to ARCLUX" layer. Plain HTTP + SSE
// (Server-Sent Events), not a custom protocol -- any tool that can do
// `curl`/`fetch` can read GET /analysis, and any tool that can read an
// SSE stream (trivial in every language/editor plugin ecosystem) can
// subscribe to /events for live push updates, instead of polling.
// Deliberately not full LSP (JSON-RPC, capability negotiation, textDocument
// sync) -- this exposes repository-level intelligence (graph/impact/
// diagnostics), not per-keystroke document sync, so LSP's complexity buys
// nothing here. Wraps ArcluxDaemon -- does not reimplement analysis/watching.

import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import type { ArcluxDaemon } from "./ArcluxDaemon";

export interface LocalBridgeServer {
  port: number;
  close(): Promise<void>;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(payload);
}

/**
 * Starts an HTTP server exposing:
 *   GET  /analysis     -- current analysis (moduleCount, meta), same data as `arclux analyze`
 *   GET  /diagnostics   -- last diagnostics run (see packages/diagnostics/DiagnosticEngine.ts)
 *   GET  /events        -- SSE stream: emits "analysis" and "diagnostics" events as they happen
 * Listens on `port` (see packages/networking/PortManager.ts for how the
 * caller should pick one).
 */
export function startLocalBridgeServer(daemon: ArcluxDaemon, port: number): Promise<LocalBridgeServer> {
  const sseClients = new Set<ServerResponse>();
  let lastDiagnostics: unknown = null;

  daemon.kernel.signalBus.on("daemon:analysis:updated", (data: unknown) => {
    broadcastSse("analysis", data);
  });
  daemon.kernel.signalBus.on("daemon:diagnostics:updated", (data: unknown) => {
    // Keep the last run so GET /diagnostics has something to serve even
    // after the SSE event is gone — found missing by the #347 runtime
    // verification (the route was documented but never implemented).
    lastDiagnostics = data;
    broadcastSse("diagnostics", data);
  });

  function broadcastSse(event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
      client.write(payload);
    }
  }

  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";

    if (url === "/analysis") {
      try {
        const result = await daemon.getAnalysis();
        sendJson(res, 200, { moduleCount: result.moduleCount, meta: result.meta });
      } catch (err) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    if (url === "/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      res.write(": connected\n\n");
      sseClients.add(res);
      req.on("close", () => sseClients.delete(res));
      return;
    }

    if (url === "/diagnostics") {
      // Last diagnostics run, or an explicit "not run yet" — a null
      // response would be indistinguishable from a bug.
      sendJson(
        res,
        200,
        lastDiagnostics ?? { findings: [], ran: false, at: null }
      );
      return;
    }

    sendJson(res, 404, { error: `unknown route: ${url}` });
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      resolve({
        port,
        close: () =>
          new Promise<void>((closeResolve) => {
            for (const client of sseClients) client.end();
            server.close(() => closeResolve());
          }),
      });
    });
  });
}
