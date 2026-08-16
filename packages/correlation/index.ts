// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

// Clean package exports — consumers import from "../correlation".

export type { SecurityCorrelationInput } from "./SecurityCorrelationInput";
export { buildImpactSnapshot, type ImpactSnapshot, type ImpactedFile } from "./ImpactSnapshot";
export {
  mapAttackSurface,
  type AttackSurfaceMap,
  type AttackSurfaceOptions,
  type Exposure,
} from "./AttackSurfaceMapper";
export {
  dedupeFindings,
  groupFindingsBySeverity,
  groupFindingsByFile,
} from "./FindingCorrelator";
export {
  linkFindingsToProvenance,
  type LinkProvenanceInput,
  type LinkProvenanceResult,
} from "./EvidenceCorrelator";
export {
  correlateFindingsWithImpact,
  scoreFinding,
  type CorrelatedFinding,
} from "./ImpactCorrelation";
