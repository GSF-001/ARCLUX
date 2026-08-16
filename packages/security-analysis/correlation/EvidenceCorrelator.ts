import type { SecurityEvidence } from "../SecurityEvidence"; export interface EvidenceCorrelator { merge(evidence: SecurityEvidence[]): SecurityEvidence[]; }
export function createEvidenceCorrelator(): EvidenceCorrelator { return { merge: (items) => Array.from(new Map(items.map((item) => [`${item.file}:${item.line}:${item.source}`, item])).values()) }; }
