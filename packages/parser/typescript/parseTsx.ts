// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// INTENTIONALLY EMPTY — superseded by packages/parser/typescript/parseTs.ts,
// which already handles .tsx via ts.ScriptKind.TSX (see its `extensions`
// field and ScriptKind selection logic). Do not implement a separate
// parser here; it would duplicate parseTs.ts's logic and risk drifting
// out of sync with it.
