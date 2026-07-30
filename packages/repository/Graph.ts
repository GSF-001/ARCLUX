import type { DependencyGraph, GraphNode, GraphEdge } from "../shared/types";

/**
 * Wrapper around the raw DependencyGraph data with query helpers.
 * packages/graph/*.ts BUILDS a DependencyGraph; this class is for CONSUMING one
 * (impact analysis, detectors, UI serialization).
 */
export class Graph {
  private nodesById: Map<string, GraphNode> = new Map();
  private outgoing: Map<string, GraphEdge[]> = new Map();
  private incoming: Map<string, GraphEdge[]> = new Map();
  readonly repositoryId: string;
  readonly builtAt: string;

  constructor(data: DependencyGraph) {
    this.repositoryId = data.repositoryId;
    this.builtAt = data.builtAt;

    for (const node of data.nodes) {
      this.nodesById.set(node.id, node);
    }
    for (const edge of data.edges) {
      this.pushToMap(this.outgoing, edge.source, edge);
      this.pushToMap(this.incoming, edge.target, edge);
    }
  }

  private pushToMap(map: Map<string, GraphEdge[]>, key: string, edge: GraphEdge) {
    const list = map.get(key) ?? [];
    list.push(edge);
    map.set(key, list);
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodesById.get(id);
  }

  getOutgoingEdges(nodeId: string): GraphEdge[] {
    return this.outgoing.get(nodeId) ?? [];
  }

  getIncomingEdges(nodeId: string): GraphEdge[] {
    return this.incoming.get(nodeId) ?? [];
  }

  /** Direct dependents of a node (used by impact analysis) */
  getDirectConsumers(nodeId: string): GraphNode[] {
    return this.getIncomingEdges(nodeId)
      .map((e) => this.getNode(e.source))
      .filter((n): n is GraphNode => Boolean(n));
  }

  /** BFS traversal to find all transitive consumers up to a depth limit (guards against huge graphs) */
  getTransitiveConsumers(nodeId: string, maxDepth = 20): GraphNode[] {
    const visited = new Set<string>([nodeId]);
    const result: GraphNode[] = [];
    let frontier = [nodeId];
    let depth = 0;

    while (frontier.length > 0 && depth < maxDepth) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const consumer of this.getDirectConsumers(id)) {
          if (!visited.has(consumer.id)) {
            visited.add(consumer.id);
            result.push(consumer);
            next.push(consumer.id);
          }
        }
      }
      frontier = next;
      depth++;
    }
    return result;
  }

  toJSON(): DependencyGraph {
    return {
      repositoryId: this.repositoryId,
      builtAt: this.builtAt,
      nodes: Array.from(this.nodesById.values()),
      edges: [...this.outgoing.values()].flat(),
    };
  }
}
