export interface AnalysisBoundary { target: string; includeDependencies: boolean; }
export function createAnalysisBoundary(target: string): AnalysisBoundary { return { target, includeDependencies: true }; }
