// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { parseJson } from "./parseJson";
import type { ManifestParser, ManifestDependency } from "../core/ManifestParserInterface";

interface PackageJsonShape {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

// Note: packages/engine/detectRepositoryMeta.ts already has its own
// lightweight inline package.json reader (readDependencyNames) for
// framework/package-manager detection specifically — that one intentionally
// stays separate since it only needs a flat Set<string> of names, not full
// ManifestDependency objects with version + runtime/dev distinction. Don't
// merge them without checking both call sites first.
export const parsePackageJson: ManifestParser = {
  filename: "package.json",

  parse(content: string): ManifestDependency[] {
    const parsed = parseJson<PackageJsonShape>(content);
    if (!parsed) return [];

    const dependencies: ManifestDependency[] = [];

    for (const [name, versionRange] of Object.entries(parsed.dependencies ?? {})) {
      dependencies.push({ name, versionRange, kind: "runtime" });
    }
    for (const [name, versionRange] of Object.entries(parsed.devDependencies ?? {})) {
      dependencies.push({ name, versionRange, kind: "dev" });
    }

    return dependencies;
  },
};
