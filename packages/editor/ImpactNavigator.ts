
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

/**
 * Lightweight version of getImpactNavigation: skips buildImpactTree and
 * skips materializing the full `affected` NavigationTarget array -- both
 * expensive and unused by callers that only need the count (e.g. diagnose
 * command's affectedFileCount). Use this when you don't need the tree or
 * the full affected-files list, just the total.
 */
export function getImpactCount(repository: Repository, moduleId: string): number {
  const consumerTrace = traceConsumers(repository, moduleId);
  if (consumerTrace.notFound) return 0;
  const affectedResult: ImpactResult = calculateAffectedFiles(repository, moduleId);
  return affectedResult.totalAffected;
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


/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

