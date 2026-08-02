// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Repository } from "../repository/Repository";
import type { ResolvedImport } from "../shared/types";

export interface ImportTraceEntry {
  fromModuleId: string;
  identifiers: string[];
  line: number;
}

export function traceImports(repository: Repository, moduleId: string): ImportTraceEntry[] {
  const module = repository.getModule(moduleId);
  if (!module) return [];

  return module.resolvedImports.map((imp: ResolvedImport) => {
    const identifiers: string[] = [...imp.namedImports];
    if (imp.hasDefaultImport) identifiers.push("default");
    if (imp.hasNamespaceImport) identifiers.push("*");

    return {
      fromModuleId: imp.moduleId,
      identifiers,
      line: imp.line,
    };
  });
}
