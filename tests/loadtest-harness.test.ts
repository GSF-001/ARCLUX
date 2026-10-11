// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// loadtest-harness.test.ts — Sprint 6 (08 §4): harness load-test ala EVE
// Singularity. Skala CI kecil (asertisi invariant); skala penuh
// 500 entity / 100 intent/tick / 100 poller = `npx tsx scripts/loadtest.ts`.

import { describe, it, expect } from "vitest";
import {
  runEngineLoadTest,
  runHttpLoadTest,
  latencyStats,
  percentile,
} from "../mmo/packages/gameserver/loadtest";

describe("Sprint 6 load-test harness", () => {
  it("percentile + latencyStats benar", () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5], 100)).toBe(5);
    const s = latencyStats([10, 20, 30]);
    expect(s.count).toBe(3);
    expect(s.p50).toBe(20);
    expect(s.max).toBe(30);
    expect(latencyStats([]).p99).toBe(0);
  });

  it("fase A: engine menelan 40 entity × 10 intent/tick tanpa error", () => {
    const r = runEngineLoadTest({
      entities: 40,
      intentsPerTick: 10,
      engineTicks: 30,
    });
    expect(r.ticks).toBe(30);
    // intent move pemilik sendiri harus mayoritas diterima (validasi lolos).
    expect(r.accepted).toBeGreaterThan(0);
    expect(r.tickMs.count).toBe(30);
    expect(r.tickMs.p99).toBeGreaterThanOrEqual(r.tickMs.p50);
    expect(r.ticksPerSec).toBeGreaterThan(0);
    expect(r.finalWorldHash.length).toBeGreaterThan(0);
  }, 15_000);

  it("fase A deterministik: run sama → worldHash sama (dasar sertifikat §4)", () => {
    const opts = { entities: 20, intentsPerTick: 5, engineTicks: 20 };
    const a = runEngineLoadTest(opts);
    const b = runEngineLoadTest(opts);
    expect(b.finalWorldHash).toBe(a.finalWorldHash);
    expect(b.accepted).toBe(a.accepted);
  }, 15_000);

  it("fase B: server HTTP melayani poller + poster, latensi terukur", async () => {
    const r = await runHttpLoadTest({
      entities: 30,
      pollers: 8,
      httpDurationMs: 1500,
      posterRatePerSec: 4,
    });
    // snapshot dilayani ke poller
    expect(r.pollCount).toBeGreaterThan(0);
    expect(r.snapshotBytes.count).toBeGreaterThan(0);
    expect(r.snapshotBytes.mean).toBeGreaterThan(100); // JSON ada isinya
    // intent: mayoritas diterima (rate poster di bawah limit 20/s)
    expect(r.intentAccepted).toBeGreaterThan(0);
    expect(r.intentMs.count).toBeGreaterThan(0);
    expect(r.intentMs.p99).toBeGreaterThanOrEqual(r.intentMs.p50);
    // bandwidth/client terhitung nyata
    expect(r.bandwidthBytesPerSecPerClient).toBeGreaterThan(0);
    expect(r.pollsPerSecPerClient).toBeGreaterThan(0);
  }, 30_000);
});
