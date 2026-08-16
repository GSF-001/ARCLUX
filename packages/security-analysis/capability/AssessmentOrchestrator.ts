// Copyright 2026 Mikatoshi
// Licensed under the Apache License, Version 2.0

import { classifyCapability, type CapabilityClassification } from "./CapabilityClassification";
import { detectCapabilityEvidence } from "./CapabilityDetector";
import { mockTarget, type MockResponse } from "./MockTarget";
import type { CapabilityClassificationInput } from "./CapabilityEvidence";

export interface CapabilityAssessment extends CapabilityClassification {
  mockResponses: MockResponse[];
  safety: "mock-only";
}

export function assessCapability(input: CapabilityClassificationInput): CapabilityAssessment {
  const classification = classifyCapability(input.evidence);
  const mockResponses = ["baseline", "mutated"].map((inputVariant) =>
    mockTarget({ target: input.target, inputVariant })
  );
  return { ...classification, mockResponses, safety: "mock-only" };
}

export function assessCapabilitySource(
  target: string,
  files: Array<{ file: string; source: string }>
): CapabilityAssessment {
  return assessCapability({ target, evidence: detectCapabilityEvidence(files) });
}
