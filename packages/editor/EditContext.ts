feat/editor-layer
// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Repository } from "../repository/Repository";

export interface CursorPosition {
  line: number;
  column: number;
}

export interface EditSession {
  repository: Repository;
  activeModuleId: string;
  cursor: CursorPosition;
}

export function createEditSession(
  repository: Repository,
  activeModuleId: string,
  cursor: CursorPosition = { line: 1, column: 1 }
): EditSession {
  return { repository, activeModuleId, cursor };
}

export function moveCursor(session: EditSession, cursor: CursorPosition): EditSession {
  return { ...session, cursor };
}

export function switchFile(
  session: EditSession,
  moduleId: string,
  cursor: CursorPosition = { line: 1, column: 1 }
): EditSession {
  return { ...session, activeModuleId: moduleId, cursor };
}

/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

// Scaffold: editor/EditContext — not yet implemented.
ARCLUX.main
