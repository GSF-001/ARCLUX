// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { parseTomlSections } from "../config/parseToml";
import type { ManifestParser, ManifestDependency } from "../core/ManifestParserInterface";

function classifySection(name: string): "runtime" | "dev" | undefined {
  if (name === "dependencies" || name === "build-dependencies") return "runtime";
  if (name === "dev-dependencies") return "dev";
  if (name.endsWith(".dependencies") || name.endsWith(".build-dependencies")) return "runtime";
  if (name.endsWith(".dev-dependencies")) return "dev";
  return undefined;
}

const SINGLE_DEP_SECTION_PATTERN = /\.(dependencies|dev-dependencies)\.([\w-]+)$/;

export const parseCargoToml: ManifestParser = {
  filename: "Cargo.toml",

  parse(content: string): ManifestDependency[] {
    const sections = parseTomlSections(content);
    const dependencies: ManifestDependency[] = [];

    for (const section of sections) {
      const singleDepMatch = section.name.match(SINGLE_DEP_SECTION_PATTERN);
      if (singleDepMatch) {
        const kind: ManifestDependency["kind"] = singleDepMatch[1] === "dev-dependencies" ? "dev" : "runtime";
        dependencies.push({
          name: singleDepMatch[2],
          versionRange: section.entries.version || undefined,
          kind,
        });
        continue;
      }

      const kind = classifySection(section.name);
      if (!kind) continue;

      for (const [name, versionRange] of Object.entries(section.entries)) {
        dependencies.push({ name, versionRange: versionRange || undefined, kind });
      }
    }

    return dependencies;
  },
};
