// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// root.ts — satu sumber lokasi data ARCLUX (mirror packages/db/client).
// Dipakai admin-audit + backup rotation agar semua artefak server game
// berada di root yang sama (ARCLUX_ROOT env, default ~/.arclux).

import { homedir } from "node:os";
import { join } from "node:path";

export function getRoot(): string {
  return process.env.ARCLUX_ROOT || join(homedir(), ".arclux");
}
