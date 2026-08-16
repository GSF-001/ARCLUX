// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// `arclux security <path>` — runs the full security-analysis pipeline:
// secrets, unsafe patterns, sensitive-data-flow heuristics, trust
// boundaries, cross-boundary calls, and the attack-surface map. Consumes
// the core engine's analyzeRepository() (the ONE allowed entry point per
// ARCHITECTURE_MAP.md) and the security packages from the approved plan
// (docs/SECURITY_ANALYSIS_PLAN.md). Core engine untouched.
//
// Exit code: 1 when any critical/high finding exists (CI gate), else 0.

import type { Command } from "commander";
import * as p from "@clack/prompts";
import { analyzeRepository } from "../../packages/engine/pipeline";
import { DiskSourceProvider } from "../../packages/security-analysis";
import { detectSecretExposure } from "../../packages/security-analysis/source/SecretExposureDetector";
import { detectUnsafePatterns } from "../../packages/security-analysis/source/UnsafePatternDetector";
import { detectSensitiveDataFlow } from "../../packages/security-analysis/source/SensitiveDataFlowDetector";
import { detectTrustBoundaryViolations } from "../../packages/security-analysis/architecture/TrustBoundaryAnalyzer";
import { detectCrossBoundaryCalls } from "../../packages/security-analysis/architecture/CrossBoundaryAnalyzer";
import { mapAttackSurface } from "../../packages/correlation/AttackSurfaceMapper";
import { buildSecurityReport } from "../../packages/security-analysis/reporting/SecurityReport";

export function registerSecurityCommand(program: Command): void {
  program
    .command("security")
    .description("Run the security-analysis pipeline (secrets, unsafe patterns, trust boundaries, attack surface)")
    .argument("[path]", "path to the repository root", ".")
    .option("--json", "print the full report as JSON (ARCLUX shape)")
    .option("--sarif", "print the full report as SARIF 2.1.0 JSON")
    .option("--no-fail", "always exit 0, even with critical/high findings")
    .action(async (targetPath: string, opts: { json?: boolean; sarif?: boolean; fail?: boolean }) => {
      const spinner = p.spinner();
      spinner.start(`Running security analysis on ${targetPath}`);

      try {
        const result = await analyzeRepository({ localPath: targetPath });

        const sources = new DiskSourceProvider(targetPath);
        const findings = [
          ...detectSecretExposure(result.repository, sources),
          ...detectUnsafePatterns(result.repository, sources),
          ...detectSensitiveDataFlow(result.repository, sources),
          ...detectTrustBoundaryViolations(result.repository, sources),
          ...detectCrossBoundaryCalls(result.repository, sources),
        ];
        const attackSurface = mapAttackSurface(result.repository, result.graph);

        const report = buildSecurityReport({
          repositoryId: result.meta.id,
          findings,
          attackSurface,
        });

        spinner.stop("Security analysis finished");

        if (opts.sarif) {
          console.log(report.toSarif());
        } else if (opts.json) {
          console.log(report.toJson());
        } else {
          const s = report.summary;
          console.log(`\nSecurity summary: ${s.total} findings (${s.critical} critical, ${s.high} high, ${s.medium} medium, ${s.low} low)`);
          console.log(`Attack surface: ${attackSurface.entryPoints.length} entry point(s), ${attackSurface.reachableModules.length} reachable / ${attackSurface.unreachableModules.length} unreachable modules`);
          for (const f of report.findings) {
            const loc = f.location.line !== undefined ? `${f.location.filePath}:${f.location.line}` : f.location.filePath;
            console.log(`  [${f.severity}] ${f.ruleId} — ${loc} — ${f.title}`);
          }
        }

        const blocksCi = report.summary.critical + report.summary.high > 0;
        process.exitCode = blocksCi && opts.fail !== false ? 1 : 0;
      } catch (err) {
        spinner.stop("Security analysis failed");
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
