// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Rule-matching concept (from-pattern / to-pattern regex on folder path)
// inspired by sverweij/dependency-cruiser's folder rule matching (MIT) —
// see src/validate/match-folder-dependency-rule.mjs in that project. Not a
// port: dependency-cruiser's version supports arbitrary user-defined rules
// with regex capture groups threaded from "from" into "to" patterns; this
// is a small fixed set of ARCLUX-specific layer rules against ARCLUX's own
// ModuleInfo/ResolvedImport shape, no group-capture machinery.

import type { Repository } from "../repository/Repository";

export interface LayerViolationFinding {
  filePath: string;
  line: number;
  importedFilePath: string;
  ruleName: string;
  message: string;
}

interface LayerRule {
  name: string;
  /** Regex tested against the importing module's relativePath. */
  fromPattern: RegExp;
  /** Regex tested against the imported module's relativePath. */
  toPattern: RegExp;
  reason: string;
}

// Fixed, small rule set — not a general-purpose configurable rule engine
// like dependency-cruiser's. If ARCLUX ever needs user-defined layer rules
// (e.g. per-repo config), this is the place to grow into that, but that's
// a bigger feature than what's needed right now.
const LAYER_RULES: LayerRule[] = [
  {
    name: "packages-no-apps-import",
    fromPattern: /^packages\//,
    toPattern: /^apps\//,
    reason: "packages/* is meant to be framework-agnostic and must not depend on apps/*.",
  },
  {
    name: "shared-no-sibling-import",
    fromPattern: /^packages\/shared\//,
    toPattern: /^packages\/(?!shared\/)/,
    reason: "packages/shared/* is meant to be a leaf dependency — it must not import from other packages/*.",
  },
];

/**
 * Checks each resolved import against a fixed set of layer rules (e.g.
 * "packages/* must not import apps/*"). Only checks internal, resolved
 * imports (ResolvedImport.moduleId) — external package imports (react,
 * commander, etc.) are out of scope since they don't resolve to a
 * repository module.
 */
export function detectLayerViolation(repository: Repository): LayerViolationFinding[] {
  const findings: LayerViolationFinding[] = [];

  for (const module of repository.getAllModules()) {
    for (const resolved of module.resolvedImports) {
      const target = repository.getModule(resolved.moduleId);
      if (!target) continue;

      for (const rule of LAYER_RULES) {
        if (!rule.fromPattern.test(module.file.relativePath)) continue;
        if (!rule.toPattern.test(target.file.relativePath)) continue;

        findings.push({
          filePath: module.file.relativePath,
          line: resolved.line,
          importedFilePath: target.file.relativePath,
          ruleName: rule.name,
          message: `"${module.file.relativePath}" imports "${target.file.relativePath}", violating rule "${rule.name}": ${rule.reason}`,
        });
      }
    }
  }

  return findings;
}
