import type { SecurityFinding } from "../SecurityFinding"; export interface ImpactCorrelation { findingId: string; score: number; }
export function correlateImpact(finding: SecurityFinding): ImpactCorrelation { return { findingId: finding.id, score: { info: 0, low: 1, medium: 3, high: 6, critical: 10 }[finding.severity] }; }
