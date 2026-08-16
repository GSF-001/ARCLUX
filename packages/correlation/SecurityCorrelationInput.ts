// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// The security correlation bridge: the single input contract that links
// ARCLUX core outputs (Repository + DependencyGraph + impact snapshot) to
// the security pipeline's findings and provenance. Core types are the REAL
// ones from shared/types.ts and repository/Repository.ts — no fictional
// "CodeGraph"/"ImpactReport" shapes (the task description's @/core/graph
// does not exist in this repo; verified 2026-08-16).

import type { Repository } from "../repository/Repository";
import type { DependencyGraph } from "../shared/types";
import type { SecurityFinding } from "../security-analysis/types";
import type { ProvenanceRecord } from "../provenance/ProvenanceRecord";
import type { ImpactSnapshot } from "./ImpactSnapshot";

export interface SecurityCorrelationInput {
  repository: Repository;
  graph: DependencyGraph;
  impact: ImpactSnapshot;
  findings: SecurityFinding[];
  provenance?: ProvenanceRecord[];
}
