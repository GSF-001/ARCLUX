// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

// Clean package exports — consumers import from "../provenance" instead
// of reaching into individual files. (Task requirement: clean index
// exports; harmless to existing packages that import by path directly.)

export type { SourceOrigin } from "./SourceOrigin";
export type { EvidenceOrigin } from "./EvidenceOrigin";
export {
  createProvenanceRecord,
  type ProvenanceRecord,
  type CreateProvenanceRecordInput,
} from "./ProvenanceRecord";
