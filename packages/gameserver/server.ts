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
import type { AddressInfo } from "node:net";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { WorldRegion } from "./world";
import { SimulationEngine, type SimulationOptions } from "./simulation";
import { createEnvirons, type SystemBody } from "./environs";
import { createTickScheduler } from "./tickScheduler";
import type { PlayerIntent, Vec3, VesselEntity } from "./types";
import type { VesselModel } from "../universe/types";
import { registerServer, heartbeat, unregisterServer, listServersWithHealth } from "../directory/registry";
import type { ServerStatus } from "../directory/types";
import {
  HANDOFF_HEADER,
  LOGIN_TOKEN_TTL_MS,
  bearerFromHeader,
  isDeliverAllowed,
  resolveAuthSecret,
  resolveHandoffSecret,
  signLoginToken,
  verifyHandoff,
  verifyLoginToken,
} from "./auth";
import { validateIntent } from "./validator";
import { createRateLimiter } from "./rateLimiter";
import { shouldSnapshot } from "./stability";
import { isValidResume, saveSnapshot } from "./regionState";
import type { PersistenceStore } from "./persistence";

/** Heartbeat directory tiap 10s — TTL registry 30s (P0-5): mati → OFFLINE. */
const HEARTBEAT_INTERVAL_MS = 10_000;
/** Batas body POST — readBody menolak >1MB (Sprint 1, eksploit payload raksasa). */
export const MAX_BODY_BYTES = 1024 * 1024;

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
  /** Bind host (default "127.0.0.1" — self-host D-009). */
  host?: string;
  /** Auth login P0-2: `false` = matikan (hanya dev/embedded — production
   *  wajib ON). Object = override secret/TTL. Default ON dengan
   *  ARCLUX_AUTH_SECRET (fallback dev secret). */
  auth?: { secret?: string; ttlMs?: number } | false;
  /** Persistence E-3 (D-013): start() resume snapshot, stop() save,
   *  autosave tiap 100 tick. */
  persistence?: PersistenceStore;
  /** IP tambahan yang boleh POST /deliver — loopback selalu boleh. */
  deliverAllowlist?: string[];
  /** Re-derive stat vessel dari source repo (D-008 — server yang menentukan
   *  stat, bukan wire). Return null → deliver ditolak. Default tanpa hook =
   *  sanitizeVesselModel (clamp + agregat dihitung ulang dari systems). */
  rederiveVessel?: (model: VesselModel) => VesselModel | null | Promise<VesselModel | null>;
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

interface ParsedBody {
  /** Raw bytes sebagai string — basis HMAC /deliver (byte-identik). */
  raw: string;
  json: any;
}

/** Baca body POST: parse JSON + batas 1MB (lebih = 413, buffer dibuang). */
function readBody(req: IncomingMessage): Promise<ParsedBody> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let overflow = false;
    req.on("data", (c: Buffer) => {
      if (overflow) return;
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        overflow = true;
        chunks.length = 0;
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (overflow) {
        reject(Object.assign(new Error("payload too large"), { statusCode: 413 }));
        return;
      }
      try {
        const raw = chunks.length ? Buffer.concat(chunks).toString("utf8") : "";
        resolve({ raw, json: raw ? JSON.parse(raw) : {} });
      } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function clamp0100(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(100, Math.round(v * 10) / 10));
}

/** E-2 / D-008: server TIDAK mempercayai stat dari wire. Sistem di-clamp
 *  0..100, agregat (integrity/defense/weapons/engine) dihitung ULANG dari
 *  systems (bukan angka wire), jumlah component dibatasi. Re-derivation penuh
 *  dari source repo = opts.rederiveVessel (analyzeRepository di community). */
export function sanitizeVesselModel(model: VesselModel): VesselModel | null {
  if (!model || typeof model !== "object") return null;
  if (typeof model.id !== "string" || !model.id) return null;
  if (!Array.isArray(model.systems) || !Array.isArray(model.components)) return null;
  if (model.components.length > 64) return null;
  const systems = model.systems.map((s) => ({
    ...s,
    health: clamp0100(s.health),
    baseStat: clamp0100(s.baseStat),
  }));
  const byId = new Map(systems.map((s) => [s.id, s]));
  return {
    ...model,
    systems,
    integrity: byId.get("reactor")?.health ?? clamp0100(model.integrity),
    defense: byId.get("defense")?.health ?? clamp0100(model.defense),
    weapons: byId.get("weapons")?.health ?? clamp0100(model.weapons),
    engine: byId.get("engine")?.health ?? clamp0100(model.engine),
  };
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

  // Sprint 1 state (08 hardening): rate limit P0-4, idempotency E-4, auth P0-2.
  const rateLimiter = createRateLimiter();
  /** E-4: seq monotonik per (playerId, entityId) — replay/duplikat ditolak. */
  const lastSeqByEntity = new Map<string, number>();
  const authEnabled = opts.auth !== false;
  const authSecret = (typeof opts.auth === "object" && opts.auth.secret) || resolveAuthSecret();
  const authTtlMs = (typeof opts.auth === "object" && opts.auth.ttlMs) || LOGIN_TOKEN_TTL_MS;
  const handoffSecret = resolveHandoffSecret();

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
      if (req.method === "GET" && u.pathname === "/servers") {
        // P0-5: discovery shard via HTTP — filter status/visibility/federation,
        // status sudah lewat TTL check (listServersWithHealth).
        const status = u.searchParams.get("status") as ServerStatus | null;
        sendJson(res, 200, {
          ok: true,
          servers: listServersWithHealth({
            visibility: u.searchParams.get("visibility") ?? undefined,
            federation: u.searchParams.get("federation") ?? undefined,
            status: status ?? undefined,
          }),
        });
        return;
      }
      if (req.method === "POST" && u.pathname === "/login") {
        // P0-2: identity server — token signed (HMAC + exp). Production boleh
        // ganti dengan identity provider komunitas (lihat defaultAuthProvider).
        const { json } = await readBody(req);
        const playerId = json?.playerId;
        if (typeof playerId !== "string" || !playerId) {
          sendJson(res, 400, { ok: false, reason: "login requires playerId" });
          return;
        }
        const token = signLoginToken(playerId, authSecret, authTtlMs);
        sendJson(res, 200, { ok: true, token, playerId, expiresIn: authTtlMs });
        return;
      }
      if (req.method === "POST" && u.pathname === "/intent") {
        const { json: intent } = await readBody(req);
        if (!intent || typeof intent.type !== "string" || typeof intent.entityId !== "string" || typeof intent.playerId !== "string") {
          sendJson(res, 400, { ok: false, reason: "invalid intent" });
          return;
        }
        const ip = req.socket.remoteAddress ?? undefined;
        // P0-4: token bucket per playerId@ip — 429 + shadowban bila flood.
        if (!rateLimiter.allow(intent.playerId as string, ip)) {
          sendJson(res, 429, {
            ok: false,
            seq: intent.seq ?? 0,
            verdict: "rejected",
            reason: rateLimiter.isShadowbanned(intent.playerId as string) ? "shadowbanned" : "rate limited",
          });
          return;
        }
        // P0-2: wajib Bearer token — playerId self-declare dari wire TIDAK
        // dipercaya; sub token-lah yang jadi actor (ctx di validateIntent).
        let ctxPlayerId = intent.playerId as string;
        if (authEnabled) {
          const payload = verifyLoginToken(bearerFromHeader(req.headers.authorization), authSecret);
          if (!payload) {
            sendJson(res, 401, { ok: false, seq: intent.seq ?? 0, verdict: "rejected", reason: "missing or invalid token" });
            return;
          }
          ctxPlayerId = payload.sub;
        }
        // E-4: seq wajib monotonik per (playerId, entityId) — replay/duplikat
        // ditolak di edge (409), client dapat ack untuk reconciliasi.
        const seqKey = `${intent.playerId}:${intent.entityId}`;
        const lastSeq = lastSeqByEntity.get(seqKey);
        if (typeof intent.seq === "number" && lastSeq !== undefined && intent.seq <= lastSeq) {
          sendJson(res, 409, { ok: false, seq: intent.seq, verdict: "rejected", reason: "stale/duplicate seq" });
          return;
        }
        // Ack verdict awal — ctx memakai sub token, jadi playerId ≠ subject
        // jatuh di guard identitas validateIntent (validator.ts identity mismatch).
        const verdict = validateIntent(region, intent as PlayerIntent, { playerId: ctxPlayerId, auth: { actor: ctxPlayerId } });
        if (verdict.decision === "reject") {
          sendJson(res, 200, { ok: false, seq: intent.seq ?? 0, verdict: "rejected", reason: verdict.reason });
          return;
        }
        if (typeof intent.seq === "number") lastSeqByEntity.set(seqKey, intent.seq);
        engine.enqueue(intent as PlayerIntent);
        sendJson(res, 200, { ok: true, seq: intent.seq ?? 0, verdict: "accepted" });
        return;
      }
      if (req.method === "POST" && u.pathname === "/deliver") {
        const { raw, json: h } = await readBody(req);
        // E-2: hanya shard terpercaya — IP allowlist (loopback/self) + HMAC
        // signature atas RAW body (replay window 60s).
        if (!isDeliverAllowed(req.socket.remoteAddress, opts.deliverAllowlist)) {
          sendJson(res, 403, { ok: false, reason: "deliver: address not allow-listed" });
          return;
        }
        if (!verifyHandoff(raw, req.headers[HANDOFF_HEADER], handoffSecret)) {
          sendJson(res, 403, { ok: false, reason: "deliver: invalid handoff signature" });
          return;
        }
        if (!h || typeof h.vesselId !== "string" || !h.vesselId || !h.vessel) { sendJson(res, 400, { ok: false, reason: "invalid handoff payload" }); return; }
        // D-008: stat TIDAK dipercaya dari wire — sanitize (agregat dihitung
        // ulang) + opsional re-derivation penuh dari source repo.
        let model = sanitizeVesselModel(h.vessel as VesselModel);
        if (!model) { sendJson(res, 400, { ok: false, reason: "invalid vessel model" }); return; }
        if (opts.rederiveVessel) {
          const derived = await opts.rederiveVessel(model);
          if (!derived) { sendJson(res, 403, { ok: false, reason: "vessel re-derivation rejected" }); return; }
          model = derived;
        }
        if (region.has(h.vesselId)) { sendJson(res, 200, { ok: false, reason: `entity already exists: ${h.vesselId}` }); return; }
        // P0-4: entity cap — spawn ditolak saat penuh.
        if (region.snapshot().entities.length >= 5000) { sendJson(res, 200, { ok: false, reason: "entity_cap" }); return; }
        region.spawnVessel({ id: h.vesselId, owner: h.owner, vessel: model, position: h.position });
        sendJson(res, 200, { ok: true });
        return;
      }
      // Static client — GET selain route di atas → serve dari staticDir.
      if (req.method === "GET" && opts.staticDir) {
        await serveStaticFile(req, res, u.pathname, opts.staticDir);
        return;
      }
      sendJson(res, 404, { ok: false, reason: `unknown ${req.method} ${u.pathname}` });
    } catch (e) {
      const status = (e as { statusCode?: number })?.statusCode ?? 500;
      sendJson(res, status, { ok: false, reason: (e as Error).message });
    }
  });

  let scheduler: ReturnType<typeof createTickScheduler> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let running = false;
  const host = opts.host ?? "127.0.0.1";

  const beat = (): void => {
    heartbeat(regionId, { status: "ONLINE", population: region.snapshot().entities.length, regions: 1 });
  };

  const handle: GameServerHandle = {
    region,
    engine,
    port,
    url: `http://${host}:${port}`,
    start: async () => {
      // E-3 resume (D-013): restore world dari persistence SEBELUM tick jalan.
      if (opts.persistence) {
        try {
          const snap = await opts.persistence.loadRegion(regionId);
          if (snap && isValidResume(snap)) region.restore(snap);
        } catch (e) { console.error("[arclux:gameserver] resume failed", e); }
      }
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => resolve());
      });
      const addr = server.address() as AddressInfo | null;
      const actualPort = addr && typeof addr === "object" ? addr.port : port;
      handle.port = actualPort;
      handle.url = `http://${host}:${actualPort}`;
      scheduler = createTickScheduler({
        tickMs: dt * 1000,
        onTick: () => {
          const result = engine.step();
          opts.onTick?.(result.tick, result.snapshot);
          // E-3 autosave tiap 100 tick — kill -9 kehilangan ≤100 tick,
          // world tetap utuh & tidak corrupt (stability.shouldSnapshot).
          if (opts.persistence && shouldSnapshot(region.tick)) {
            void saveSnapshot(opts.persistence, region).catch((e) => console.error("[arclux:gameserver] autosave failed", e));
          }
        },
        onError: (e) => { console.error("[arclux:gameserver] tick error", e); },
      });
      scheduler.start();
      running = true;
      if (opts.register !== false) {
        registerServer({
          serverId: regionId,
          name: regionName,
          endpoint: `http://${host}:${actualPort}`,
          visibility: "public",
          version: "1.0.0",
          regions: 1,
          population: 0,
          federation: "PUBLIC",
        });
        // P0-5: heartbeat loop tiap 10s — heartbeat sekali-di-start membuat
        // directory menampilkan ONLINE selamanya meski server sudah mati
        // (registry TTL 30s yang menurunkan ke OFFLINE).
        beat();
        heartbeatTimer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
      }
      return { url: handle.url, port: actualPort };
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
      scheduler = null;
      if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
      // E-3 save-on-stop (D-013): restart ≠ world reset.
      if (opts.persistence) {
        try { await saveSnapshot(opts.persistence, region); } catch (e) { console.error("[arclux:gameserver] save-on-stop failed", e); }
      }
      if (opts.register !== false) unregisterServer(regionId);
      running = false;
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        // Keep-alive client (fetch) menahan socket — tutup paksa agar stop()
        // tidak hang.
        (server as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
      });
    },
  };
  return handle;
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
