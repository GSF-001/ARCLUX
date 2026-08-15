// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Wraps packages/diagnostics/* -- runs the 3 wired detector adapters
// (circularDependency, deadCode, ambiguousSymbolResolution), attaches
// impact context, and prints fix suggestions. Mirrors doctor.ts's
// analyzeRepository + @clack/prompts pattern for consistency.

import type { Command } from "commander";
import * as p from "@clack/prompts";
import { analyzeRepository } from "../../packages/engine/pipeline";
import { runDiagnostics } from "../../packages/diagnostics/DiagnosticEngine";
import { attachImpactContextToAll } from "../../packages/diagnostics/ErrorContext";
import { toDiagnosticEventsForAll } from "../../packages/diagnostics/DiagnosticEvent";
import { getFixSuggestion } from "../../packages/diagnostics/FixSuggestion";
import path from "node:path";

export function registerDiagnoseCommand(program: Command): void {
  program
    .command("diagnose")
    .description("Run wired diagnostics (circularDependency, deadCode, ambiguousSymbolResolution) with impact context and fix suggestions")
    .argument("[path]", "path to the repository root", ".")
    .action(async (targetPath: string) => {
      const spinner = p.spinner();
      spinner.start(`Running diagnostics on ${targetPath}`);

      try {
        const { repository } = await analyzeRepository({ localPath: targetPath });
        const findings = runDiagnostics(repository);
        spinner.stop("Diagnostics finished");

        if (findings.length === 0) {
          p.log.success("No issues found.");
          return;
        }

        const withContext = attachImpactContextToAll(repository, findings);
        const events = toDiagnosticEventsForAll(withContext);

        p.log.warn(`${events.length} diagnostic event(s) found:`);
        for (const e of events) {
          const marker = e.locationPrecision === "line" ? `:${e.line}` : "";
          const label = `${e.filePath}${marker}`;
          // OSC 8 hyperlink escape sequence -- supported by most modern
          // terminals (iTerm2, Termux, VS Code integrated terminal, GNOME
          // Terminal). Terminals that don't support it just show the plain
          // text, no visible garbage -- it's a no-op fallback, not a break.
          const absolutePath = path.resolve(targetPath, e.filePath);
          const clickable = `\u001b]8;;file://${absolutePath}\u001b\\${label}\u001b]8;;\u001b\\`;
          p.log.message(`  [${e.severity}] ${clickable} — ${e.message}`);
          if (e.affectedFileCount > 0) {
            p.log.message(`    affects ${e.affectedFileCount} file(s)`);
          }
        }

        p.log.info("Fix suggestions:");
        const seen = new Set<string>();
        for (const finding of findings) {
          if (seen.has(finding.checkId)) continue;
          seen.add(finding.checkId);
          const suggestion = getFixSuggestion(finding);
          if (suggestion) {
            p.log.message(`  [${suggestion.checkId}] ${suggestion.suggestion}`);
          }
        }

        process.exitCode = findings.some((f) => f.severity === "error") ? 1 : 0;
      } catch (err) {
        spinner.stop("Diagnostics failed to run");
        p.log.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });
}
