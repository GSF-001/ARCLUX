// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// server.ts — PRODUCTION server launcher: satu fungsi untuk SELF-HOST satu region
// (D-009 self-host per shard, D-006 region). Komunitas tinggal panggil
// `createGameServer(...)` → listen → dunia live, client nggak perlu setup lain.
//
// Wire lengkap (bukan yatim):
//   WorldRegion (authoritative state)
//     + EnvironsState (star/planet orbit, D-020)
//     + SimulationEngine (tick loop, validasi intent, fisika, collision, thermic, cosmic)
//     + HTTP transport (/snapshot, /intent, /deliver)
//     + TickScheduler (10 tick/s fixed timestep)
//
// Server URL di-register ke `packages/directory` (DIRECTORY ≠ AUTHORITY) supaya
// client/main discover region public via `listServers`.
//
// Produk: komunitas host sendiri server. Kita CUKUP sediain launcher reliable ini.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { WorldRegion } from "./world";
import { SimulationEngine, type SimulationOptions } from "./simulation";
import { createEnvirons, type SystemBody } from "./environs";
import { createTickScheduler } from "./tickScheduler";
import type { PlayerIntent, Vec3, VesselEntity } from "./types";
import type { VesselModel } from "../universe/types";
import { registerServer, heartbeat } from "../directory/registry";

export interface GameServerBodies {
  /** Wajib ada minimal satu star (energi & orbit reference, 01 §2.6). */
  star: { radius: number; position?: Vec3 };
  planets?: Array<{ radius: number; semiMajorAxis: number; eccentricity?: number; periodTicks: number; phase?: number; inclination?: number }>;
}

export interface GameServerOptions {
  /** Region identifier (unik per shard). Default "region-1". */
  regionId?: string;
  regionName?: string;
  /** Listen port (default 24001, dari ARCLUX_GAME_PORT bila di-set). */
  port?: number;
  /** Tick per second (default 10). */
  tickRate?: number;
  /** Body definitions (star + planets). Provide a default if omitted. */
  bodies?: GameServerBodies;
  /** Registered in the public directory for client discovery. */
  register?: boolean;
  /** Root dir berisi client bundle (index.html + assets) — kalau di-set, game
   *  client disajikan juga di `/`. Pemain buka `http://<host>:<port>/` langsung
   *  main, tanpa install client terpisah. */
  staticDir?: string;
  /** On each tick result (observability). */
  onTick?: (tick: number, snapshot: ReturnType<SimulationEngine["step"]>["snapshot"]) => void;
}

export interface GameServerHandle {
  region: WorldRegion;
  engine: SimulationEngine;
  port: number;
  url: string;
  start(): Promise<{ url: string; port: number }>;
  /** Send a client intent into the sim queue. */
  submit(intent: PlayerIntent): void;
  spawnPlayerVessel(opts: { playerId: string; vessel: VesselModel; position?: Vec3 }): VesselEntity;
  stop(): Promise<void>;
}

function defaultBodies(regionId: string): SystemBody[] {
  return [
    { id: `${regionId}:star`, kind: "star", mass: 1.989e30, radius: 6.95e8, collidable: true, position: { x: 0, y: 0, z: 0 }, orbit: { semiMajorAxis: 0, eccentricity: 0, periodTicks: 1, phase: 0 } },
    { id: `${regionId}:p1`, kind: "planet", mass: 5.972e24, radius: 6.37e6, collidable: true, position: { x: 1.5e11, y: 0, z: 0 }, orbit: { parentId: `${regionId}:star`, semiMajorAxis: 1.5e11, eccentricity: 0.0167, periodTicks: 3600, phase: 0 } },
    { id: `${regionId}:p2`, kind: "planet", mass: 6.39e23, radius: 3.38e6, collidable: true, position: { x: 0, y: 0, z: 2.2e11 }, orbit: { parentId: `${regionId}:star`, semiMajorAxis: 2.28e11, eccentricity: 0.093, periodTicks: 6867, phase: 2.2 } },
    { id: `${regionId}:p3`, kind: "planet", mass: 8.93e22, radius: 2.6e6, collidable: true, position: { x: -4e11, y: 0, z: 0 }, orbit: { parentId: `${regionId}:star`, semiMajorAxis: 5.4e11, eccentricity: 0.0, periodTicks: 14160, phase: 4.1 } },
  ];
}

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

/** Minimal default auth provider: any playerId is a trusted actor.
 *  Production: replace with your community identity/roles (packages/directory). */
function defaultAuthProvider(): SimulationOptions["authProvider"] {
  return (playerId: string) => ({ playerId, auth: { actor: playerId } });
}

export function createGameServer(opts: GameServerOptions = {}): GameServerHandle {
  const regionId = opts.regionId ?? "region-1";
  const regionName = opts.regionName ?? regionId;
  const port = opts.port ?? resolvePort();
  const tickRate = opts.tickRate ?? 10;
  const dt = 1 / tickRate;

  const region = new WorldRegion(regionId, regionName);
  const bodies: SystemBody[] = opts.bodies
    ? ([
        { id: `${regionId}:star`, kind: "star" as const, mass: 1.989e30, radius: opts.bodies.star.radius, collidable: true, position: opts.bodies.star.position ?? { x: 0, y: 0, z: 0 }, orbit: { semiMajorAxis: 0, eccentricity: 0, periodTicks: 1, phase: 0 } },
        ...(opts.bodies.planets ?? []).map((p, i) => ({
          id: `${regionId}:p${i + 1}`,
          kind: "planet" as const,
          mass: 5.972e24,
          radius: p.radius,
          collidable: true,
          position: { x: p.semiMajorAxis, y: 0, z: 0 },
          orbit: { parentId: `${regionId}:star`, semiMajorAxis: p.semiMajorAxis, eccentricity: p.eccentricity ?? 0, periodTicks: p.periodTicks, phase: p.phase ?? 0, inclination: p.inclination },
        })),
      ] satisfies SystemBody[])
    : defaultBodies(regionId);

  const environsState = createEnvirons(bodies);
  const engine = new SimulationEngine({
    region,
    dt,
    environs: environsState,
    enableEnvirons: true,
    authProvider: defaultAuthProvider(),
  });

  const server: Server = createServer(async (req, res) => {
    try {
      const u = new URL(req.url ?? "/", "http://localhost");
      if (req.method === "GET" && u.pathname === "/snapshot") {
        sendJson(res, 200, region.snapshot());
        return;
      }
      if (req.method === "GET" && u.pathname === "/health") {
        sendJson(res, 200, { ok: true, tick: region.tick, entities: region.snapshot().entities.length, regionId });
        return;
      }
      if (req.method === "POST" && u.pathname === "/intent") {
        const intent = (await readBody(req)) as PlayerIntent;
        if (!intent || typeof intent.type !== "string" || typeof intent.entityId !== "string") {
          sendJson(res, 400, { ok: false, reason: "invalid intent" });
          return;
        }
        engine.enqueue(intent);
        sendJson(res, 200, { ok: true, seq: intent.seq ?? 0 });
        return;
      }
      if (req.method === "POST" && u.pathname === "/deliver") {
        const h = (await readBody(req)) as { vesselId: string; owner?: string; position?: Vec3; vessel: VesselModel };
        if (!h || typeof h.vesselId !== "string" || !h.vesselId || !h.vessel) { sendJson(res, 400, { ok: false, reason: "invalid handoff payload" }); return; }
        if (region.has(h.vesselId)) { sendJson(res, 200, { ok: false, reason: `entity already exists: ${h.vesselId}` }); return; }
        region.spawnVessel({ id: h.vesselId, owner: h.owner, vessel: h.vessel, position: h.position });
        sendJson(res, 200, { ok: true });
        return;
      }
      // Static client — GET selain /snapshot & /health → serve dari staticDir.
      if (req.method === "GET" && opts.staticDir) {
        await serveStaticFile(req, res, u.pathname, opts.staticDir);
        return;
      }
      sendJson(res, 404, { ok: false, reason: `unknown ${req.method} ${u.pathname}` });
    } catch (e) {
      sendJson(res, 500, { ok: false, reason: (e as Error).message });
    }
  });

  let scheduler: ReturnType<typeof createTickScheduler> | null = null;
  let running = false;

  return {
    region,
    engine,
    port,
    url: `http://127.0.0.1:${port}`,
    start: async () => {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => resolve());
      });
      scheduler = createTickScheduler({
        tickMs: dt * 1000,
        onTick: () => {
          const result = engine.step();
          opts.onTick?.(result.tick, result.snapshot);
        },
        onError: (e) => { console.error("[arclux:gameserver] tick error", e); },
      });
      scheduler.start();
      running = true;
      if (opts.register !== false) {
        registerServer({
          serverId: regionId,
          name: regionName,
          endpoint: `http://127.0.0.1:${port}`,
          visibility: "public",
          version: "1.0.0",
          regions: 1,
          population: 0,
          federation: "PUBLIC",
        });
        heartbeat(regionId, { status: "ONLINE", population: region.snapshot().entities.length, regions: 1 });
      }
      return { url: `http://127.0.0.1:${port}`, port };
    },
    submit(intent) {
      engine.enqueue(intent);
    },
    spawnPlayerVessel({ playerId, vessel, position }) {
      const id = vessel.id;
      if (region.has(id)) return region.get(id) as VesselEntity;
      const entity = region.spawnVessel({ id, owner: playerId, vessel, position: position ?? { x: 4e9, y: 0, z: 0 } });
      // seed a tiny drift so "new ship" isn't confused with docked/static
      entity.velocity = { x: 8, y: 0, z: 3 };
      return entity;
    },
    stop: async () => {
      scheduler?.stop();
      running = false;
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

function resolvePort(): number {
  try {
    const g: any = globalThis as any;
    const raw = g.process?.env?.ARCLUX_GAME_PORT;
    if (raw) { const n = Number(raw); if (!Number.isNaN(n) && n > 0) return n; }
    if (g.__ARCLUX_GAME_PORT__) return Number(g.__ARCLUX_GAME_PORT__);
  } catch {}
  return 24001;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

/** Sajikan file statis dari staticDir dengan path traversal protection. */
async function serveStaticFile(_req: IncomingMessage, res: ServerResponse, pathname: string, staticDir: string): Promise<void> {
  try {
    const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const safeRel = path.posix.normalize(rel);
    // path traversal guard — jangan biarkan ../ keluar dari staticDir
    if (safeRel.startsWith("..") || safeRel.includes("../")) {
      sendJson(res, 403, { ok: false, reason: "invalid path" });
      return;
    }
    const filePath = path.join(staticDir, safeRel);
    const st = await stat(filePath);
    if (!st.isFile()) { sendJson(res, 404, { ok: false, reason: "not found" }); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "content-type": MIME[ext] ?? "application/octet-stream", "cache-control": "no-cache" });
    res.end(await readFile(filePath));
  } catch {
    sendJson(res, 404, { ok: false, reason: "not found" });
  }
}
