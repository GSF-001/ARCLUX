// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { parseJson } from "../config/parseJson";
import type { ManifestParser, ManifestDependency } from "../core/ManifestParserInterface";

interface ComposerJsonShape {
  require?: Record<string, string>;
  "require-dev"?: Record<string, string>;
}

// composer.json's "require" often includes PHP itself and ext-* entries
// (e.g. "php": "^8.1", "ext-mbstring": "*") alongside real packages — these
// are platform requirements, not installable dependencies, so they're
// filtered out here rather than left for callers to filter themselves.
function isPlatformRequirement(name: string): boolean {
  return name === "php" || name.startsWith("ext-") || name.startsWith("lib-");
}

export const parseComposer: ManifestParser = {
  filename: "composer.json",

  parse(content: string): ManifestDependency[] {
    const parsed = parseJson<ComposerJsonShape>(content);
    if (!parsed) return [];

    const dependencies: ManifestDependency[] = [];

    for (const [name, versionRange] of Object.entries(parsed.require ?? {})) {
      if (isPlatformRequirement(name)) continue;
      dependencies.push({ name, versionRange, kind: "runtime" });
    }
    for (const [name, versionRange] of Object.entries(parsed["require-dev"] ?? {})) {
      if (isPlatformRequirement(name)) continue;
      dependencies.push({ name, versionRange, kind: "dev" });
    }

    return dependencies;
  },
};
