import type { SecurityAnalysis } from "../SecurityAnalysis"; import { summarizeFindings, type FindingSummary } from "./FindingSummary";
export interface SecurityReport { target: string; generatedAt: string; summary: FindingSummary; findings: SecurityAnalysis["findings"]; }
export function createSecurityReport(analysis: SecurityAnalysis): SecurityReport { return { target: analysis.target, generatedAt: new Date().toISOString(), summary: summarizeFindings(analysis.findings), findings: analysis.findings }; }
