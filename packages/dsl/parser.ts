// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Recursive-descent parser for the ARCLUX scripting language.
//
// Grammar (informal):
//   program    := statement*
//   statement  := let | if | for | fn | return | break | continue | expr
//   let        := "let" IDENT "=" expr
//   if         := "if" expr block ("else" block)?
//   for        := "for" IDENT "in" expr ("where" expr)? block
//   fn         := "fn" IDENT "(" IDENT* ")" block
//   block      := "{" statement* "}"
//   expr       := or
//   or         := and ("or" and)*
//   and        := not ("and" not)*
//   not        := ("not")? comparison
//   comparison := additive (("<"|">"|"<="|">="|"=="|"!=") additive)*
//   additive   := term (("+"|"-") term)*
//   term       := unary (("*"|"/"|"%") unary)*
//   unary      := ("-")? postfix
//   postfix    := primary (("." IDENT) | ("[" expr "]") | "(" args ")")*
//   primary    := literal | IDENT | list | object | "(" expr ")"
//   args       := expr ("," expr)*
//   list       := "[" expr ("," expr)* "]"
//   object     := "{" (IDENT ":" expr)* "}"

import { lex, type Token } from "./lexer";
import type { Node } from "./ast";

export class ParseError extends Error {
  constructor(
    message: string,
    readonly line: number,
    readonly column: number
  ) {
    super(message);
    this.name = "ParseError";
  }
}

export function parse(source: string): Node {
  const tokens = lex(source);
  const parser = new Parser(tokens);
  const program = parser.parseProgram();
  return program;
}

class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }

  private next(): Token {
    return this.tokens[this.pos++];
  }

  private expect(value: string): Token {
    const tok = this.peek();
    if (tok.value !== value) {
      throw new ParseError(
        `Expected "${value}" but found "${tok.value}"`,
        tok.line,
        tok.column
      );
    }
    return this.next();
  }

  private isKeyword(value: string): boolean {
    return this.peek().kind === "keyword" && this.peek().value === value;
  }

  parseProgram(): Node {
    const body: Node[] = [];
    while (this.peek().kind !== "eof") {
      body.push(this.parseStatement());
    }
    return { type: "Program", body };
  }

  private parseStatement(): Node {
    const tok = this.peek();

    if (tok.kind === "identifier" && this.peek(1).value === "=") {
      this.next();
      const name = tok.value;
      this.expect("=");
      const value = this.parseExpression();
      return { type: "Assign", name, value };
    }

    if (tok.kind === "keyword") {
      switch (tok.value) {
        case "let":
          return this.parseLet();
        case "if":
          return this.parseIf();
        case "for":
          return this.parseFor();
        case "while":
          return this.parseWhile();
        case "fn":
          return this.parseFn();
        case "return": {
          this.next();
          if (this.isStatementEnd()) return { type: "Return", value: null };
          return { type: "Return", value: this.parseExpression() };
        }
        case "break":
          this.next();
          return { type: "Break" };
        case "continue":
          this.next();
          return { type: "Continue" };
        case "true":
        case "false":
        case "null":
          return { type: "ExprStmt", expr: this.parseExpression() };
      }
    }

    return { type: "ExprStmt", expr: this.parseExpression() };
  }

  private isStatementEnd(): boolean {
    const tok = this.peek();
    return (
      tok.kind === "eof" ||
      (tok.kind === "keyword" &&
        ["let", "if", "for", "while", "fn", "return", "break", "continue"].includes(
          tok.value
        ))
    );
  }

  private parseLet(): Node {
    this.expect("let");
    const name = this.expectIdentifier();
    this.expect("=");
    const value = this.parseExpression();
    return { type: "Let", name, value };
  }

  private parseIf(): Node {
    this.expect("if");
    const test = this.parseExpression();
    const consequent = this.parseBlock();
    let alternate: Node[] | null = null;
    if (this.isKeyword("else")) {
      this.next();
      alternate = this.parseBlock();
    }
    return { type: "If", test, consequent, alternate };
  }

  private parseFor(): Node {
    this.expect("for");
    const name = this.expectIdentifier();
    this.expect("in");
    const iterable = this.parseExpression();
    let where: Node | null = null;
    if (this.isKeyword("where")) {
      this.next();
      where = this.parseExpression();
    }
    const body = this.parseBlock();
    return { type: "For", name, iterable, where, body };
  }

  private parseWhile(): Node {
    this.expect("while");
    const test = this.parseExpression();
    const body = this.parseBlock();
    return { type: "While", test, body };
  }

  private parseFn(): Node {
    this.expect("fn");
    const name = this.expectIdentifier();
    this.expect("(");
    const params: string[] = [];
    while (this.peek().value !== ")") {
      params.push(this.expectIdentifier());
      if (this.peek().value === ",") this.next();
    }
    this.expect(")");
    const body = this.parseBlock();
    return { type: "Fn", name, params, body };
  }

  private parseBlock(): Node[] {
    this.expect("{");
    const body: Node[] = [];
    while (this.peek().value !== "}") {
      if (this.peek().kind === "eof") {
        const tok = this.peek();
        throw new ParseError("Unterminated block, expected }", tok.line, tok.column);
      }
      body.push(this.parseStatement());
    }
    this.expect("}");
    return body;
  }

  private expectIdentifier(): string {
    const tok = this.peek();
    if (tok.kind !== "identifier") {
      throw new ParseError(
        `Expected identifier but found "${tok.value}"`,
        tok.line,
        tok.column
      );
    }
    return this.next().value;
  }

  private parseExpression(): Node {
    return this.parseOr();
  }

  private parseOr(): Node {
    let left = this.parseAnd();
    while (this.peek().value === "or") {
      this.next();
      left = { type: "Binary", op: "or", left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): Node {
    let left = this.parseNot();
    while (this.peek().value === "and") {
      this.next();
      left = { type: "Binary", op: "and", left, right: this.parseNot() };
    }
    return left;
  }

  private parseNot(): Node {
    if (this.peek().value === "not") {
      this.next();
      return { type: "Unary", op: "not", operand: this.parseNot() };
    }
    return this.parseComparison();
  }

  private parseComparison(): Node {
    let left = this.parseAdditive();
    while (["<", ">", "<=", ">=", "==", "!="].includes(this.peek().value)) {
      const op = this.next().value;
      left = { type: "Binary", op, left, right: this.parseAdditive() };
    }
    return left;
  }

  private parseAdditive(): Node {
    let left = this.parseTerm();
    while (["+", "-"].includes(this.peek().value)) {
      const op = this.next().value;
      left = { type: "Binary", op, left, right: this.parseTerm() };
    }
    return left;
  }

  private parseTerm(): Node {
    let left = this.parseUnary();
    while (["*", "/", "%"].includes(this.peek().value)) {
      const op = this.next().value;
      left = { type: "Binary", op, left, right: this.parseUnary() };
    }
    return left;
  }

  private parseUnary(): Node {
    if (this.peek().value === "-") {
      this.next();
      return { type: "Unary", op: "-", operand: this.parseUnary() };
    }
    if (this.peek().value === "!") {
      this.next();
      return { type: "Unary", op: "not", operand: this.parseUnary() };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Node {
    let expr = this.parsePrimary();
    for (;;) {
      if (this.peek().value === ".") {
        this.next();
        const property = this.expectIdentifier();
        expr = { type: "Member", object: expr, property };
      } else if (this.peek().value === "[") {
        this.next();
        const index = this.parseExpression();
        this.expect("]");
        expr = { type: "Index", object: expr, index };
      } else if (this.peek().value === "(") {
        this.next();
        const args: Node[] = [];
        while (this.peek().value !== ")") {
          args.push(this.parseExpression());
          if (this.peek().value === ",") this.next();
        }
        this.expect(")");
        expr = { type: "Call", callee: expr, args };
      } else {
        break;
      }
    }
    return expr;
  }

  private parsePrimary(): Node {
    const tok = this.peek();

    if (tok.kind === "number") {
      this.next();
      return { type: "Literal", value: parseFloat(tok.value) };
    }
    if (tok.kind === "string") {
      this.next();
      return { type: "Literal", value: unquote(tok.value) };
    }
    if (tok.kind === "identifier") {
      this.next();
      return { type: "Identifier", name: tok.value };
    }
    if (tok.kind === "keyword") {
      this.next();
      if (tok.value === "true") return { type: "Literal", value: true };
      if (tok.value === "false") return { type: "Literal", value: false };
      if (tok.value === "null") return { type: "Literal", value: null };
      throw new ParseError(`Unexpected keyword "${tok.value}"`, tok.line, tok.column);
    }
    if (tok.value === "[") {
      this.next();
      const elements: Node[] = [];
      while (this.peek().value !== "]") {
        elements.push(this.parseExpression());
        if (this.peek().value === ",") this.next();
      }
      this.expect("]");
      return { type: "List", elements };
    }
    if (tok.value === "{") {
      this.next();
      const properties: Array<{ key: string; value: Node }> = [];
      while (this.peek().value !== "}") {
        const key = this.expectIdentifier();
        this.expect(":");
        const value = this.parseExpression();
        properties.push({ key, value });
        if (this.peek().value === ",") this.next();
      }
      this.expect("}");
      return { type: "Object", properties };
    }
    if (tok.value === "(") {
      this.next();
      const expr = this.parseExpression();
      this.expect(")");
      return expr;
    }

    throw new ParseError(`Unexpected token "${tok.value}"`, tok.line, tok.column);
  }
}

function unquote(raw: string): string {
  const inner = raw.slice(1, -1);
  return inner
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\");
}