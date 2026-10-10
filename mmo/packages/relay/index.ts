// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// packages/relay — SHARD REGISTRY + BRIDGE (D-005 multi-shard, D-009 self-host).
//
// Relay pusat (registry + gate config + identity lintas shard) — BUKAN game
// server. Scan MMO-IMPLEMENTATION.md §2.3 sebelum implementasi.
//
// Barrel: expose semua API relay.

export * from "./types";
export * from "./registry";
export * from "./gate";
export * from "./identity";
