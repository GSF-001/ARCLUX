// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Repository } from "../repository/Repository";
import { calculateAffectedFiles, type AffectedFile } from "./calculateAffectedFiles";

const ROUTE_FILE_PATTERN = /(^|\/)(page|route)\.(tsx|jsx|ts|js)$/;

export interface AffectedRoute extends AffectedFile {
  routePath: string;
}

function filePathToRoute(filePath: string): string {
  const appIndex = filePath.indexOf("app/");
  const withinApp = appIndex === -1 ? filePath : filePath.slice(appIndex + "app/".length);

  const withoutFile = withinApp.replace(ROUTE_FILE_PATTERN, "");
  const segments = withoutFile
    .split("/")
    .filter((seg) => seg && !(seg.startsWith("(") && seg.endsWith(")")));

  return "/" + segments.join("/");
}

export function calculateAffectedRoutes(repository: Repository, moduleId: string): AffectedRoute[] {
  const impact = calculateAffectedFiles(repository, moduleId);

  return impact.affectedFiles
    .filter((f) => ROUTE_FILE_PATTERN.test(f.filePath))
    .map((f) => ({ ...f, routePath: filePathToRoute(f.filePath) }));
}
