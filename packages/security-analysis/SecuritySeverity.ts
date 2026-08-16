// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Severity taxonomy follows the Semgrep model (LOW/MEDIUM/HIGH/CRITICAL),
// verified against Semgrep's rule-syntax docs (2026-08-16). Maps to SARIF
// level as: critical/high -> error, medium -> warning, low -> note.

/** Security severity of a finding. */
export type SecuritySeverity = "critical" | "high" | "medium" | "low";

/** How sure the detector is that the finding is a real vulnerability, not a false positive. */
export type SecurityConfidence = "high" | "medium" | "low";
