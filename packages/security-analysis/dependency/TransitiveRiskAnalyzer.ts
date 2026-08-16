export interface TransitiveRiskAnalyzer { depth(packageName: string, graph: Map<string, string[]>): number; }
export function createTransitiveRiskAnalyzer(): TransitiveRiskAnalyzer { return { depth: (name, graph) => graph.has(name) ? 1 + Math.max(0, ...(graph.get(name) ?? []).map((child) => graph.has(child) ? 1 : 0)) : 0 }; }
