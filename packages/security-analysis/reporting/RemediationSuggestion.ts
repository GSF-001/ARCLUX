import type { SecurityFinding } from "../SecurityFinding"; export interface RemediationSuggestion { findingId: string; text: string; }
export function getRemediationSuggestion(finding: SecurityFinding): RemediationSuggestion { return { findingId: finding.id, text: finding.remediation ?? "Review the evidence and apply the least-privilege remediation appropriate for the context." }; }
