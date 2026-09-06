#!/usr/bin/env node
// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { Command } from "commander";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerAnalyzeCommand } from "./analyze";
import { registerGraphCommand } from "./graph";
import { registerImpactCommand } from "./impact";
import { registerDiffCommand } from "./diff";
import { registerVerifyCommand } from "./verify";
import { registerDoctorCommand } from "./doctor";
import { registerConfigCommand } from "./config";
import { registerDiagnoseCommand } from "./diagnose";
import { registerDaemonCommand } from "./daemon";
import { registerPsCommand } from "./commands/ps";
import { registerWorkCommand } from "./commands/work";
import { registerEditCommand } from "./commands/edit";
import { registerOpenCommand } from "./commands/open";
import { logsCommand } from "./commands/logs";
import { registerRunCommand } from "./commands/run";
import { registerExecCommand } from "./commands/exec";
import { registerWorkspaceCommand } from "./workspace";
import { registerSystemCommand } from "./commands/system";
import { registerLanguageCommand } from "./language";
import { registerSecurityCommand } from "./security";
import { registerShellCommand } from "./shell";
import { registerScriptCommand } from "./script";
import { registerMcpCommand } from "./commands/mcp";
import { registerConnectCommand } from "./connect";
import { registerServeCommand } from "./serve";

function resolveVersion(): string {
  // Deterministic: walk up from this file's location (works for source,
  // bundled dist, and npm package layout). No hardcoded candidate list.
  const candidates: string[] = [];
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    // Walk up max 5 levels (covers source, dist, and npm global layout)
    let cur = here;
    for (let i = 0; i < 6; i++) {
      candidates.push(path.join(cur, "package.json"));
      const parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
  } catch {}
  // Also try require-based (bundled esbuild banner provides require)
  try {
    const require = createRequire(import.meta.url);
    for (const p of ["../package.json", "../../package.json", "../../../package.json", "./package.json"]) {
      try {
        const pkg = require(p);
        if (pkg?.version) return pkg.version;
      } catch {}
    }
  } catch {}
  for (const p of candidates) {
    try {
      if (!existsSync(p)) continue;
      const pkg = JSON.parse(readFileSync(p, "utf8"));
      // Only accept arclux package (not a parent monorepo's package.json with different name)
      if (pkg?.name === "arclux" && pkg?.version) return pkg.version;
      // Fallback: any version if arclux not found but file exists and version looks semver
      if (pkg?.version && /^\d+\.\d+\.\d+/.test(pkg.version)) {
        // Prefer arclux, but accept first semver as last resort
        // Continue walking to find arclux-named one first
      }
    } catch {}
  }
  // Second pass: accept any version if arclux-named not found (handles root package.json case)
  for (const p of candidates) {
    try {
      if (!existsSync(p)) continue;
      const pkg = JSON.parse(readFileSync(p, "utf8"));
      if (pkg?.version) return pkg.version;
    } catch {}
  }
  return "0.0.0";
}

const program = new Command();
program.name("arclux").description("Repository intelligence CLI").version(resolveVersion());

registerAnalyzeCommand(program);
registerGraphCommand(program);
registerImpactCommand(program);
registerDiffCommand(program);
registerVerifyCommand(program);
registerDoctorCommand(program);
registerConfigCommand(program);
registerDiagnoseCommand(program);
registerDaemonCommand(program);
registerPsCommand(program);
registerWorkCommand(program);
registerEditCommand(program);
registerOpenCommand(program);
program.addCommand(logsCommand);
registerRunCommand(program);
registerExecCommand(program);
registerWorkspaceCommand(program);
registerSystemCommand(program);
registerLanguageCommand(program);
registerSecurityCommand(program);
registerShellCommand(program);
registerScriptCommand(program);
registerMcpCommand(program);
registerConnectCommand(program);
registerServeCommand(program);

program.parse();
