// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// HttpTransport.ts — HTTP transport untuk runtime terpisah (D-009).
// Tiap shard = proses/host sendiri via node:http (zero external dep).

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { WorldRegion } from "../world";
import type { NetworkHandoff, TransportClient, HttpServerTransport } from "./Transport";

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export function createHttpClientTransport(baseUrl: string): TransportClient {
  const post = (path: string, body: unknown) =>
    fetch(`${baseUrl}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((res) => res.json());
  const get = (path: string) => fetch(`${baseUrl}${path}`).then((res) => res.json());
  return {
    async requestSnapshot() { return get("/snapshot") as Promise<import("../types").RegionSnapshot>; },
    async deliver(h) { return (await post("/deliver", h)) as { ok: boolean; reason?: string }; },
  };
}

export function createHttpServerTransport(region: WorldRegion, port: number): HttpServerTransport {
  const server: Server = createServer(async (req, res) => {
    try {
      const u = new URL(req.url ?? "/", "http://localhost");
      if (req.method === "GET" && u.pathname === "/snapshot") { sendJson(res, 200, region.snapshot()); return; }
      if (req.method === "POST" && u.pathname === "/deliver") {
        const h = (await readBody(req)) as NetworkHandoff;
        if (!h || typeof h.vesselId !== "string" || !h.vesselId) { sendJson(res, 400, { ok: false, reason: "invalid handoff payload" }); return; }
        if (region.has(h.vesselId)) { sendJson(res, 200, { ok: false, reason: `entity already exists: ${h.vesselId}` }); return; }
        region.spawnVessel({ id: h.vesselId, owner: h.owner, vessel: h.vessel, position: h.position });
        sendJson(res, 200, { ok: true });
        return;
      }
      sendJson(res, 404, { ok: false, reason: `unknown ${req.method} ${u.pathname}` });
    } catch (e) { sendJson(res, 500, { ok: false, reason: (e as Error).message }); }
  });
  const url = `http://127.0.0.1:${port}`;
  return {
    url,
    listen() { return new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", () => resolve()); }); },
    close() { return new Promise<void>((resolve, reject) => { server.close((err) => (err ? reject(err) : resolve())); }); },
  };
}

/** Resolve port dari env ARCLUX_GAME_PORT (dynamic, fallback 24001). */
export function resolveGamePort(): number {
  try {
    const g: any = globalThis as any;
    const raw = g.process?.env?.ARCLUX_GAME_PORT ?? g.process?.env?.VITE_ARCLUX_GAME_PORT;
    if (raw) { const n = Number(raw); if (!Number.isNaN(n) && n > 0) return n; }
    if (g.__ARCLUX_GAME_PORT__) return Number(g.__ARCLUX_GAME_PORT__);
  } catch {}
  return 24001;
}

export function resolveGameUrl(port?: number): string {
  try { const g: any = globalThis as any; if (g.__ARCLUX_GAME_URL__) return g.__ARCLUX_GAME_URL__; } catch {}
  return `http://127.0.0.1:${port ?? resolveGamePort()}`;
}
