// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// `arclux connect` — generate `.arclux/` boilerplate in a repo (Layer A/D),
// then run a quick analysis to derive the initial VesselModel.

import type { Command } from "commander";
import * as p from "@clack/prompts";
import { analyzeRepository } from "../../packages/engine/pipeline";
import { connectRepository, buildVesselModel } from "../../packages/universe";

export function registerConnectCommand(program: Command): void {
  program
    .command("connect")
    .description("Initialize a repository as an ARCLUX vessel (write .arclux/)")
    .argument("[path]", "path to the repository root", ".")
    .option("--name <name>", "vessel name (default: derived from dir name)")
    .option("--license <tier>", "license tier: open|shared|private", "open")
    .option("--owner <owner>", "owner identity/handle")
    .option("-f, --force", "overwrite an existing .arclux manifest")
    .action(async (targetPath: string, opts: { name?: string; license?: string; owner?: string; force?: boolean }) => {
      try {
        const tier = opts.license as "open" | "shared" | "private";
        const license = ["open", "shared", "private"].includes(tier) ? tier : "open";

        const result = connectRepository({
          rootPath: targetPath,
          vesselName: opts.name,
          license,
          owner: opts.owner,
          force: opts.force,
        });

        if (result.skipped) {
          p.log.warn(`Already connected — manifest exists (use --force to overwrite):\n  ${result.manifestPath}`);
          return;
        }

        p.log.success(`Created .arclux vessel manifest at: ${result.arcluxDir}`);
        for (const f of result.created) {
          p.log.info(`  + ${f}`);
        }

        // Derive the live VesselModel from a real analysis.
        const analysis = await analyzeRepository({ localPath: targetPath });
        const vessel = buildVesselModel(analysis);
        p.log.info("");
        p.log.info(`Vessel: ${vessel.name}  (${vessel.source.repo}@${vessel.source.defaultBranch})`);
        p.log.info(`License: ${vessel.license}`);
        p.log.info(`Integrity ${vessel.integrity}% | Defense ${vessel.defense}% | Weapons ${vessel.weapons}% | Engine ${vessel.engine}%`);
        p.log.info(`Subsystems: ${vessel.systems.map((s) => `${s.id}=${s.health}%`).join(", ")}`);
      } catch (err) {
        p.log.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });
}
