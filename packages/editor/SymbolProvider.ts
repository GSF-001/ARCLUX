
// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Repository } from "../repository/Repository";
import type { RawExport, ResolvedImport } from "../shared/types";

export interface SymbolInfo {
  name: string;
  kind: "export" | "import";
  line: number;
  fromModuleId?: string;
}

export function getFileSymbols(repository: Repository, moduleId: string): SymbolInfo[] {
  const module = repository.getModule(moduleId);
  if (!module) return [];

  const exportSymbols: SymbolInfo[] = module.exports.map((exp: RawExport) => ({
    name: exp.name,
    kind: "export" as const,
    line: exp.line,
  }));

  const importSymbols: SymbolInfo[] = module.resolvedImports.flatMap((imp: ResolvedImport) =>
    imp.namedImports.map((name) => ({
      name,
      kind: "import" as const,
      line: imp.line,
      fromModuleId: imp.moduleId,
    }))
  );

  return [...exportSymbols, ...importSymbols].sort((a, b) => a.line - b.line);
}

export function getSymbolsAtLine(repository: Repository, moduleId: string, line: number): SymbolInfo[] {
  return getFileSymbols(repository, moduleId).filter((s) => s.line === line);
}


/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

