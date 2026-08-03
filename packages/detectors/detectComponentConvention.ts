// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Original ARCLUX logic, not adapted from any external source.

import type { Repository } from "../repository/Repository";
import type { ModuleInfo } from "../shared/types";

export interface ComponentConventionFinding {
  filePath: string;
  message: string;
}

const COMPONENT_EXTENSIONS = [".tsx", ".jsx"];

function isLikelyComponentFile(relativePath: string): boolean {
  const hasExt = COMPONENT_EXTENSIONS.some((ext) => relativePath.endsWith(ext));
  if (!hasExt) return false;
  const filename = relativePath.split("/").pop() ?? "";
  const baseName = filename.replace(/\.(tsx|jsx)$/, "");
  return /^[A-Z]/.test(baseName);
}

/**
 * Checks that a PascalCase .tsx/.jsx file (by ARCLUX's own naming
 * convention — see calculateAffectedComponents.ts's identical heuristic)
 * actually exports something matching its filename, either as the default
 * export or a named export with the same name. A file named Button.tsx
 * that exports nothing named "Button" is either misnamed or the component
 * was renamed without renaming the file.
 *
 * Skips files with zero exports entirely (that's detectOrphanFiles.ts's
 * territory, not a naming mismatch) and Next.js App Router convention
 * files (page.tsx, layout.tsx — those are correctly named by framework
 * convention, not component-name convention).
 */
const FRAMEWORK_CONVENTION_FILENAME = /(^|\/)(page|layout|loading|error|not-found|route|template|default)\.(tsx|jsx)$/;

export function detectComponentConvention(repository: Repository): ComponentConventionFinding[] {
  const findings: ComponentConventionFinding[] = [];

  for (const module of repository.getAllModules()) {
    const path = module.file.relativePath;
    if (!isLikelyComponentFile(path)) continue;
    if (FRAMEWORK_CONVENTION_FILENAME.test(path)) continue;
    if (module.exports.length === 0) continue;

    const filename = path.split("/").pop() ?? "";
    const expectedName = filename.replace(/\.(tsx|jsx)$/, "");

    const hasMatchingExport = module.exports.some(
      (exp: ModuleInfo["exports"][number]) => exp.name === expectedName || exp.kind === "default"
    );

    if (!hasMatchingExport) {
      findings.push({
        filePath: path,
        message: `"${path}" doesn't export anything named "${expectedName}" or a default export — check for a stale rename.`,
      });
    }
  }

  return findings;
}
