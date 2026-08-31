// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// `packages/gameserver` — authoritative ARCLUX MMO server core.
//
// Barrel: everything a shard host needs to run an authoritative region server
// (sim loop, world registry, validator, combat). Clients only render what this
// validates/simulates. Reuses packages/universe for vessel model + licensing.

export * from "./types";
export * from "./world";
export * from "./validator";
export * from "./simulation";
export * from "./combat";
export * from "./netcode";
export * from "./transport";
export * from "./gate";
export * from "./persistence";
export * from "./bridge";
export * from "./environs";
export * from "./collision";
export * from "./thermics";
export * from "./capability";
export * from "./governance";
export * from "./cosmicEvent";
export * from "./cockpit";
export * from "./intel";
export * from "./teleport";
export * from "./baseline";
export * from "./physics";
export * from "./regionState";
export * from "./component";
export * from "./lineage";
export * from "./tickScheduler";
export * from "./rateLimiter";
export * from "./stability";
