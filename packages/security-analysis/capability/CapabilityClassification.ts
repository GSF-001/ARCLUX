// Copyright 2026 Mikatoshi
// Licensed under the Apache License, Version 2.0

import type { SecuritySeverity } from "../SecuritySeverity";
import type { BehavioralEvidence } from "./CapabilityEvidence";

export interface CapabilityClassification {
  capability: "none" | "assessment-capability";
  risk: SecuritySeverity;
  signals: string[];
  rationale: string;
  evidence: BehavioralEvidence[];
}

export function classifyCapability(evidence: BehavioralEvidence[]): CapabilityClassification {
  const signals = [...new Set(evidence.map((item) => item.signal))];
  const has = (signal: BehavioralEvidence["signal"]) => signals.includes(signal);
  let risk: SecuritySeverity = "info";

  if (has("execution-capability") && has("credential-capability")) risk = "critical";
  else if (signals.length >= 4 || has("execution-capability")) risk = "high";
  else if (signals.length >= 2) risk = "medium";
  else if (signals.length === 1) risk = "low";

  return {
    capability: signals.length === 0 ? "none" : "assessment-capability",
    risk,
    signals,
    rationale: signals.length === 0
      ? "No behavioral capability signals were found."
      : `Observed ${signals.length} behavioral signal(s); classification is evidence-based and does not prove exploitability.`,
    evidence,
  };
}
