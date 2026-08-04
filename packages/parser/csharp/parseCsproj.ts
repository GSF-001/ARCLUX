// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { ManifestParser, ManifestDependency } from "../core/ManifestParserInterface";

// .csproj is XML, but this uses a regex scan rather than a full XML parser —
// no XML parsing dependency exists anywhere else in ARCLUX yet (see
// packages/parser/config/*, none of them are XML), and PackageReference
// elements have a small, consistent enough shape
// (<PackageReference Include="Name" Version="1.2.3" />) that a targeted
// regex is sufficient without pulling in a new dependency for one file
// type. Self-closing and open/close tag forms are both handled.
// .csproj has no dev/runtime distinction the way npm/Cargo do (that's a
// solution-level concept in .NET via project references, not per-package),
// so every PackageReference is reported as "runtime".
export const parseCsproj: ManifestParser = {
  filename: ".csproj",

  parse(content: string): ManifestDependency[] {
    const dependencies: ManifestDependency[] = [];
    const pattern = /<PackageReference\s+Include="([^"]+)"(?:\s+Version="([^"]*)")?/g;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      dependencies.push({
        name: match[1],
        versionRange: match[2] || undefined,
        kind: "runtime",
      });
    }

    return dependencies;
  },
};
