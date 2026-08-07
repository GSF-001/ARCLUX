// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// INTENTIONALLY EMPTY (for now) — likely planned as a shared/generic
// import-extraction helper, but every language parser (parseGo.ts,
// parseJava.ts, extractJs.ts, parsePython.ts, parseTs.ts) implements its
// own extractImports() independently instead, since each language's
// import syntax is different enough (Go's quoted paths, Java's dotted
// package names, Python's tree-sitter AST, JS/TS's Compiler API) that a
// meaningfully generic shared implementation isn't obviously possible.
// Not confirmed dead — if a genuinely shared cross-language extraction
// pattern emerges later, it could live here. Do not write speculative
// generic code here without a concrete use case driving it.
