// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// The ARCLUX scripting language: a tiny tree-walking interpreter whose
// builtins are auto-discovered from the engine registries — add a parser
// or detector and the language grows with it, no grammar edits needed.
//
// The language is deliberately small: values, lists, objects, functions,
// if/for, and calls. Everything "big" lives in the engine (analyze,
// doctor, impact, graph, search, security) and is bound into the runtime
// via the registry-driven bindings table (see bindings.ts).

export * from "./lexer";
export * from "./parser";
export * from "./runtime";
export * from "./bindings";
export * from "./script";