import type { GraphEdge, GraphEdgeType } from "../shared/types";

function makeEdgeId(source: string, target: string, type: GraphEdgeType): string {
  return `${source}--${type}-->${target}`;
}

export function createImportEdge(source: string, target: string): GraphEdge {
  return { id: makeEdgeId(source, target, "import"), source, target, type: "import" };
}

export function createExportEdge(source: string, target: string): GraphEdge {
  return { id: makeEdgeId(source, target, "export"), source, target, type: "export" };
}

export function createCallEdge(source: string, target: string, weight?: number): GraphEdge {
  return { id: makeEdgeId(source, target, "call"), source, target, type: "call", weight };
}

export function createRouteLinkEdge(source: string, target: string): GraphEdge {
  return { id: makeEdgeId(source, target, "route-link"), source, target, type: "route-link" };
}
