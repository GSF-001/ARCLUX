import { Command } from "commander";
import { intro, outro, spinner } from "@clack/prompts";
import { analyzeRepository } from "../../packages/engine/pipeline";
import { runDoctor } from "../../packages/engine/runDoctor";
import type { AnalyzeRepositoryOptions } from "../../packages/engine/pipeline";

export const verifyCommand = new Command()
  .name("verify")
  .description("Verify repository against framework and architecture rules")
  .argument("[path]", "Repository path", ".")
  .option("--framework <name>", "Filter by framework")
  .option("--json", "Output as JSON")
  .action(async (path: string, options) => {
    intro("ARCLUX Verify");

    const s = spinner();
    s.start("Analyzing repository");

    try {
      const result = await analyzeRepository({
        localPath: path,
      });

      s.stop("Repository analyzed");

      const findings = await runDoctor(result.repository);

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              repo: result.meta.name,
              findings: findings.length,
              errors: findings.filter((f) => f.severity === "error").length,
              warnings: findings.filter((f) => f.severity === "warning").length,
              details: findings,
            },
            null,
            2
          )
        );
      } else {
        console.log(`\nRepository: ${result.meta.name}`);
        console.log(`Total findings: ${findings.length}`);
        console.log(
          `Errors: ${findings.filter((f) => f.severity === "error").length}`
        );
        console.log(
          `Warnings: ${findings.filter((f) => f.severity === "warning").length}`
        );

        const byId = new Map<string, number>();
        findings.forEach((f) => {
          byId.set(f.checkId, (byId.get(f.checkId) ?? 0) + 1);
        });

        console.log("\nBy check:");
        byId.forEach((count, checkId) => {
          console.log(`  ${checkId}: ${count}`);
        });
      }

      outro("Verification complete");
    } catch (err) {
      s.stop("Error");
      outro(
        `Error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
      process.exit(1);
    }
  });
