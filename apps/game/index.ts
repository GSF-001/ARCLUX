// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// apps/game — ARCLUX MMO client (Electron). Entry: bootstrap Electron main.
//
// 🚧 SCAFFOLD — lihat README.md + docs/blueprint/progres/MMO-IMPLEMENTATION.md.

import { startMain } from "./src/main/main";

// IMPL: panggil startMain() setelah Electron devDependencies terpasang.
// Jalankan: cd apps/game && npx electron .
console.log("arclux-game: scaffold — bootstrap Electron main di src/main/main.ts");
void startMain;
