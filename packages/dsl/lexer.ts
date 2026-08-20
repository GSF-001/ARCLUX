// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Lexer for the ARCLUX scripting language. Token kinds cover the whole
// language surface: literals, identifiers, keywords, operators, and the
// `where` filter keyword used by for-loops.

export type TokenKind =
  | "number"
  | "string"
  | "identifier"
  | "keyword"
  | "operator"
  | "eof";

export interface Token {
  kind: TokenKind;
  value: string;
  line: number;
  column: number;
}

const KEYWORDS = new Set([
  "let",
  "if",
  "else",
  "for",
  "while",
  "in",
  "where",
  "fn",
  "return",
  "true",
  "false",
  "null",
  "and",
  "or",
  "not",
  "break",
  "continue",
]);

const OPERATORS = new Set([
  "+",
  "-",
  "*",
  "/",
  "%",
  "==",
  "!=",
  "<",
  ">",
  "<=",
  ">=",
  "=",
  ".",
  ",",
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  "!",
  "+=",
]);

export class LexError extends Error {
  constructor(message: string, readonly line: number, readonly column: number) {
    super(message);
    this.name = "LexError";
  }
}

export function lex(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let column = 1;

  const push = (kind: TokenKind, value: string, startCol: number) => {
    tokens.push({ kind, value, line, column: startCol });
  };

  while (i < source.length) {
    const ch = source[i];

    if (ch === "\n") {
      line++;
      column = 1;
      i++;
      continue;
    }
    if (ch === " " || ch === "\t" || ch === "\r") {
      i++;
      column++;
      continue;
    }
    if (ch === "#") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }

    const startCol = column;

    if (ch >= "0" && ch <= "9") {
      let j = i;
      while (j < source.length && /[0-9.]/.test(source[j])) j++;
      push("number", source.slice(i, j), startCol);
      column += j - i;
      i = j;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let escaped = false;
      while (j < source.length) {
        const c = source[j];
        if (escaped) {
          escaped = false;
        } else if (c === "\\") {
          escaped = true;
        } else if (c === quote) {
          break;
        }
        j++;
      }
      if (j >= source.length) {
        throw new LexError("Unterminated string literal", line, startCol);
      }
      push("string", source.slice(i, j + 1), startCol);
      column += j + 1 - i;
      i = j + 1;
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < source.length && /[a-zA-Z0-9_]/.test(source[j])) j++;
      const word = source.slice(i, j);
      push(KEYWORDS.has(word) ? "keyword" : "identifier", word, startCol);
      column += j - i;
      i = j;
      continue;
    }

    let matched = false;
    for (const op of ["==", "!=", "<=", ">=", "+="]) {
      if (source.startsWith(op, i)) {
        push("operator", op, startCol);
        i += op.length;
        column += op.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    if (OPERATORS.has(ch)) {
      push("operator", ch, startCol);
      i++;
      column++;
      continue;
    }

    throw new LexError(`Unexpected character "${ch}"`, line, startCol);
  }

  tokens.push({ kind: "eof", value: "", line, column });
  return tokens;
}