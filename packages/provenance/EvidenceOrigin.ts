// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Which tool produced an evidence item (a finding, a snapshot, a map).
// The reproducibility half of provenance: given the same source + same
// evidence origin (tool version + rule set + config), a re-run should
// produce the same results. ruleSetHash/configHash are hashObject()
// fingerprints of the exact rule/configuration inputs that were used.

export interface EvidenceOrigin {
  /** Tool identifier, e.g. "arclux.security-analysis". */
  toolId: string;
  /** Tool version, e.g. "0.1.0". */
  toolVersion: string;
  /** Hash of the rule set used (detectors + severity mappings). */
  ruleSetHash?: string;
  /** Hash of the configuration inputs (thresholds, allowlists, paths). */
  configHash?: string;
  /** ISO timestamp of when the analysis executed. */
  executedAt: string;
}
