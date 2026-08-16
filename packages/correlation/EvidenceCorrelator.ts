// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Evidence correlation: attaches provenance (SourceOrigin + EvidenceOrigin,
// see packages/provenance) to findings and snapshots. The provenance id
// on a finding lets consumers answer "where did this finding come from and
// can I reproduce it" — the analysis-provenance analogue of SLSA's idea.

import type { SecurityFinding } from "../security-analysis/types";
import { createProvenanceRecord } from "../provenance/ProvenanceRecord";
import type { SourceOrigin } from "../provenance/SourceOrigin";
import type { EvidenceOrigin } from "../provenance/EvidenceOrigin";

export interface LinkProvenanceInput {
  findings: SecurityFinding[];
  source: SourceOrigin;
  evidence: EvidenceOrigin;
  snapshotId?: string;
}

export interface LinkProvenanceResult {
  recordId: string;
  findings: SecurityFinding[];
}

/** Creates one provenance record for a finding set and stamps it on every finding. */
export function linkFindingsToProvenance(input: LinkProvenanceInput): LinkProvenanceResult {
  const record = createProvenanceRecord({
    source: input.source,
    evidence: input.evidence,
    snapshotId: input.snapshotId,
  });

  return {
    recordId: record.id,
    findings: input.findings.map((finding) => ({ ...finding, provenanceId: record.id })),
  };
}
