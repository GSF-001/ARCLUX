// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Repository } from "../repository/Repository";
import { traceConsumers } from "../impact/traceConsumers";
import { buildImpactTree, type ImpactTreeNode } from "../impact/buildImpactTree";
import { calculateAffectedFiles, type ImpactResult } from "../impact/calculateAffectedFiles";
import type { NavigationTarget } from "./CodeNavigator";

export interface ImpactNavigationResult {
  moduleId: string;
  notFound: boolean;
  directConsumers: NavigationTarget[];
  totalAffected: number;
  affected: NavigationTarget[];
  tree: ImpactTreeNode | null;
}

export function getImpactNavigation(repository: Repository, moduleId: string): ImpactNavigationResult {
  const consumerTrace = traceConsumers(repository, moduleId);
  if (consumerTrace.notFound) {
    return { moduleId, notFound: true, directConsumers: [], totalAffected: 0, affected: [], tree: null };
  }

  const affectedResult: ImpactResult = calculateAffectedFiles(repository, moduleId);
  const tree = buildImpactTree(repository, moduleId);

  const toTarget = (id: string): NavigationTarget => {
    const mod = repository.getModule(id);
    return { moduleId: id, filePath: mod?.file.relativePath ?? id };
  };

  return {
    moduleId,
    notFound: false,
    directConsumers: consumerTrace.direct.map(toTarget),
    totalAffected: affectedResult.totalAffected,
    affected: affectedResult.affectedFiles.map((f) => ({ moduleId: f.moduleId, filePath: f.filePath })),
    tree,
  };
}
