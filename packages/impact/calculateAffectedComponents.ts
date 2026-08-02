// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Repository } from "../repository/Repository";
import { calculateAffectedFiles, type AffectedFile } from "./calculateAffectedFiles";

const COMPONENT_EXTENSIONS = [".tsx", ".jsx"];

function isLikelyComponentFile(filePath: string): boolean {
  const hasComponentExt = COMPONENT_EXTENSIONS.some((ext) => filePath.endsWith(ext));
  if (!hasComponentExt) return false;

  const filename = filePath.split("/").pop() ?? "";
  const baseName = filename.replace(/\.(tsx|jsx)$/, "");
  return /^[A-Z]/.test(baseName);
}

export function calculateAffectedComponents(repository: Repository, moduleId: string): AffectedFile[] {
  const impact = calculateAffectedFiles(repository, moduleId);
  return impact.affectedFiles.filter((f) => isLikelyComponentFile(f.filePath));
}
