// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// determinism-worker.ts — anak proses sertifikat determinisme (Sprint 6).
// Baca bundle → resimulate (replay.ts) → cetak JSON { hash } di stdout.
// Dijalankan PROSES TERPISAH oleh sertifikat — inilah buktinya: dunia =
// fungsional murni (snapshot_awal, log_intent), bukan keadaan proses.

import { readBundle } from "../mmo/packages/gameserver/determinism";
import { resimulate } from "../mmo/packages/gameserver/replay";

const bundlePath = process.argv[2];
if (!bundlePath) {
  console.error("usage: determinism-worker.ts <bundle.json>");
  process.exit(2);
}

const bundle = readBundle(bundlePath);
const authProvider = (playerId: string) => ({ playerId, auth: { actor: playerId } } as never);
const hash = resimulate(bundle.initial, bundle.events, {
  authProvider,
  untilTick: bundle.untilTick,
});
console.log(JSON.stringify({ hash, expectedHash: bundle.expectedHash, pid: process.pid }));
