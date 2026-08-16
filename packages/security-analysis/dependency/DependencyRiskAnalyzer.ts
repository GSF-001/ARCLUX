import type { SecurityFinding } from "../SecurityFinding"; export interface DependencyRiskAnalyzer { analyze(dependencies: string[]): SecurityFinding[]; }
export function createDependencyRiskAnalyzer(): DependencyRiskAnalyzer { return { analyze: () => [] }; }
