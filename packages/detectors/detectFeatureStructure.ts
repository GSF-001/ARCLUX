// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Original ARCLUX logic, not adapted from any external source.
//
// Modeled directly on apps/web/features/*'s ACTUAL layout in this repo
// (see PROGRES.md) — every existing feature folder (graph, impact, issues,
// repository, search) pairs at least one useXxx.ts hook with an XxxStore.ts
// store. This detector checks that pairing holds for feature folders in
// general, rather than inventing a convention this repo doesn't itself use.

import type { Repository } from "../repository/Repository";

export interface FeatureStructureFinding {
  featurePath: string;
  message: string;
}

const FEATURES_DIR_PATTERN = /(^|\/)features\/([^/]+)\//;
const HOOK_FILENAME = /(^|\/)use[A-Z][^/]*\.tsx?$/;
const STORE_FILENAME = /(^|\/)[a-zA-Z]+Store\.tsx?$/;

export function detectFeatureStructure(repository: Repository): FeatureStructureFinding[] {
  const findings: FeatureStructureFinding[] = [];
  const featureFolders = new Map<string, { hasHook: boolean; hasStore: boolean }>();

  for (const module of repository.getAllModules()) {
    const match = module.file.relativePath.match(FEATURES_DIR_PATTERN);
    if (!match) continue;

    const featureName = match[2];
    const entry = featureFolders.get(featureName) ?? { hasHook: false, hasStore: false };

    if (HOOK_FILENAME.test(module.file.relativePath)) entry.hasHook = true;
    if (STORE_FILENAME.test(module.file.relativePath)) entry.hasStore = true;

    featureFolders.set(featureName, entry);
  }

  for (const [featureName, { hasHook, hasStore }] of featureFolders) {
    if (!hasHook) {
      findings.push({
        featurePath: `features/${featureName}`,
        message: `Feature "${featureName}" has no useXxx.ts hook — features in this repo conventionally expose one.`,
      });
    }
    if (!hasStore) {
      findings.push({
        featurePath: `features/${featureName}`,
        message: `Feature "${featureName}" has no XxxStore.ts — features in this repo conventionally expose one.`,
      });
    }
  }

  return findings;
}
