import type { SecurityFinding } from "../SecurityFinding"; export interface FindingCorrelator { correlate(findings: SecurityFinding[]): SecurityFinding[]; }
export function createFindingCorrelator(): FindingCorrelator { return { correlate: (findings) => findings }; }
