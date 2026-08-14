// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// `arclux language <file>` — drives packages/language/ (issue #348):
// parses a single file through the shared parser registry and prints the
// symbol surface (exports/imports/calls/warnings). Follows the ps.ts
// pattern of reading through a snapshot-like result.

import type { Command } from "commander";
import * as p from "@clack/prompts";
import { readFileSync } from "node:fs";
import { resolve, extname, relative, basename } from "node:path";
import { LanguageService } from "../../packages/language/LanguageService";
import type { FileInfo } from "../../packages/shared/types";

export function registerLanguageCommand(program: Command): void {
  program
    .command("language")
    .description("Parse a single file and print its exports/imports/calls (via packages/language)")
    .argument("<file>", "path to the source file")
    .option("--json", "output raw JSON instead of the formatted summary")
    .action(async (fileArg: string, options: { json?: boolean }) => {
      const filePath = resolve(fileArg);
      try {
        const content = readFileSync(filePath, "utf-8");
        const fileInfo: FileInfo = {
          absolutePath: filePath,
          relativePath: relative(process.cwd(), filePath).replace(/\\/g, "/"),
          language: "unknown",
          extension: extname(filePath),
          sizeBytes: Buffer.byteLength(content),
          hash: "",
        };
        fileInfo.language = new LanguageService().language(fileInfo.extension);

        const parsed = await new LanguageService().parseFile(fileInfo, content);

        if (options.json) {
          console.log(JSON.stringify(parsed, null, 2));
          return;
        }

        p.log.success(`${basename(filePath)} (${fileInfo.language})`);
        p.log.message(`Exports (${parsed.exports.length}): ${parsed.exports.map((e) => e.name).join(", ") || "—"}`);
        p.log.message(`Imports (${parsed.imports.length}): ${parsed.imports.map((i) => i.source).join(", ") || "—"}`);
        p.log.message(`Calls (${(parsed.calls ?? []).length}): ${(parsed.calls ?? []).map((c) => c.calleeName).join(", ") || "—"}`);
        if (parsed.warnings.length > 0) {
          p.log.warn(`Warnings (${parsed.warnings.length}):`);
          for (const warning of parsed.warnings) p.log.message(`  ${warning}`);
        }
      } catch (err) {
        p.log.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });
}
