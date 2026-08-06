// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

// Thin re-export of GraphProvider's context hook. See
// progres/PROGRES-decisions.md (2026-08-03) for why this file exists as
// a re-export instead of its own store: GraphProvider.tsx already owns
// all graph state via React Context, and this just gives callers in
// features/graph/ a shorter import path without creating a second
// source of truth.

"use client";

export { useGraphContext as useGraph } from "@/components/graph/GraphProvider";
export type { GraphTransform, CanvasDimensions } from "@/components/graph/GraphProvider";
