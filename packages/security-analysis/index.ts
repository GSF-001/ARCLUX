// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

// Clean package exports for the security-analysis package. Architecture
// analyzers (architecture/) and reporting (reporting/) are added in later
// phases of the approved plan; this file grows with them.

export type {
  SecuritySeverity,
  SecurityConfidence,
  SecurityLocation,
  SecurityFinding,
  RemediationSuggestion,
  SourceProvider,
} from "./types";

export { DiskSourceProvider } from "./SourceProvider";

export {
  detectSecretExposure,
  shannonEntropy,
  DEFAULT_SECRET_RULES,
  type SecretRule,
  type SecretDetectionOptions,
} from "./source/SecretExposureDetector";

export {
  detectUnsafePatterns,
  DEFAULT_UNSAFE_PATTERN_RULES,
  type UnsafePatternRule,
  type UnsafePatternOptions,
} from "./source/UnsafePatternDetector";

export {
  detectSensitiveDataFlow,
  DEFAULT_DATA_FLOW_RULES,
  type DataFlowRule,
  type SensitiveDataFlowOptions,
} from "./source/SensitiveDataFlowDetector";

export {
  detectTrustBoundaryViolations,
  classifyTrustZone,
  DEFAULT_TRUST_ZONES,
  type TrustZoneDefinition,
  type TrustZoneId,
  type TrustBoundaryOptions,
} from "./architecture/TrustBoundaryAnalyzer";

export { detectCrossBoundaryCalls } from "./architecture/CrossBoundaryAnalyzer";

export {
  analyzeSecurityImpact,
  attachImpactToFindings,
  type SecurityImpactReport,
  type ImpactedFinding,
} from "./architecture/SecurityImpactAnalyzer";
