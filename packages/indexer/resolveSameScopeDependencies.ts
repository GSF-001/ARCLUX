// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Generic pass for languages where files sharing a scope (a directory for
// Go, a directory for Java too by convention - see parseGo.ts and
// parseJava.ts's matching doc comments for why this is ONE shared gap, not
// two separate language bugs) can reference each other with ZERO import
// statements. resolvePath.ts only ever resolves something that exists as
// an actual import token - this pass exists because that token never
// shows up in the source at all for same-scope references.
//
// LIMITATION (documented, not a bug to "fix" later without redesigning
// the approach entirely): this is a regex whole-word scan, not an AST-
// aware usage check. A name mentioned in a comment or string literal
// inside `content` will false-positive as a "dependency". Kept separate
// from ModuleInfo.imports specifically because of this - see that field's
// doc comment in shared/types.ts.

import type { RawExport } from "../shared/types";

export interface ScopedFile {
  moduleId: string;
  scopeId: string;
  exports: RawExport[];
  content: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Groups files by scopeId, then for each file checks whether its content
 * contains a whole-word match for any OTHER same-scope file's exported
 * names. Returns a map of moduleId -> array of moduleIds it appears to
 * implicitly depend on. Deduped, and a file never depends on itself.
 */
export function resolveSameScopeDependencies(files: ScopedFile[]): Map<string, string[]> {
  const result = new Map<string, string[]>();

  const byScope = new Map<string, ScopedFile[]>();
  for (const file of files) {
    const group = byScope.get(file.scopeId) ?? [];
    group.push(file);
    byScope.set(file.scopeId, group);
  }

  for (const group of byScope.values()) {
    if (group.length < 2) continue; // nothing else in this scope to depend on

    for (const file of group) {
      const deps = new Set<string>();

      for (const other of group) {
        if (other.moduleId === file.moduleId) continue;

        for (const exp of other.exports) {
          if (!exp.name || exp.name === "*") continue;
          const pattern = new RegExp(`\\b${escapeRegExp(exp.name)}\\b`);
          if (pattern.test(file.content)) {
            deps.add(other.moduleId);
            break; // one match against `other` is enough, move to next candidate
          }
        }
      }

      if (deps.size > 0) {
        result.set(file.moduleId, Array.from(deps));
      }
    }
  }

  return result;
}
