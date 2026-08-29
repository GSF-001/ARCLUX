// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// netcode.ts — transport jaringan utk runtime terpisah (D-009 self-host, tiap
// shard = proses/host sendiri). Zero new dependency: pakai node:http built-in
// lintas proses/host dengan payload JSON.
//
// Yang disediakan:
//   - createInProcessTransport(engine) — transport in-process (buat tes cepat /
//     prototype; sendIntent→engine.enqueue, tick→engine.step, requestSnapshot→snapshot).
//   - createHttpServerTransport(region, port) — HTTP server per shard:
//       GET  /snapshot → region.snapshot()
//       POST /deliver  → materialkan vessel di region ini (handoff dari shard lain)
//   - createHttpClientTransport(url) — client HTTP ke shard lain:
//       requestSnapshot(), deliver(...)
//
// Pemisahan: netcode hanya transport (pindah data). Otorisasi/validasi tetep di
// validator/simulation — server penerima yang authoritative (D-008). Handoff
// token sudah crash-safe via gate/persistence (liat gate.ts + recoverPendingHandoffs).

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { WorldRegion } from "./world";
import type { SimulationEngine } from "./simulation";
import type { PlayerIntent } from "./types";

/** Ringkasan snapshot yang aman di-serialize (RegionSnapshot = world.snapshot). */
export type RegionSnapshot = ReturnType<WorldRegion["snapshot"]>;

/** Payload deliver: handoff vessel dari shard lain → materialkan di region ini. */
export interface NetworkHandoff {
  vesselId: string;
  owner?: string;
  position?: { x: number; y: number; z: number };
  /** VesselModel serializable — di materialize jadi VesselEntity oleh region. */
  vessel: import("../universe/types").VesselModel;
}

/** Kontrak transport yang bisa dipertukarkan (in-process ↔ HTTP). */
export interface TransportClient {
  requestSnapshot(): Promise<RegionSnapshot>;
  deliver(h: NetworkHandoff): Promise<{ ok: boolean; reason?: string }>;
}

/** In-process transport — buat tes cepat / prototype (docs PR #589). */
export function createInProcessTransport(engine: SimulationEngine): TransportClient {
  return {
    async requestSnapshot() {
      return engine.region.snapshot();
    },
    async deliver(h) {
      if (engine.region.has(h.vesselId)) {
        return { ok: false, reason: `entity already exists: ${h.vesselId}` };
      }
      engine.region.spawnVessel({
        id: h.vesselId,
        owner: h.owner,
        vessel: h.vessel,
        position: h.position,
      });
      return { ok: true };
    },
  };
}

/** HTTP transport client — bicara ke createHttpServerTransport di shard lain. */
export function createHttpClientTransport(baseUrl: string): TransportClient {
  const post = (path: string, body: unknown): Promise<any> =>
    fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then((res) => res.json());

  const get = (path: string): Promise<any> =>
    fetch(`${baseUrl}${path}`).then((res) => res.json());

  return {
    async requestSnapshot() {
      return get("/snapshot") as Promise<RegionSnapshot>;
    },
    async deliver(h) {
      const r = await post("/deliver", h);
      return r as { ok: boolean; reason?: string };
    },
  };
}

export interface HttpServerTransport {
  /** URL absolut (http://127.0.0.1:<port>) utk dipakai client lain. */
  url: string;
  /** Mulai listen (async). */
  listen(): Promise<void>;
  /** Tutup server. */
  close(): Promise<void>;
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/**
 * HTTP server transport — media shard (proses/host terpisah) menerima handoff &
 * melayani snapshot dari shard/client lain. Server ini hanya otorisasi data;
 * kebenaran sim tetap di SimulationEngine setempat.
 */
export function createHttpServerTransport(region: WorldRegion, port: number): HttpServerTransport {
  const server: Server = createServer(async (req, res) => {
    try {
      const u = new URL(req.url ?? "/", "http://localhost");
      if (req.method === "GET" && u.pathname === "/snapshot") {
        sendJson(res, 200, region.snapshot());
        return;
      }
      if (req.method === "POST" && u.pathname === "/deliver") {
        const h = (await readBody(req)) as NetworkHandoff;
        if (!h || typeof h.vesselId !== "string" || !h.vesselId) {
          sendJson(res, 400, { ok: false, reason: "invalid handoff payload" });
          return;
        }
        if (region.has(h.vesselId)) {
          sendJson(res, 200, { ok: false, reason: `entity already exists: ${h.vesselId}` });
          return;
        }
        region.spawnVessel({
          id: h.vesselId,
          owner: h.owner,
          vessel: h.vessel,
          position: h.position,
        });
        sendJson(res, 200, { ok: true });
        return;
      }
      sendJson(res, 404, { ok: false, reason: `unknown ${req.method} ${u.pathname}` });
    } catch (e) {
      sendJson(res, 500, { ok: false, reason: (e as Error).message });
    }
  });

  const url = `http://127.0.0.1:${port}`;

  return {
    url,
    listen() {
      return new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => resolve());
      });
    },
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

export { AddressInfo };
export type { PlayerIntent };
