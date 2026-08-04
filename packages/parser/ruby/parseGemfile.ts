// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { ManifestParser, ManifestDependency } from "../core/ManifestParserInterface";

// Gemfile is Ruby source, not a data format — this handles the common
// `gem "name", "version"` / `gem "name", "~> version"` call form line by
// line via regex, NOT a real Ruby parser. Does not evaluate conditionals
// (if/group blocks), so a gem declared only inside `group :test do ... end`
// is still reported as unconditional — acceptable for dependency-listing
// purposes, not for determining exactly when a gem loads.
//
// `:group` and other trailing symbol options (`require: false`, etc.) are
// ignored, only the name + first version-like string argument are kept.
function stripLineComment(line: string): string {
  const idx = line.indexOf("#");
  return idx === -1 ? line : line.slice(0, idx);
}

export const parseGemfile: ManifestParser = {
  filename: "Gemfile",

  parse(content: string): ManifestDependency[] {
    const dependencies: ManifestDependency[] = [];
    const gemPattern = /^\s*gem\s+["']([^"']+)["'](?:\s*,\s*["']([^"']+)["'])?/;

    for (const rawLine of content.split("\n")) {
      const line = stripLineComment(rawLine);
      const match = line.match(gemPattern);
      if (!match) continue;

      dependencies.push({
        name: match[1],
        versionRange: match[2] || undefined,
        kind: "runtime",
      });
    }

    return dependencies;
  },
};
