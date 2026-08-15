// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Shared between highlightPython.ts and highlightJs.ts so both use the
// exact same token shape/type union instead of two copies drifting apart.

export type SyntaxTokenType =
  | "comment"
  | "keyword"
  | "string"
  | "variable"
  | "property"
  | "type"
  | "constant"
  | "operator"
  | "punctuation";

export interface HighlightToken {
  startIndex: number;
  endIndex: number;
  text: string;
  tokenType: SyntaxTokenType;
}
