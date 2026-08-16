// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unit tests for packages/provenance: the SLSA-inspired analysis
// provenance record (SourceOrigin + EvidenceOrigin + ProvenanceRecord).

import { describe, it, expect } from "vitest";
import { createProvenanceRecord } from "../packages/provenance";

function baseInput() {
  return {
    source: {
      url: "https://github.com/GSF-001/ARCLUX.git",
      branch: "ARCLUX.main",
      commitSha: "ab87b87",
      acquiredAt: "2026-08-16T10:00:00.000Z",
    },
    evidence: {
      toolId: "arclux.security-analysis",
      toolVersion: "0.1.0",
      executedAt: "2026-08-16T10:05:00.000Z",
    },
  };
}

describe("createProvenanceRecord", () => {
  it("produces a deterministic id for the same source+evidence", () => {
    const a = createProvenanceRecord(baseInput());
    const b = createProvenanceRecord(baseInput());
    expect(a.id).toBe(b.id);
    expect(a.id).toMatch(/^prov-[0-9a-f]{12}$/);
  });

  it("changes id when the source commit changes", () => {
    const a = createProvenanceRecord(baseInput());
    const b = createProvenanceRecord({
      ...baseInput(),
      source: { ...baseInput().source, commitSha: "deadbeef" },
    });
    expect(a.id).not.toBe(b.id);
  });

  it("changes id when the evidence tool version changes", () => {
    const a = createProvenanceRecord(baseInput());
    const b = createProvenanceRecord({
      ...baseInput(),
      evidence: { ...baseInput().evidence, toolVersion: "0.2.0" },
    });
    expect(a.id).not.toBe(b.id);
  });

  it("carries through snapshotId and artifactDigest", () => {
    const record = createProvenanceRecord({
      ...baseInput(),
      snapshotId: "snap-abc",
      artifactDigest: "sha256:xyz",
    });
    expect(record.snapshotId).toBe("snap-abc");
    expect(record.artifactDigest).toBe("sha256:xyz");
  });

  it("stamps createdAt as an ISO timestamp", () => {
    const record = createProvenanceRecord(baseInput());
    expect(new Date(record.createdAt).toISOString()).toBe(record.createdAt);
  });
});
