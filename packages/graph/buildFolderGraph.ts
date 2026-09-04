// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { hierarchy, type HierarchyNode } from "d3-hierarchy";
import type { Repository } from "../repository/Repository";
import type { FolderInfo } from "../shared/types";

export type TreeNodeType = "folder" | "file";

export interface FileTreeNode {
  name: string;
  path: string;
  type: TreeNodeType;
  children?: FileTreeNode[];
}

function buildFileTree(relativePaths: string[]): FileTreeNode {
  const root: FileTreeNode = { name: "", path: "", type: "folder", children: [] };

  for (const relativePath of relativePaths) {
    const segments = relativePath.split("/").filter(Boolean);
    let current = root;
    let currentPath = "";

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isLastSegment = i === segments.length - 1;
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;

      if (!current.children) current.children = [];

      let child = current.children.find((c) => c.name === segment);
      if (!child) {
        child = {
          name: segment,
          path: currentPath,
          type: isLastSegment ? "file" : "folder",
          children: isLastSegment ? undefined : [],
        };
        current.children.push(child);
      }

      current = child;
    }
  }

  return root;
}

export interface FolderGraphResult {
  tree: FileTreeNode;
  hierarchyRoot: HierarchyNode<FileTreeNode>;
  folders: FolderInfo[];
}

/**
 * JSON-safe view of a FolderGraphResult for API/MCP responses.
 *
 * BUG-1 fix: HierarchyNode carries `parent` pointers (d3-hierarchy decorates
 * on construction), so JSON.stringify(hierarchyRoot) throws "Converting
 * circular structure to JSON" — which killed the folder_graph MCP tool on
 * every repo. The hierarchy is a compute aid, not a transfer shape: callers
 * that need depth/counts read them from `stats` (derived via traversal,
 * never serialized). Web consumers keep using `.tree` directly.
 */
export interface FolderGraphJSON {
  tree: FileTreeNode;
  folders: FolderInfo[];
  stats: {
    /** Max depth below root (hierarchyRoot.height). */
    depth: number;
    /** Total tree nodes (folders + files). */
    nodeCount: number;
    fileCount: number;
    folderCount: number;
  };
}

export function folderGraphToJSON(result: FolderGraphResult): FolderGraphJSON {
  let nodeCount = 0;
  let fileCount = 0;
  let folderCount = 0;
  result.hierarchyRoot.each((node) => {
    nodeCount += 1;
    if (node.data.type === "file") fileCount += 1;
    else folderCount += 1;
  });
  return {
    tree: result.tree,
    folders: result.folders,
    stats: { depth: result.hierarchyRoot.height, nodeCount, fileCount, folderCount },
  };
}

export function buildFolderGraph(repository: Repository): FolderGraphResult {
  const relativePaths = repository.getAllModules().map((m) => m.file.relativePath);
  const tree = buildFileTree(relativePaths);
  const hierarchyRoot = hierarchy<FileTreeNode>(tree, (node) => node.children);

  const folders: FolderInfo[] = [];
  hierarchyRoot.each((node) => {
    if (node.data.type !== "folder") return;

    const fileIds: string[] = [];
    const childFolderPaths: string[] = [];

    for (const child of node.data.children ?? []) {
      if (child.type === "file") fileIds.push(child.path);
      else childFolderPaths.push(child.path);
    }

    folders.push({
      path: node.data.path,
      name: node.data.name,
      fileIds,
      childFolderPaths,
    });
  });

  return { tree, hierarchyRoot, folders };
}
