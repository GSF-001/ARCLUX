feat/editor-layer

feat/diagnostics-layer
ARCLUX.main
// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Pattern borrowed from how linters (e.g. ESLint's report-translator)
// normalize findings with wildly different native shapes into one
// consistent location shape. ARCLUX detectors are NOT uniform --
// detectCircularDependency has no line info at all, detectDeadCode has
// file but no line, detectAmbiguousSymbolResolution has real line info.
// Rather than fake a line number for the first two, locationPrecision
// says honestly whether `line` is real (from source) or a "file" level
// fallback (line: 1, meaning "this file", not "this exact line").

export interface ErrorLocation {
  moduleId: string;
  filePath: string;
  line: number;
  locationPrecision: "line" | "file";
}

export function fileLevelLocation(moduleId: string, filePath: string): ErrorLocation {
  return { moduleId, filePath, line: 1, locationPrecision: "file" };
}

export function preciseLocation(moduleId: string, filePath: string, line: number): ErrorLocation {
  return { moduleId, filePath, line, locationPrecision: "line" };
}
feat/editor-layer


/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

// Scaffold: diagnostics/ErrorLocation — not yet implemented.
 ARCLUX.main
ARCLUX.main
