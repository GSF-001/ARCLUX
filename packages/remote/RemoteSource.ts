// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// What to analyze: a remote repo URL, a local path, or (in the future)
// a bare clone. Mirrors engine/pipeline.ts's AnalyzeRepositoryOptions
// contract (repoUrl XOR localPath) and adds attack-surface configuration.

export interface RemoteSource {
  /** Stable caller-supplied id, e.g. "repo:gsf-001/arclux". */
  id: string;
  /** Remote repository URL. Provide this OR localPath, never both. */
  url?: string;
  /** Directory already on disk. Provide this OR url, never both. */
  localPath?: string;
  /** Branch to analyze (remote analysis only; local analysis ignores it). */
  branch?: string;
  /**
   * Extra entry points for AttackSurfaceMapper, beyond the automatically
   * detected ones (e.g. `["server/app.listen.ts"]` for an express app
   * whose entry convention detectEntryPoints doesn't know).
   */
  extraEntryPaths?: string[];
}
