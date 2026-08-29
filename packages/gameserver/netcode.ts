// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// netcode.ts — transport layanan untuk runtime terpisah (D-009): tiap shard =
// proses/host sendiri. Dua kontrak yang saling melengkapi:
//
//   createInProcessTransport(opts) — in-process (unit test / prototype):
//     sendIntent→engine.enqueue, tick→engine.step + pump events, requestSnapshot.
//   createHttpServerTransport(region, port) — HTTP server per shard:
//     GET /snapshot, POST /deliver (handoff lintas host).
//   createHttpClientTransport(url) — HTTP client ke shard lain: requestSnapshot, deliver.
//
// Prinsip D-008/D-009: netcode HANYA transport (pindah data). Otorisasi & validasi
// tetap di validator/simulation — server penerima yang authoritative. Handoff token
// crash-safe di gate.ts/persistence.ts (recoverPendingHandoffs).

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { WorldRegion } from "./world";
import type { SimulationEngine } from "./simulation";
import type { GameEvent, PlayerIntent, RegionSnapshot } from "./types";

export type { RegionSnapshot };

/** Payload deliver: handoff vessel dari shard lain → materialkan di region ini. */
export interface NetworkHandoff {
  vesselId: string;
  owner?: string;
  position?: { x: number; y: number; z: number };
  vessel: import("../universe/types").VesselModel;
}

/** Kontrak transport jaringan (client ↔ server lintas host). */
export interface TransportClient {
  requestSnapshot(): Promise<RegionSnapshot>;
  deliver(h: NetworkHandoff): Promise<{ ok: boolean; reason?: string }>;
}

export type NetEvent = GameEvent;

/** Kontrak transport in-process (client ↔ engine, tanpa HTTP). */
export interface NetcodeTransport {
  sendIntent(intent: PlayerIntent): void;
  tick(): void;
  requestSnapshot(): RegionSnapshot | undefined;
  onEvent(handler: (ev: NetEvent) => void): void;
  /** Materialkan vessel dari shard lain (untuk wire ke bridge/relay). */
  deliver(h: NetworkHandoff): Promise<{ ok: boolean; reason?: string }>;
}

export interface NetcodeOptions {
  engine: SimulationEngine;
}

/** In-process transport: bridge ke SimulationEngine + pump event per tick. */
export function createInProcessTransport(opts: NetcodeOptions): NetcodeTransport {
  const handlers: Array<(ev: NetEvent) => void> = [];
  const sendIntent = (intent: PlayerIntent) => opts.engine.enqueue(intent);
  const onEvent = (handler: (ev: NetEvent) => void) => handlers.push(handler);
  const requestSnapshot = (): RegionSnapshot | undefined => opts.engine.region.snapshot();
  const tick = () => {
    const result = opts.engine.step();
    for (const ev of [...result.accepted, ...result.rejected]) for (const h of handlers) h(ev);
  };
  const deliver = async (h: NetworkHandoff): Promise<{ ok: boolean; reason?: string }> => {
    if (opts.engine.region.has(h.vesselId)) {
      return { ok: false, reason: `entity already exists: ${h.vesselId}` };
    }
    opts.engine.region.spawnVessel({ id: h.vesselId, owner: h.owner, vessel: h.vessel, position: h.position });
    return { ok: true };
  };
  return { sendIntent, tick, requestSnapshot, onEvent, deliver };
}

/** HTTP transport client — bicara ke createHttpServerTransport di shard lain. */
export function createHttpClientTransport(baseUrl: string): TransportClient {
  const post = (path: string, body: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then((res) => res.json());
  const get = (path: string) => fetch(`${baseUrl}${path}`).then((res) => res.json());
  return {
    async requestSnapshot() {
      return get("/snapshot") as Promise<RegionSnapshot>;
    },
    async deliver(h) {
      return (await post("/deliver", h)) as { ok: boolean; reason?: string };
    },
  };
}

export interface HttpServerTransport {
  url: string;
  listen(): Promise<void>;
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

/** HTTP server transport — media shard menerima handoff & melayani snapshot. */
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
        region.spawnVessel({ id: h.vesselId, owner: h.owner, vessel: h.vessel, position: h.position });
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
