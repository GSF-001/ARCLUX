// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

// Deliberately left empty. GraphProvider.tsx (components/graph/) already
// owns all graph state (transform, positions, dimensions, selection) via
// React Context. Do NOT implement a separate store/hooks layer here --
// it would create two sources of truth for the same state. See
// progres/PROGRES-decisions.md (2026-08-03) for the full reasoning.
// If you need graph state in features/graph/, import useGraph from
// ./useGraph.ts instead.
