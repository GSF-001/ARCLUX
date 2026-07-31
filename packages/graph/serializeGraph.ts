import type { DependencyGraph } from "../shared/types";

export interface SerializedGraph {
  repositoryId: string;
  builtAt: string;
  nodeCount: number;
  edgeCount: number;
  nodes: DependencyGraph["nodes"];
  edges: DependencyGraph["edges"];
}

export function serializeGraph(graph: DependencyGraph): SerializedGraph {
  return {
    repositoryId: graph.repositoryId,
    builtAt: graph.builtAt,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    nodes: graph.nodes,
    edges: graph.edges,
  };
}

export function deserializeGraph(serialized: SerializedGraph): DependencyGraph {
  return {
    repositoryId: serialized.repositoryId,
    builtAt: serialized.builtAt,
    nodes: serialized.nodes,
    edges: serialized.edges,
  };
}
