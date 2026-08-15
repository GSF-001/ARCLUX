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
import {
  openFile,
  listDependencyTargets,
  listDirectConsumerTargets,
} from "../../../packages/editor/CodeNavigator";

export function registerEditCommand(program: Command): void {
  program
    .command("edit")
    .description("Show a file's dependencies and consumers before you edit it")
    .argument("<file>", "path to the file, relative to cwd or absolute")
    .action(async (file: string) => {
      const { repository } = await analyzeRepository({ localPath: "." });
      const absolutePath = path.resolve(process.cwd(), file);
      const module = openFile(repository, absolutePath);

      if (!module) {
        console.error(`"${file}" is not tracked in this repository's module graph.`);
        process.exitCode = 1;
        return;
      }

      const deps = listDependencyTargets(repository, module.id);
      const consumers = listDirectConsumerTargets(repository, module.id);

      console.log(`Editing: ${module.file.relativePath}\n`);
      console.log(`Depends on (${deps.length}):`);
      for (const d of deps) console.log(`  ${d.filePath}${d.line ? `:${d.line}` : ""}`);
      console.log(`\nDirect consumers (${consumers.length}) -- these break first if you change this file:`);
      for (const c of consumers) console.log(`  ${c.filePath}`);
    });
}
