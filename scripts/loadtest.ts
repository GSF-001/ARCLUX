#!/usr/bin/env -S npx tsx
// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// scripts/loadtest.ts — jalankan load-test SKALA PENUH (08 §4 Sprint 6):
//   npx tsx scripts/loadtest.ts            # default: 500 entity / 100 intent/tick / 100 poller
//   npx tsx scripts/loadtest.ts 200 50 50 10000   # entities intentsPerTick pollers httpDurationMs
//
// Output: laporan teks + JSON (biar bisa ditaruh di issue/dokumen).

import { runLoadTest, formatLoadTestReport, type LoadTestOptions } from "../mmo/packages/gameserver/loadtest";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const opts: LoadTestOptions = {};
  if (args[0]) opts.entities = Number(args[0]);
  if (args[1]) opts.intentsPerTick = Number(args[1]);
  if (args[2]) opts.pollers = Number(args[2]);
  if (args[3]) opts.httpDurationMs = Number(args[3]);

  console.log("[loadtest] start…");
  const report = await runLoadTest(opts);
  console.log(formatLoadTestReport(report));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error("[loadtest] failed:", e);
  process.exit(1);
});
