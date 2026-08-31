// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// netcode.ts — backward-compat re-export (transport logic now in transport/*).
// Prefer: import { createHttpClientTransport } from "./transport/HttpTransport"

export * from "./transport/Transport";
export * from "./transport/InProcessTransport";
export * from "./transport/HttpTransport";
