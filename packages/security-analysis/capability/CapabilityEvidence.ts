// Copyright 2026 Mikatoshi
// Licensed under the Apache License, Version 2.0

export type CapabilitySignal =
  | "network-io"
  | "dynamic-target"
  | "input-mutation"
  | "response-branching"
  | "execution-capability"
  | "credential-capability";

export interface BehavioralEvidence {
  signal: CapabilitySignal;
  file: string;
  line: number;
  detail: string;
  confidence: number;
}

export interface CapabilityClassificationInput {
  target: string;
  evidence: BehavioralEvidence[];
}
