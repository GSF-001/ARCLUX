// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { hashObject } from "../shared/hash";
import type { SourceOrigin } from "./SourceOrigin";
import type { EvidenceOrigin } from "./EvidenceOrigin";

/**
 * The full provenance chain for one analysis artifact (a RemoteSnapshot,
 * an AttackSurfaceMap, or an individual finding via finding.provenanceId).
 *
 * Answers two questions consumers should be able to ask about any finding:
 * 1. WHERE did the analyzed code come from?  -> source
 * 2. HOW was this produced, can I reproduce it? -> evidence
 *
 * SLSA-inspired, scoped to analysis (not build) provenance; see the
 * comments in SourceOrigin.ts for the version note (v1.2, verified 2026-08-16).
 */
export interface ProvenanceRecord {
  /**
   * Deterministic fingerprint over the content of the record
   * (hashObject of source + evidence + snapshotId). Stable across runs.
   */
  id: string;
  source: SourceOrigin;
  evidence: EvidenceOrigin;
  /** Link to the RemoteSnapshot this provenance belongs to, when applicable. */
  snapshotId?: string;
  /** Digest of the artifact the provenance describes (e.g. report JSON hash). */
  artifactDigest?: string;
  /** ISO timestamp of record creation. */
  createdAt: string;
}

export interface CreateProvenanceRecordInput {
  source: SourceOrigin;
  evidence: EvidenceOrigin;
  snapshotId?: string;
  artifactDigest?: string;
}

/** Builds a ProvenanceRecord with a deterministic id. */
export function createProvenanceRecord(input: CreateProvenanceRecordInput): ProvenanceRecord {
  const createdAt = new Date().toISOString();
  const record: ProvenanceRecord = {
    id: "",
    source: input.source,
    evidence: input.evidence,
    createdAt,
  };
  if (input.snapshotId !== undefined) record.snapshotId = input.snapshotId;
  if (input.artifactDigest !== undefined) record.artifactDigest = input.artifactDigest;

  record.id = `prov-${hashObject({
    source: record.source,
    evidence: record.evidence,
    snapshotId: record.snapshotId,
    artifactDigest: record.artifactDigest,
  })}`;
  return record;
}
