import { assessCapabilitySource } from "../../../packages/security-analysis/capability/AssessmentOrchestrator";

const files = [{
  file: "playground/adversarial-capability-fixture",
  source: "mock target endpoint inputMutation response status credential execution model",
}];

/** Fixture entry point: delegates to ARCLUX and never performs live I/O. */
export function runAssessment() {
  return assessCapabilitySource("mock://adversarial-fixture", files);
}
