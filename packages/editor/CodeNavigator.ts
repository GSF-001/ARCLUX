feat/editor-layer
// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import path from "node:path";
import type { Repository } from "../repository/Repository";
import type { ModuleInfo } from "../shared/types";

export function resolveModuleId(repository: Repository, absolutePath: string): string {
  const relative = path.relative(repository.meta.rootPath, absolutePath);
  return relative.split(path.sep).join("/");
}

export interface NavigationTarget {
  moduleId: string;
  filePath: string;
  line?: number;
}

export function openFile(repository: Repository, absolutePath: string): ModuleInfo | null {
  const moduleId = resolveModuleId(repository, absolutePath);
  return repository.getModule(moduleId) ?? null;
}

export function listDependencyTargets(repository: Repository, moduleId: string): NavigationTarget[] {
  const module = repository.getModule(moduleId);
  if (!module) return [];

  return module.resolvedImports.map((imp) => {
    const target = repository.getModule(imp.moduleId);
    return {
      moduleId: imp.moduleId,
      filePath: target?.file.relativePath ?? imp.moduleId,
      line: imp.line,
    };
  });
}

export function listDirectConsumerTargets(repository: Repository, moduleId: string): NavigationTarget[] {
  const module = repository.getModule(moduleId);
  if (!module) return [];

  return module.importedBy.map((consumerId) => {
    const consumer = repository.getModule(consumerId);
    return { moduleId: consumerId, filePath: consumer?.file.relativePath ?? consumerId };
  });
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

// Scaffold: editor/CodeNavigator — not yet implemented.
ARCLUX.main
