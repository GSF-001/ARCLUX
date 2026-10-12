// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// loadtest.ts — load-test harness mass-testing ala EVE Singularity (08 §4 Sprint 6).
//
// Dua fase terpisah supaya angkanya jujur:
//   Fase A (engine-only): N entity + M intent/tick → step() duration.
//     Ini tick p99 MURNI (tanpa noise HTTP/scheduler).
//   Fase B (HTTP penuh): server nyata + N poller /snapshot + poster /intent
//     → latensi intent p99 (round-trip klien), latensi snapshot p99,
//     bandwidth per client (bytes/poll × poll rate).
//
// Default skala spec: 500 entity, 100 intent/tick, 100 client poll.
// Dipanggil dari tests/loadtest-harness.test.ts (skala kecil, CI) atau
// `npx tsx scripts/loadtest.ts` (skala penuh, manual).

import { performance } from "node:perf_hooks";
import { WorldRegion } from "./world";
import { SimulationEngine } from "./simulation";
import { createGameServer, type GameServerHandle } from "./server";
import { createSeedRng } from "./random";
import { worldHash } from "./stability";
import type { VesselModel } from "../universe/types";
import type { PlayerIntent } from "./types";

export interface LoadTestOptions {
  /** Jumlah entity/vessel (default 500 — spec §4). */
  entities?: number;
  /** Intent di-enqueue per tick (default 100 — spec §4). */
  intentsPerTick?: number;
  /** Jumlah client poll /snapshot (default 100 — spec §4). */
  pollers?: number;
  /** Tick fase A (default 200 = 20 detik @10tps). */
  engineTicks?: number;
  /** Durasi fase B ms (default 10_000). */
  httpDurationMs?: number;
  /** Intent per detik per poster fase B (default 5 — di bawah rate limit 20/s). */
  posterRatePerSec?: number;
  host?: string;
}

export interface LatencyStats {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
}

export interface LoadTestReport {
  config: Required<Pick<LoadTestOptions, "entities" | "intentsPerTick" | "pollers" | "engineTicks" | "httpDurationMs">>;
  engine: {
    ticks: number;
    accepted: number;
    rejected: number;
    tickMs: LatencyStats;
    ticksPerSec: number;
    finalWorldHash: string;
  };
  http: HttpLoadResult;
}

// ---- stats ----

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

export function latencyStats(samples: number[]): LatencyStats {
  if (samples.length === 0) return { count: 0, p50: 0, p95: 0, p99: 0, max: 0, mean: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    count: sorted.length,
    p50: round(percentile(sorted, 50)),
    p95: round(percentile(sorted, 95)),
    p99: round(percentile(sorted, 99)),
    max: round(sorted[sorted.length - 1]),
    mean: round(sum / sorted.length),
  };
}

const round = (x: number): number => Math.round(x * 100) / 100;

// ---- fixture ----

export function makeVesselModel(id: string): VesselModel {
  const subs = ["engine", "reactor", "navigation", "defense", "weapons", "ai"];
  return {
    id,
    name: `Loadtest ${id}`,
    source: { org: "loadtest", repo: "harness", defaultBranch: "main", analyzedAt: "2026-01-01T00:00:00Z" },
    license: "open",
    systems: subs.map((s) => ({ id: s, label: s, health: 70, baseStat: 70 })),
    components: [],
    integrity: 80,
    defense: 75,
    weapons: 65,
    engine: 70,
  } as unknown as VesselModel;
}

export function spawnFleet(region: WorldRegion, count: number): string[] {
  const ids: string[] = [];
  const rng = createSeedRng(42);
  // Spawn ±1 AU dari origin — bintang default server (server.ts bodies) ada di
  // (0,0,0) radius 6.95e8 m; spawn di dalam radius itu = kapal masuk bintang →
  // computeThermal overheat → −2 health/tick → adrift → semua intent move
  // ditolak "hull critical". Sebar 1e9 deterministik (interest/scan tidak
  // numpuk), masih jauh dari material limit 1200 K.
  const AU = 1.496e11;
  for (let i = 0; i < count; i++) {
    const id = `lt-${i}`;
    region.spawnVessel({
      id,
      owner: `p${i % Math.max(1, Math.floor(count / 2))}`,
      vessel: makeVesselModel(id),
      position: { x: AU + rng.next() * 1e9, y: 0, z: rng.next() * 1e9 },
    });
    ids.push(id);
  }
  return ids;
}

// ---- Fase A: engine-only ----

export interface EngineLoadResult {
  ticks: number;
  accepted: number;
  rejected: number;
  tickMs: LatencyStats;
  ticksPerSec: number;
  finalWorldHash: string;
}

export function runEngineLoadTest(opts: LoadTestOptions = {}): EngineLoadResult {
  const entities = opts.entities ?? 500;
  const intentsPerTick = opts.intentsPerTick ?? 100;
  const engineTicks = opts.engineTicks ?? 200;

  const region = new WorldRegion("loadtest", "Loadtest Region");
  const vesselIds = spawnFleet(region, entities);
  const authProvider = (playerId: string) => ({ playerId, auth: { actor: playerId } } as never);
  const engine = new SimulationEngine({ region, authProvider });

  const rng = createSeedRng(7);
  const durations: number[] = [];
  let accepted = 0;
  let rejected = 0;
  const wallStart = performance.now();

  for (let t = 0; t < engineTicks; t++) {
    for (let i = 0; i < intentsPerTick; i++) {
      // pemilik HARUS cocok dengan entity (validator: owner check) —
      // derive keduanya dari satu indeks supaya mayoritas accepted.
      const idx = Math.floor(rng.next() * vesselIds.length);
      const entityId = vesselIds[idx];
      const playerId = `p${idx % Math.max(1, Math.floor(entities / 2))}`;
      const ent = region.get(entityId);
      const base = ent?.kind === "vessel" ? ent.position : { x: 1.496e11, y: 0, z: 0 };
      const intent = {
        playerId,
        entityId,
        type: "move",
        payload: { x: base.x + (rng.next() - 0.5) * 200, y: 0, z: base.z + (rng.next() - 0.5) * 200 },
        seq: t * intentsPerTick + i,
      } as PlayerIntent;
      engine.enqueue(intent);
    }
    const t0 = performance.now();
    const result = engine.step();
    durations.push(performance.now() - t0);
    accepted += result.accepted.length;
    rejected += result.rejected.length;
  }
  const wallSec = (performance.now() - wallStart) / 1000;

  return {
    ticks: engineTicks,
    accepted,
    rejected,
    tickMs: latencyStats(durations),
    ticksPerSec: round(engineTicks / wallSec),
    finalWorldHash: worldHash(region),
  };
}

// ---- Fase B: HTTP penuh ----

export interface HttpLoadResult {
  intentMs: LatencyStats;
  snapshotMs: LatencyStats;
  snapshotBytes: LatencyStats;
  intentAccepted: number;
  intentRejected: number;
  /** Alasan penolakan (429 rate limit / verdict reject / http error). */
  rejectionsByReason: Record<string, number>;
  pollCount: number;
  bandwidthBytesPerSecPerClient: number;
  intentsPerSec: number;
  pollsPerSecPerClient: number;
}

export async function runHttpLoadTest(opts: LoadTestOptions = {}): Promise<HttpLoadResult> {
  const entities = opts.entities ?? 500;
  const pollers = opts.pollers ?? 100;
  const durationMs = opts.httpDurationMs ?? 10_000;
  const posterRate = opts.posterRatePerSec ?? 5;
  const host = opts.host ?? "127.0.0.1";

  const server: GameServerHandle = createGameServer({
    port: 0,
    host,
    register: false,
    ws: false,
    auth: false,
    eventStore: false,
    regionId: "loadtest-http",
    deliverAllowlist: ["127.0.0.1", "::1", "::ffff:127.0.0.1"],
  });
  spawnFleet(server.region, entities);

  const { url } = await server.start();
  try {
    const intentLat: number[] = [];
    const snapLat: number[] = [];
    const snapBytes: number[] = [];
    let intentAccepted = 0;
    let intentRejected = 0;
    let pollCount = 0;
    const rejectionsByReason: Record<string, number> = {};
    const noteRejection = (reason: string): void => {
      intentRejected++;
      rejectionsByReason[reason] = (rejectionsByReason[reason] ?? 0) + 1;
    };
    const half = Math.max(1, Math.floor(entities / 2));

    // poller: loop /snapshot selama durasi.
    const pollLoop = async (worker: number) => {
      const playerId = `p${worker % half}`;
      const entityId = `lt-${worker % entities}`;
      void playerId;
      const deadline = Date.now() + durationMs;
      while (Date.now() < deadline) {
        const t0 = performance.now();
        try {
          const res = await fetch(`${url}/snapshot`);
          const body = await res.text();
          if (res.status === 200) {
            snapLat.push(performance.now() - t0);
            snapBytes.push(Buffer.byteLength(body));
            pollCount++;
          }
        } catch { /* server berhenti di tengah — abaikan */ }
      }
      void entityId;
    };

    // poster: intent rate terkendali (di bawah rate limit 20/s per player).
    const postLoop = async (worker: number) => {
      const idx = worker % entities;
      const playerId = `p${idx % half}`;
      const entityId = `lt-${idx}`;
      const gapMs = 1000 / posterRate;
      const deadline = Date.now() + durationMs;
      let seq = 0;
      while (Date.now() < deadline) {
        // Target RELATIF ke posisi kapal (±100 m) — absolute 0..1000 jatuh di
        // dalam bintang default (0,0,0) → overheat → adrift → intent ditolak.
        const ent = server.region.get(entityId);
        const base = ent?.kind === "vessel" ? ent.position : { x: 1.496e11, y: 0, z: 0 };
        const intent = {
          playerId, entityId, type: "move",
          payload: { x: base.x + (Math.random() - 0.5) * 200, y: 0, z: base.z + (Math.random() - 0.5) * 200 },
          seq: seq++,
        };
        const t0 = performance.now();
        try {
          const res = await fetch(`${url}/intent`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(intent),
          });
          const body = (await res.json()) as { verdict?: string; reason?: string };
          if (res.status === 200 && body.verdict === "accepted") intentAccepted++;
          else noteRejection(res.status === 429 ? "http_429_rate_limit" : (body.reason ?? `http_${res.status}`));
          intentLat.push(performance.now() - t0);
        } catch {
          noteRejection("network_error");
        }
        await new Promise((r) => setTimeout(r, gapMs));
      }
    };

    const workers: Promise<void>[] = [];
    // 20% worker = poster, sisanya poller (spec: 100 client poll).
    const posters = Math.max(1, Math.floor(pollers * 0.2));
    for (let i = 0; i < posters; i++) workers.push(postLoop(i));
    for (let i = 0; i < pollers; i++) workers.push(pollLoop(i));
    await Promise.all(workers);

    const durSec = durationMs / 1000;
    const bytesStats = latencyStats(snapBytes);
    return {
      intentMs: latencyStats(intentLat),
      snapshotMs: latencyStats(snapLat),
      snapshotBytes: bytesStats,
      intentAccepted,
      intentRejected,
      rejectionsByReason,
      pollCount,
      bandwidthBytesPerSecPerClient: round((bytesStats.mean * (pollCount / pollers)) / durSec),
      intentsPerSec: round((intentAccepted + intentRejected) / durSec),
      pollsPerSecPerClient: round(pollCount / pollers / durSec),
    };
  } finally {
    await server.stop().catch(() => {});
  }
}

// ---- kedua fase ----

export async function runLoadTest(opts: LoadTestOptions = {}): Promise<LoadTestReport> {
  const engine = runEngineLoadTest(opts);
  const http = await runHttpLoadTest(opts);
  return {
    config: {
      entities: opts.entities ?? 500,
      intentsPerTick: opts.intentsPerTick ?? 100,
      pollers: opts.pollers ?? 100,
      engineTicks: opts.engineTicks ?? 200,
      httpDurationMs: opts.httpDurationMs ?? 10_000,
    },
    engine,
    http,
  };
}

export function formatLoadTestReport(r: LoadTestReport): string {
  const s = r.engine.tickMs;
  const i = r.http.intentMs;
  const n = r.http.snapshotMs;
  return [
    `=== ARCLUX loadtest (${r.config.entities} entity, ${r.config.intentsPerTick} intent/tick, ${r.config.pollers} poller) ===`,
    `engine: ${r.engine.ticks} tick · ${r.engine.accepted} accepted / ${r.engine.rejected} rejected · ${r.engine.ticksPerSec} tick/s`,
    `tick ms: p50=${s.p50} p95=${s.p95} p99=${s.p99} max=${s.max}`,
    `intent http ms: p50=${i.p50} p95=${i.p95} p99=${i.p99} (${r.http.intentsPerSec}/s, ${r.http.intentAccepted} ok / ${r.http.intentRejected} no ${JSON.stringify(r.http.rejectionsByReason)})`,
    `snapshot http ms: p50=${n.p50} p95=${n.p95} p99=${n.p99} · bytes p50=${r.http.snapshotBytes.p50} p99=${r.http.snapshotBytes.p99}`,
    `bandwidth/client: ${r.http.bandwidthBytesPerSecPerClient} B/s · poll/client: ${r.http.pollsPerSecPerClient}/s`,
    `worldHash final: ${r.engine.finalWorldHash}`,
  ].join("\n");
}
