// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// determinism.ts — sertifikat determinisme (08 §4 Sprint 6): replay event log
// → worldHash identik di 2 PROSES terpisah.
//
// Kenapa 2 proses (bukan 2 engine di 1 proses — Sprint 3)? Bug determinisme
// sering datang dari state proses yang nge-bleed (Math.random global, Date.now,
// urutan Module init). Dua proses beda = bukti kuat: dunia adalah fungsi murni
// (snapshot_awal, log_intent).

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { GameEvent, PlayerIntent, RegionSnapshot } from "./types";
import { WorldRegion } from "./world";
import { SimulationEngine } from "./simulation";
import { createSeedRng } from "./random";
import { resimulate } from "./replay";
import { spawnFleet } from "./loadtest";

export interface DeterminismBundle {
  initial: RegionSnapshot;
  events: GameEvent[];
  untilTick: number;
  /** Hash yang diharapkan (dihitung pembangun bundle, replay in-process). */
  expectedHash: string;
}

export interface BuildBundleOptions {
  entities?: number;
  ticks?: number;
  intentsPerTick?: number;
}

/**
 * Bangun workload deterministik (seeded): snapshot AWAL + event log + hash
 * ekspektasi. Snapshot di-clone SEBELUM step pertama (replay.ts catatan:
 * clone dari snapshot termutasi = state awal salah).
 */
export function buildBundle(opts: BuildBundleOptions = {}): DeterminismBundle {
  // Default aman: event ≈ 20*100 (state_hash) + 100*4*2 (intent) = 2800 < 10000.
  const entities = opts.entities ?? 20;
  const ticks = opts.ticks ?? 100;
  const intentsPerTick = opts.intentsPerTick ?? 4;

  const region = new WorldRegion("determinism", "Determinism Region");
  const vesselIds = spawnFleet(region, entities);
  const authProvider = (playerId: string) => ({ playerId, auth: { actor: playerId } } as never);
  const engine = new SimulationEngine({ region, authProvider });

  const initial: RegionSnapshot = structuredClone(region.snapshot());
  const rng = createSeedRng(1234);
  const half = Math.max(1, Math.floor(entities / 2));

  for (let t = 0; t < ticks; t++) {
    for (let i = 0; i < intentsPerTick; i++) {
      const idx = Math.floor(rng.next() * vesselIds.length);
      const ent = region.get(vesselIds[idx]);
      const base = ent?.kind === "vessel" ? ent.position : { x: 1.496e11, y: 0, z: 0 };
      const intent = {
        playerId: `p${idx % half}`,
        entityId: vesselIds[idx],
        type: "move",
        payload: { x: base.x + (rng.next() - 0.5) * 200, y: 0, z: base.z + (rng.next() - 0.5) * 200 },
        seq: t * intentsPerTick + i,
      } as PlayerIntent;
      engine.enqueue(intent);
    }
    engine.step();
  }

  const events = engine.replayLog();
  const expectedHash = resimulate(initial, events, { authProvider, untilTick: region.tick });
  return { initial, events, untilTick: region.tick, expectedHash };
}

export interface DeterminismCertificate {
  ok: boolean;
  /** Hash per worker proses (harus identik semua). */
  workerHashes: string[];
  expectedHash: string;
  workers: number;
}

/** Tulis bundle ke path (parent dir dibuat). */
export function writeBundle(path: string, bundle: DeterminismBundle): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(bundle), "utf8");
}

/** Baca bundle (validasi minimal — file rusak = gagal cepat). */
export function readBundle(path: string): DeterminismBundle {
  const raw = JSON.parse(readFileSync(path, "utf8")) as DeterminismBundle;
  if (!raw?.initial || !Array.isArray(raw.events) || typeof raw.expectedHash !== "string") {
    throw new Error(`invalid determinism bundle: ${path}`);
  }
  return raw;
}

/** Gabungkan hasil worker → sertifikat. */
export function certify(workerHashes: string[], expectedHash: string): DeterminismCertificate {
  const ok = workerHashes.length > 0
    && workerHashes.every((h) => h === expectedHash)
    && new Set(workerHashes).size === 1;
  return { ok, workerHashes, expectedHash, workers: workerHashes.length };
}

/**
 * Jalankan N worker terpisah (proses child) yang masing-masing me-replay
 * bundle → kembalikan hash. `workerScript` = path tsx worker
 * (scripts/determinism-worker.ts).
 */
export async function runWorkers(workerScript: string, bundlePath: string, workers = 2): Promise<string[]> {
  // worker = TS — jalankan lewat binary tsx lokal (repo devDependency).
  const tsxBin = join(process.cwd(), "node_modules", ".bin", "tsx");
  const run = (): Promise<string> =>
    new Promise((resolve, reject) => {
      const child = spawn(tsxBin, [workerScript, bundlePath], {
        cwd: process.cwd(),
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      let err = "";
      child.stdout.on("data", (d) => { out += String(d); });
      child.stderr.on("data", (d) => { err += String(d); });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code !== 0) return reject(new Error(`worker exit ${code}: ${err.slice(0, 500)}`));
        // baris terakhir = JSON { hash }.
        const lines = out.trim().split("\n");
        try {
          const parsed = JSON.parse(lines[lines.length - 1]) as { hash?: string };
          if (!parsed.hash) throw new Error("no hash in worker output");
          resolve(parsed.hash);
        } catch (e) {
          reject(new Error(`worker output rusak: ${out.slice(0, 500)} (${String(e)})`));
        }
      });
    });
  const results = await Promise.all(Array.from({ length: workers }, run));
  return results;
}

/** Path bundle default (dibersihkan caller). */
export function defaultBundlePath(): string {
  return join(process.cwd(), ".arclux", "determinism", `bundle-${process.pid}.json`);
}
