// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { ManifestParser, ManifestDependency } from "../core/ManifestParserInterface";

// requirements.txt is line-based, not a structured format -- one
// dependency per line, in the form "name", "name==1.2.3", "name>=1.2.3",
// "name~=1.2.3", "name!=1.2.3", or combinations ("name>=1.0,<2.0"). This
// keeps only the name and the FIRST version specifier (good enough for
// dependency-listing purposes, not for resolving the exact allowed range).
//
// Skipped, not treated as dependencies: blank lines, comments (# ...),
// option flags (--index-url, --extra-index-url, -r other.txt, -e ./local,
// etc.), and environment markers after a semicolon (e.g.
// "name==1.0; python_version < '3.8'" -- the marker itself is dropped,
// only "name==1.0" is kept).

function stripLineComment(line: string): string {
  const idx = line.indexOf("#");
  return idx === -1 ? line : line.slice(0, idx);
}

function stripEnvironmentMarker(line: string): string {
  const idx = line.indexOf(";");
  return idx === -1 ? line : line.slice(0, idx);
}

// Matches: name, then optionally one version specifier (==, >=, <=, ~=, !=, >, <)
// followed by a version string. Package names can contain letters, digits,
// ., -, _, and an optional [extra] suffix (e.g. "requests[socks]").
const REQUIREMENT_PATTERN = /^([A-Za-z0-9._-]+(?:\[[^\]]+\])?)\s*(==|>=|<=|~=|!=|>|<)?\s*([A-Za-z0-9._*+!-]+)?/;

export const parseRequirements: ManifestParser = {
  filename: "requirements.txt",

  parse(content: string): ManifestDependency[] {
    const dependencies: ManifestDependency[] = [];

    for (const rawLine of content.split("\n")) {
      let line = stripLineComment(rawLine);
      line = stripEnvironmentMarker(line);
      line = line.trim();

      if (!line) continue;
      if (line.startsWith("-")) continue; // option flags: -r, -e, --index-url, etc.

      const match = line.match(REQUIREMENT_PATTERN);
      if (!match) continue;

      const [, name, operator, version] = match;
      if (!name) continue;

      dependencies.push({
        name,
        versionRange: operator && version ? `${operator}${version}` : undefined,
        kind: "runtime",
      });
    }

    return dependencies;
  },
};
