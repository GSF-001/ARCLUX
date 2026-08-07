// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { ManifestParser, ManifestDependency } from "../core/ManifestParserInterface";

// go.mod has its own line-based syntax, not JSON/TOML/YAML — can't reuse
// the generic config/* parsers. Handles both single-line "require x v1.2.3"
// and parenthesized "require (...)" blocks. Everything in go.mod is a
// runtime dependency — Go has no separate dev-dependency concept the way
// npm/Cargo/Bundler do, so `kind` is always "runtime" here.
//
// Does NOT parse "replace" or "exclude" directives — those modify/override
// requirements rather than declare new ones, out of scope for a flat
// dependency list.

function stripLineComment(line: string): string {
  const idx = line.indexOf("//");
  return idx === -1 ? line : line.slice(0, idx);
}

function toDependency(modulePath: string, version: string): ManifestDependency {
  return { name: modulePath, versionRange: version || undefined, kind: "runtime" };
}

export const parseGoMod: ManifestParser = {
  filename: "go.mod",

  parse(content: string): ManifestDependency[] {
    const dependencies: ManifestDependency[] = [];
    const lines = content.split("\n");
    let inRequireBlock = false;

    for (const rawLine of lines) {
      const line = stripLineComment(rawLine).trim();
      if (!line) continue;

      if (!inRequireBlock) {
        if (/^require\s*\(\s*$/.test(line)) {
          inRequireBlock = true;
          continue;
        }

        const singleMatch = line.match(/^require\s+(\S+)\s+(\S+)/);
        if (singleMatch) {
          dependencies.push(toDependency(singleMatch[1], singleMatch[2]));
        }
        continue;
      }

      if (line === ")") {
        inRequireBlock = false;
        continue;
      }

      const entryMatch = line.match(/^(\S+)\s+(\S+)/);
      if (entryMatch) {
        dependencies.push(toDependency(entryMatch[1], entryMatch[2]));
      }
    }

    return dependencies;
  },
};
