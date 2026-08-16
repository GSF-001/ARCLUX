// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Where the analyzed code came from. Modeled on the SLSA v1.2 Source
// track's idea of source provenance (verified 2026-08-16: SLSA v1.0 is
// RETIRED, v1.2 current) — but scoped to ANALYSIS provenance: we record
// the origin of the code that was analyzed, not of a built artifact.

export interface SourceOrigin {
  /** Remote repository URL. Present for remote analysis. */
  url?: string;
  /** Local path analyzed directly. Present for local analysis. */
  localPath?: string;
  /** Branch that was analyzed, if known. */
  branch?: string;
  /** Commit SHA the analysis ran against, if known. */
  commitSha?: string;
  /** Git ref (tag/branch) resolved at analysis time. */
  ref?: string;
  /** ISO timestamp of when the source was acquired (cloned/checked out). */
  acquiredAt: string;
  /** Content fingerprint of the analyzed tree (hashObject over scan files). */
  digest?: string;
}
