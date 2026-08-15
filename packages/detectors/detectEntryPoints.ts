// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Original ARCLUX logic, not adapted from any external source.
//
// Directly motivated by the entry-file gap noted repeatedly on
// detectUnusedExports.ts and detectOrphanFiles.ts: both treat "nothing
// imports this module" as a finding, but a Next.js page.tsx or a CLI's
// index.ts is SUPPOSED to have zero importers — that's what makes it an
// entry point. This is a positive classifier (recognizes known entry
// point conventions), not a fix to those two detectors themselves — it's
// informational groundwork. Wiring it in to suppress those false
// positives is a follow-up, not done here, to keep this change scoped to
// adding the classifier itself.
//
// Deliberately conservative: only classifies orphaned modules (importedBy
// === 0) against filename+path conventions actually used in this repo
// (see PROGRES.md — Next.js App Router routes, apps/cli's index.ts). Does
// not read package.json "bin" fields or framework config — that would
// require file I/O beyond what Repository/ModuleInfo already expose, and
// risks false-classifying a genuinely dead file as an entry point.

import type { Repository } from "../repository/Repository";
import type { ModuleInfo } from "../shared/types";

export interface EntryPointFinding {
  filePath: string;
  reason: string;
}

const NEXTJS_APP_ROUTER_FILE = /(^|\/)app\/.*\/(page|layout|loading|error|not-found|route|template|default)\.(ts|tsx)$/;
const NEXTJS_ROOT_APP_FILE = /(^|\/)app\/(page|layout|loading|error|not-found|route|template|default)\.(ts|tsx)$/;
const CLI_ENTRY_FILE = /(^|\/)apps\/cli\/index\.ts$/;
const VSCODE_EXTENSION_ENTRY_FILE = /(^|\/)apps\/vscode-extension\/src\/extension\.ts$/;
const GITHUB_SCRIPTS_FILE = /(^|\/)\.github\/scripts\/.+\.py$/;

function classify(module: ModuleInfo): string | null {
  const path = module.file.relativePath;

  if (NEXTJS_APP_ROUTER_FILE.test(path) || NEXTJS_ROOT_APP_FILE.test(path)) {
    return "Next.js App Router convention file (page/layout/loading/error/route/etc.) — Next.js imports this by file-based routing convention, not via a source-level import statement.";
  }

  if (CLI_ENTRY_FILE.test(path)) {
    return "CLI entry point — invoked directly by the runtime (e.g. tsx/node), not imported by other source files.";
  }

  if (VSCODE_EXTENSION_ENTRY_FILE.test(path)) {
    return "VS Code extension entry point — invoked by the VS Code runtime (package.json main/activationEvents), not imported by other source files.";
  }

  if (GITHUB_SCRIPTS_FILE.test(path)) {
    return "GitHub workflow script — invoked directly by a workflow (python3 .github/scripts/...), not imported by other source files.";
  }

  return null;
}

/**
 * Finds orphaned modules (nothing in the repo imports them) that match a
 * known entry-point convention. Complements, but does not modify,
 * detectOrphanFiles.ts / detectUnusedExports.ts — those still report these
 * files as findings until they're made entry-file-aware.
 */
export function detectEntryPoints(repository: Repository): EntryPointFinding[] {
  const findings: EntryPointFinding[] = [];

  for (const module of repository.getAllModules()) {
    if (module.importedBy.length > 0) continue;

    const reason = classify(module);
    if (reason) {
      findings.push({ filePath: module.file.relativePath, reason });
    }
  }

  return findings;
}
