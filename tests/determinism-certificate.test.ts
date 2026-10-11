// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// determinism-certificate.test.ts — Sprint 6 (08 §4): sertifikat determinisme
// CI. Bundle seeded → replay di 2 PROSES child terpisah → hash identik.
// CLI manual (skala sama): `npx tsx scripts/determinism.ts`.

import { describe, it, expect } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rmSync } from "node:fs";
import {
  buildBundle,
  writeBundle,
  readBundle,
  runWorkers,
  certify,
} from "../mmo/packages/gameserver/determinism";

const workerScript = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "determinism-worker.ts");

describe("Sprint 6 determinism certificate", () => {
  it("bundle build deterministik: 2x build → expectedHash sama", () => {
    const a = buildBundle({ entities: 10, ticks: 30, intentsPerTick: 3 });
    const b = buildBundle({ entities: 10, ticks: 30, intentsPerTick: 3 });
    expect(b.expectedHash).toBe(a.expectedHash);
    expect(a.events.length).toBeGreaterThan(0);
    expect(a.untilTick).toBeGreaterThanOrEqual(30);
  });

  it("write/read bundle round-trip", () => {
    const path = join(process.cwd(), ".arclux", "determinism", `test-${process.pid}.json`);
    try {
      const bundle = buildBundle({ entities: 5, ticks: 10, intentsPerTick: 2 });
      writeBundle(path, bundle);
      const back = readBundle(path);
      expect(back.expectedHash).toBe(bundle.expectedHash);
      expect(back.events.length).toBe(bundle.events.length);
    } finally {
      rmSync(path, { force: true });
    }
  });

  it("2 PROSES child replay → hash identik dengan ekspektasi (sertifikat)", async () => {
    const path = join(process.cwd(), ".arclux", "determinism", `cert-${process.pid}.json`);
    try {
      const bundle = buildBundle();
      writeBundle(path, bundle);
      const hashes = await runWorkers(workerScript, path, 2);
      expect(hashes).toHaveLength(2);
      const cert = certify(hashes, bundle.expectedHash);
      expect(cert.ok).toBe(true);
      expect(cert.workerHashes[0]).toBe(cert.workerHashes[1]);
      expect(cert.expectedHash).toBe(bundle.expectedHash);
    } finally {
      rmSync(path, { force: true });
    }
  }, 60_000);

  it("certify menolak hash yang menyimpang", () => {
    expect(certify(["aaa", "aaa"], "aaa").ok).toBe(true);
    expect(certify(["aaa", "bbb"], "aaa").ok).toBe(false);
    expect(certify([], "aaa").ok).toBe(false);
    expect(certify(["bbb", "ccc"], "aaa").ok).toBe(false);
  });
});
