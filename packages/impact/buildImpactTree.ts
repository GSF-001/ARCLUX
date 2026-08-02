// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Repository } from "../repository/Repository";

export interface ImpactTreeNode {
  moduleId: string;
  filePath: string;
  children: ImpactTreeNode[];
}

export function buildImpactTree(repository: Repository, moduleId: string, maxDepth = 20): ImpactTreeNode | null {
  const rootModule = repository.getModule(moduleId);
  if (!rootModule) return null;

  function buildNode(id: string, ancestors: Set<string>, depth: number): ImpactTreeNode {
    const module = repository.getModule(id);
    const filePath = module?.file.relativePath ?? id;

    if (depth >= maxDepth || !module) {
      return { moduleId: id, filePath, children: [] };
    }

    const nextAncestors = new Set(ancestors).add(id);
    const children = module.importedBy
      .filter((consumerId) => !ancestors.has(consumerId))
      .map((consumerId) => buildNode(consumerId, nextAncestors, depth + 1));

    return { moduleId: id, filePath, children };
  }

  return buildNode(moduleId, new Set(), 0);
}
