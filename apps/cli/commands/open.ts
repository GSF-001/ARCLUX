/**
 * Copyright 2026 Mikatoshi
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import type { Command } from "commander";
import * as path from "node:path";
import { analyzeRepository } from "../../../packages/engine/pipeline";
import { openFile } from "../../../packages/editor/CodeNavigator";

export function registerOpenCommand(program: Command): void {
  program
    .command("open")
    .description("Resolve a file to its module in the ARCLUX repository model")
    .argument("<file>", "path to the file, relative to cwd or absolute")
    .option("--json", "output raw module JSON instead of formatted summary")
    .action(async (file: string, options: { json?: boolean }) => {
      const { repository } = await analyzeRepository({ localPath: "." });
      const absolutePath = path.resolve(process.cwd(), file);
      const module = openFile(repository, absolutePath);

      if (!module) {
        console.error(`"${file}" is not tracked in this repository's module graph.`);
        process.exitCode = 1;
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(module, null, 2));
        return;
      }

      console.log(`moduleId      ${module.id}`);
      console.log(`file          ${module.file.relativePath}`);
      console.log(`imports       ${module.resolvedImports.length}`);
      console.log(`imported by   ${module.importedBy.length}`);
    });
}
