// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Repository } from "../repository/Repository";
import { calculateAffectedFiles } from "./calculateAffectedFiles";

export interface AffectedWorkspacePackage {
  packageId: string;
  fileCount: number;
  filePaths: string[];
}

export function calculateAffectedModules(repository: Repository, moduleId: string): AffectedWorkspacePackage[] {
  const impact = calculateAffectedFiles(repository, moduleId);
  const grouped = new Map<string, string[]>();

  for (const file of impact.affectedFiles) {
    const segments = file.filePath.split("/");
    const packageId = segments.length >= 2 ? segments.slice(0, 2).join("/") : (segments[0] ?? file.filePath);

    const list = grouped.get(packageId) ?? [];
    list.push(file.filePath);
    grouped.set(packageId, list);
  }

  return Array.from(grouped.entries())
    .map(([packageId, filePaths]) => ({ packageId, fileCount: filePaths.length, filePaths }))
    .sort((a, b) => b.fileCount - a.fileCount);
}
