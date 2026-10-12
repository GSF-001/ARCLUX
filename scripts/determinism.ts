#!/usr/bin/env -S npx tsx
// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// scripts/determinism.ts — sertifikat determinisme (08 §4 Sprint 6).
//   npx tsx scripts/determinism.ts
//
// 1. Bangun workload seeded (snapshot awal + event log + hash ekspektasi).
// 2. Replay di 2 PROSES child terpisah (scripts/determinism-worker.ts).
// 3. Semua hash identik = SERTIFIKAT LULUS (exit 0); beda = LOLONGAN
//    nondeterminisme (exit 1) — sebutkan proses mana yang menyimpang.

import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildBundle,
  writeBundle,
  runWorkers,
  certify,
  defaultBundlePath,
} from "../mmo/packages/gameserver/determinism";

async function main(): Promise<void> {
  const bundlePath = defaultBundlePath();
  console.log("[determinism] build bundle (seeded)…");
  const bundle = buildBundle();
  console.log(`[determinism] expected=${bundle.expectedHash} untilTick=${bundle.untilTick} events=${bundle.events.length}`);
  writeBundle(bundlePath, bundle);

  try {
    const workerScript = join(dirname(fileURLToPath(import.meta.url)), "determinism-worker.ts");
    console.log("[determinism] replay di 2 proses terpisah…");
    const hashes = await runWorkers(workerScript, bundlePath, 2);
    const cert = certify(hashes, bundle.expectedHash);
    console.log(JSON.stringify(cert, null, 2));
    if (cert.ok) {
      console.log(`[determinism] SERTIFIKAT LULUS — ${cert.workers} proses, hash identik ${cert.expectedHash}`);
    } else {
      console.error("[determinism] GAGAL — hash berbeda antar proses (nondeterminisme!)");
      process.exitCode = 1;
    }
  } finally {
    rmSync(bundlePath, { force: true });
  }
}

main().catch((e) => {
  console.error("[determinism] failed:", e);
  process.exit(1);
});
