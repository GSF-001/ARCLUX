// Copyright 2026 ARCLUX
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { SymbolDiffResult } from "./SymbolDiff";
import type { AstDiffResult } from "./AstDiff";
import type { DependencyDiffResult } from "./DependencyDiff";

export interface DiffRenderInput {
  symbolDiff?: SymbolDiffResult;
  astDiffs?: AstDiffResult[];
  dependencyDiff?: DependencyDiffResult;
}

export function renderSemanticDiff(parts: DiffRenderInput): string {
  const lines: string[] = [];

  if (parts.symbolDiff) {
    lines.push("## Symbol changes");
    for (const s of parts.symbolDiff.added) lines.push(`  + ${s.name} (${s.moduleId})`);
    for (const s of parts.symbolDiff.removed) lines.push(`  - ${s.name} (${s.moduleId})`);
    for (const m of parts.symbolDiff.moved) lines.push(`  ~ ${m.name} moved ${m.from} -> ${m.to}`);
    lines.push("");
  }

  if (parts.astDiffs) {
    lines.push("## AST changes");
    for (const a of parts.astDiffs) {
      lines.push(`  ${a.filePath}`);
      a.importsAdded.forEach((i) => lines.push(`    + import ${i}`));
      a.importsRemoved.forEach((i) => lines.push(`    - import ${i}`));
      a.exportsAdded.forEach((e) => lines.push(`    + export ${e}`));
      a.exportsRemoved.forEach((e) => lines.push(`    - export ${e}`));
    }
    lines.push("");
  }

  if (parts.dependencyDiff) {
    lines.push("## Dependency & impact");
    lines.push(`  Changed files: ${parts.dependencyDiff.changedFiles.length}`);
    lines.push(`  Affected modules: ${parts.dependencyDiff.affectedModules.length}`);
    for (const mod of parts.dependencyDiff.affectedModules) lines.push(`    * ${mod}`);
  }

  return lines.join("\n");
}
