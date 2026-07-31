// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { posix } from "node:path";
import type { GraphNode, ModuleInfo, FolderInfo, ExternalDependency, GraphNodeType } from "../shared/types";

export function createFileNode(module: ModuleInfo): GraphNode {
  return {
    id: module.id,
    type: "file",
    label: posix.basename(module.file.relativePath),
    filePath: module.file.relativePath,
    metadata: { language: module.file.language, exportCount: module.exports.length },
  };
}

export function createFolderNode(folder: FolderInfo): GraphNode {
  return {
    id: `folder:${folder.path}`,
    type: "folder",
    label: folder.name,
    filePath: folder.path,
    metadata: { fileCount: folder.fileIds.length },
  };
}

export function createExternalPackageNode(dependency: ExternalDependency): GraphNode {
  return {
    id: `package:${dependency.packageName}`,
    type: "external-package",
    label: dependency.packageName,
    metadata: { importCount: dependency.importCount },
  };
}

export function isNodeType(node: GraphNode, type: GraphNodeType): boolean {
  return node.type === type;
}
