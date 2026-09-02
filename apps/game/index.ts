// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// apps/game — ARCLUX MMO client (Electron) + self-host server mode.
//
//   serve (default, tanpa argumen):
//     host region lokal (engine + HTTP + client bundle) → buka http://127.0.0.1:24001/
//
//   --electron:
//     jalankan Electron main (jendela game; butuh electron devDependency).
//
// Ini BUKAN scaffold lagi — dua mode nyata: server self-host & client Electron.

import { createGameServer } from "../../packages/gameserver/server";
import { startMain } from "./src/main/main";

async function main(): Promise<void> {
  if (process.argv.includes("--electron")) {
    startMain();
    return;
  }

  const port = process.env.ARCLUX_GAME_PORT ? Number(process.env.ARCLUX_GAME_PORT) : 24001;
  const gs = createGameServer({
    regionId: process.env.ARCLUX_GAME_REGION ?? "region-1",
    regionName: process.env.ARCLUX_GAME_REGION ?? "region-1",
    port,
    register: process.env.ARCLUX_GAME_REGISTER !== "0",
    staticDir: "./dist/renderer",
  });
  const { url } = await gs.start();
  console.log(`[arclux:game] region live at ${url}`);
  console.log(`[arclux:game] play: open ${url}/   ·   API /snapshot /intent /deliver   ·   Ctrl+C to stop`);

  const shutdown = async () => {
    await gs.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void main();