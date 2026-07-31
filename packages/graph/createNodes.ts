import type { ModuleInfo, GraphNode } from "../shared/types";

export function createFileNode(module: ModuleInfo): GraphNode {
  return {
    id: module.id,
    type: "file",
    label: module.file.relativePath.split("/").pop() ?? module.id,
    filePath: module.file.relativePath,
    metadata: {
      language: module.file.language,
      exportCount: module.exports.length,
    },
  };
}

export function createExternalPackageNode(packageName: string): GraphNode {
  return {
    id: `external:${packageName}`,
    type: "external-package",
    label: packageName,
    metadata: { packageName },
  };
}

export function createNodes(
  modules: ModuleInfo[],
  externalPackages: Set<string>
): GraphNode[] {
  const nodes: GraphNode[] = modules.map(createFileNode);
  for (const pkg of externalPackages) {
    nodes.push(createExternalPackageNode(pkg));
  }
  return nodes;
}
