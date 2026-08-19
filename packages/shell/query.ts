/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * The universal query surface — ONE way to ask structural questions about
 * a repository. Shell commands (deps/consumers/graph/impact) and plugins
 * (ctx.query) ask the same questions through the same object, instead of
 * each caller hand-walking Repository internals.
 *
 * Every method returns raw data (module IDs, finding lists), never
 * formatted text — formatting is the caller's job. This is intentionally
 * additive: existing packages (detectors, search, impact) keep their own
 * traversal for now; new code gets one canonical path.
 */

import type { Repository } from "../repository/Repository";
import type { ModuleInfo } from "../shared/types";

export interface QueryResult<T> {
  readonly moduleId: string;
  readonly value: T;
}

export class RepositoryQuery {
  constructor(private readonly repository: Repository | null) {}

  /** All modules in the repository (empty when no repo is loaded). */
  modules(): ModuleInfo[] {
    return this.repository?.getAllModules() ?? [];
  }

  /** Resolve a module id (relative or absolute) to ModuleInfo, or null. */
  module(moduleId: string): ModuleInfo | null {
    return this.repository?.getModule(moduleId) ?? null;
  }

  /** What moduleId imports. */
  importsOf(moduleId: string): QueryResult<string[]> {
    return { moduleId, value: this.module(moduleId)?.imports ?? [] };
  }

  /** Who imports moduleId. */
  consumersOf(moduleId: string): QueryResult<string[]> {
    return { moduleId, value: this.module(moduleId)?.importedBy ?? [] };
  }

  /** What moduleId calls (call graph edges). */
  callsOf(moduleId: string): QueryResult<string[]> {
    return { moduleId, value: this.module(moduleId)?.calls ?? [] };
  }

  /** Who calls moduleId. */
  calledByOf(moduleId: string): QueryResult<string[]> {
    return { moduleId, value: this.module(moduleId)?.calledBy ?? [] };
  }

  /** Modules that are never imported by anything (entry-point candidates). */
  roots(): ModuleInfo[] {
    return (this.repository?.getAllModules() ?? []).filter((m) => m.importedBy.length === 0);
  }

  /** Modules nobody imports and that import nothing (fully isolated). */
  islands(): ModuleInfo[] {
    return (this.repository?.getAllModules() ?? []).filter(
      (m) => m.importedBy.length === 0 && m.imports.length === 0
    );
  }

  /** Modules that import at least one of the given paths (transitively, one hop). */
  reachableFrom(moduleIds: string[]): Set<string> {
    const seen = new Set<string>();
    const queue = [...moduleIds];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (seen.has(current)) continue;
      seen.add(current);
      for (const importer of this.module(current)?.importedBy ?? []) queue.push(importer);
    }
    return seen;
  }

  /** Direct consumers of every module — the "who breaks when X changes" map. */
  affectedByChange(moduleId: string, depth: number): string[] {
    const result = new Set<string>();
    let frontier = [...(this.consumersOf(moduleId).value ?? [])];
    for (let d = 0; d < depth && frontier.length > 0; d++) {
      const next: string[] = [];
      for (const id of frontier) {
        if (result.has(id)) continue;
        result.add(id);
        next.push(...this.consumersOf(id).value);
      }
      frontier = next;
    }
    return [...result];
  }
}
