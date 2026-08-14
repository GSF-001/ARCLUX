/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

// Code formatting (issue #348). Honest scope: ARCLUX has NO full formatter
// dependency (no prettier in package.json), and hand-rolling a language-
// accurate formatter is out of scope for this package. What this engine
// DOES provide is the normalization every format-on-save wants regardless
// of language — line endings, trailing whitespace, final newline — plus a
// per-line leading-whitespace normalization that preserves structure
// (replaces tab runs with spaces at configurable width). Language-aware
// pretty-printing belongs in a dedicated formatter dependency, not here.

export interface FormattingOptions {
  /** Spaces per tab level. Default 2. */
  tabWidth?: number;
  /** Use tabs instead of spaces for indentation. Default false. */
  useTabs?: boolean;
  /** Ensure the file ends with exactly one newline. Default true. */
  ensureFinalNewline?: boolean;
  /** Strip trailing whitespace on every line. Default true. */
  stripTrailingWhitespace?: boolean;
  /** Normalize CRLF → LF. Default true. */
  normalizeLineEndings?: boolean;
}

export class FormattingEngine {
  format(source: string, options: FormattingOptions = {}): string {
    const tabWidth = options.tabWidth ?? 2;
    const useTabs = options.useTabs ?? false;
    const ensureFinalNewline = options.ensureFinalNewline ?? true;
    const stripTrailing = options.stripTrailingWhitespace ?? true;
    const normalizeEndings = options.normalizeLineEndings ?? true;

    let text = source;
    if (normalizeEndings) text = text.replace(/\r\n/g, "\n");

    if (stripTrailing) {
      text = text.replace(/[ \t]+$/gm, "");
    }

    // Normalize leading whitespace: expand tabs to tabWidth spaces, then
    // (if useTabs) collapse back to tabs. This makes mixed-indentation
    // files consistent without rewriting code.
    const lines = text.split("\n").map((line) => {
      const leading = line.match(/^[ \t]*/)?.[0] ?? "";
      const rest = line.slice(leading.length);
      const expanded = leading.replace(/\t/g, " ".repeat(tabWidth));
      if (useTabs) {
        const tabs = Math.floor(expanded.length / tabWidth);
        const remainder = expanded.length % tabWidth;
        return "\t".repeat(tabs) + " ".repeat(remainder) + rest;
      }
      return expanded + rest;
    });
    text = lines.join("\n");

    if (ensureFinalNewline && text.length > 0 && !text.endsWith("\n")) {
      text += "\n";
    }
    if (ensureFinalNewline) {
      text = text.replace(/\n+$/, "\n");
    }

    return text;
  }
}
