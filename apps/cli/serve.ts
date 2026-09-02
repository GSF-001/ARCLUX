#!/usr/bin/env node
// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Entry point for "arclux serve": host satu region ARCLUX sebagai proses
// foreground (D-009 self-host, D-006 region). Komunitas tinggal:
//   arclux serve                          # region-1 @ :24001, client di /
//   arclux serve --region my-community --port 27000 --client ./apps/game/dist/renderer
// lalu pemain buka http://<host>:<port>/ langsung main.
//
// World boot: star + planets, vessel default (kalau --vessel-model diberikan),
// tick 10/s, HTTP /snapshot /intent /deliver + static client. Terdaftar di
// packages/directory → discoverable via listServers (DIRECTORY ≠ AUTHORITY).

import type { Command } from "commander";
import * as p from "@clack/prompts";
import { createGameServer } from "../../packages/gameserver/server";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function registerServeCommand(program: Command): void {
  program
    .command("serve")
    .description("Host an ARCLUX MMO region: world sim + HTTP API + game client (self-host, D-009)")
    .option("--region <id>", "region identifier (unique per shard)", "region-1")
    .option("--name <name>", "human-readable region name (defaults to region id)")
    .option("--port <port>", "listen port", (v) => Number(v), 0)
    .option("--client <dir>", "static dir of the bundled game client (served at /)")
    .option("--no-register", "do NOT register this server in the public directory")
    .action(async (options: { region: string; name?: string; port: number; client?: string; register: boolean }) => {
      const clientDir = options.client ? resolve(options.client) : null;
      if (options.client && !existsSync(clientDir)) {
        p.log.error(`--client dir not found: ${clientDir}`);
        return;
      }

      const gs = createGameServer({
        regionId: options.region,
        regionName: options.name ?? options.region,
        port: options.port || undefined,
        register: options.register,
        staticDir: clientDir ?? undefined,
      });

      const { url, port } = await gs.start();
      p.log.success(`🌌 Region "${options.region}" live at ${url}`);
      p.log.info(`   API  : ${url}/snapshot · /health · /intent · /deliver`);
      p.log.info(`   Port : ${port}`);
      if (clientDir) p.log.info(`   Game : ${url}/ (static client from ${clientDir})`);
      else p.log.info(`   Game : no --client supplied — serve the bundled client with --client dist/renderer`);
      p.log.info(`   Ctrl+C to stop`);

      const shutdown = async () => {
        p.log.info("Stopping region...");
        await gs.stop();
        process.exit(0);
      };
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    });
}