import { Command } from "commander";
import { intro, outro, text } from "@clack/prompts";
import path from "path";
import fs from "fs";

export const editCommand = new Command()
  .name("edit")
  .description("Edit and verify changes before applying")
  .argument("<file>", "File to edit")
  .option("--replacement <path>", "Path to replacement content file")
  .option("--apply", "Apply changes without confirmation")
  .action(async (file: string, options) => {
    intro("ARCLUX Edit");

    const filePath = path.resolve(file);

    if (!fs.existsSync(filePath)) {
      outro(`Error: File not found: ${filePath}`);
      process.exit(1);
    }

    if (!options.replacement) {
      outro("Error: --replacement flag is required");
      process.exit(1);
    }

    const replacementPath = path.resolve(options.replacement);

    if (!fs.existsSync(replacementPath)) {
      outro(`Error: Replacement file not found: ${replacementPath}`);
      process.exit(1);
    }

    const currentContent = fs.readFileSync(filePath, "utf-8");
    const newContent = fs.readFileSync(replacementPath, "utf-8");

    console.log(`\nFile: ${filePath}`);
    console.log(`Current lines: ${currentContent.split("\n").length}`);
    console.log(`New lines: ${newContent.split("\n").length}`);

    if (options.apply) {
      fs.writeFileSync(filePath, newContent, "utf-8");
      outro(`File updated: ${filePath}`);
    } else {
      outro("Changes not applied (use --apply to confirm)");
    }
  });
