
// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Repository } from "../repository/Repository";
import { getSymbolsAtLine, type SymbolInfo } from "./SymbolProvider";

export interface LineContextResult {
  moduleId: string;
  line: number;
  symbols: SymbolInfo[];
  hasParserWarning: boolean;
}

export function getLineContext(repository: Repository, moduleId: string, line: number): LineContextResult {
  return {
    moduleId,
    line,
    symbols: getSymbolsAtLine(repository, moduleId, line),
    hasParserWarning: false,
  };
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

