// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Wraps the ONE allowed entry point into the ARCLUX core engine:
// engine/pipeline.ts's analyzeRepository(). Per ARCHITECTURE_MAP.md and
// packages/README.md, nobody calls buildIndex/buildDependencyGraph directly
// outside of engine/ — the security/remote layer is no exception. The core
// engine is NOT modified by this package; this is a consumer-side wrapper
// that adds source bookkeeping (id, branch, extra entry paths) around the
// existing stable contract.

import { analyzeRepository, type AnalyzeRepositoryResult } from "../engine/pipeline";
import type { RemoteSource } from "./RemoteSource";

/**
 * A named, reusable analysis target. Each analyze() call runs the full
 * clone(if url)->index->graph->cache->cleanup pipeline through the engine.
 */
export class RemoteRepository {
  constructor(readonly source: RemoteSource) {}

  /** Runs the core pipeline for this source. Never called with both url and localPath. */
  async analyze(): Promise<AnalyzeRepositoryResult> {
    const { url, localPath, branch } = this.source;
    if (url && localPath) {
      throw new Error(`RemoteRepository "${this.source.id}": provide either url or localPath, not both.`);
    }
    if (!url && !localPath) {
      throw new Error(`RemoteRepository "${this.source.id}": url or localPath is required.`);
    }
    return analyzeRepository({ repoUrl: url, localPath, branch });
  }
}
