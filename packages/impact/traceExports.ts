// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Repository } from "../repository/Repository";

export interface ExportTraceEntry {
  exportName: string;
  exportKind: "default" | "named" | "re-export";
  line: number;
  importedByModuleIds: string[];
}

export function traceExports(repository: Repository, moduleId: string): ExportTraceEntry[] {
  const module = repository.getModule(moduleId);
  if (!module) return [];

  const allModules = repository.getAllModules();

  return module.exports.map((exp) => {
    const importedByModuleIds: string[] = [];

    if (exp.kind !== "re-export") {
      for (const other of allModules) {
        const importsThisExport = other.resolvedImports.some((imp) => {
          if (imp.moduleId !== moduleId) return false;
          if (imp.hasNamespaceImport) return true;
          if (exp.kind === "default" && imp.hasDefaultImport) return true;
          return imp.namedImports.includes(exp.name);
        });
        if (importsThisExport) importedByModuleIds.push(other.id);
      }
    }

    return {
      exportName: exp.name,
      exportKind: exp.kind,
      line: exp.line,
      importedByModuleIds,
    };
  });
}
