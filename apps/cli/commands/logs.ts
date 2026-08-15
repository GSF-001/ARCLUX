import { Command } from "commander";
import { intro, outro, select } from "@clack/prompts";
import fs from "fs";
import path from "path";

const ARCLUX_HOME = path.join(process.env.HOME || "/root", ".arclux");
const LOGS_DIR = path.join(ARCLUX_HOME, "logs");

export const logsCommand = new Command()
  .name("logs")
  .description("View daemon or CLI logs")
  .option("--daemon", "Show daemon logs")
  .option("--tail <n>", "Show last n lines", "50")
  .option("--follow", "Follow log file (daemon only)")
  .action(async (options) => {
    intro("ARCLUX Logs");

    if (!fs.existsSync(LOGS_DIR)) {
      outro("No logs found");
      process.exit(0);
    }

    const logFiles = fs
      .readdirSync(LOGS_DIR)
      .filter((f) => f.endsWith(".log"));

    if (logFiles.length === 0) {
      outro("No log files found");
      process.exit(0);
    }

    const selected = options.daemon
      ? logFiles.find((f) => f.includes("daemon"))
      : logFiles[logFiles.length - 1];

    if (!selected) {
      outro("No matching log file found");
      process.exit(1);
    }

    const logPath = path.join(LOGS_DIR, selected);
    const content = fs.readFileSync(logPath, "utf-8");
    const lines = content.split("\n");
    const tail = parseInt(options.tail);
    const displayLines = lines.slice(Math.max(0, lines.length - tail));

    console.log(`\n=== ${selected} (last ${tail} lines) ===\n`);
    console.log(displayLines.join("\n"));

    outro("Done");
  });
