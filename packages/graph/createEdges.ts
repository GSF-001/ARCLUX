import type { ModuleInfo, GraphEdge } from "../shared/types";

export function createImportEdges(modules: ModuleInfo[], knownModuleIds: Set<string>): GraphEdge[] {
  const edges: GraphEdge[] = [];

  for (const module of modules) {
    for (const importedId of module.imports) {
      if (!knownModuleIds.has(importedId)) continue;
      edges.push({
        id: `${module.id}->${importedId}`,
        source: module.id,
        target: importedId,
        type: "import",
      });
    }
  }

  return edges;
}

export function createExternalEdges(
  modules: ModuleInfo[],
  resolveExternal: (module: ModuleInfo) => string[]
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  for (const module of modules) {
    for (const packageName of resolveExternal(module)) {
      const targetId = `external:${packageName}`;
      const edgeId = `${module.id}->${targetId}`;
      if (seen.has(edgeId)) continue;
      seen.add(edgeId);
      edges.push({ id: edgeId, source: module.id, target: targetId, type: "import" });
    }
  }

  return edges;
}
