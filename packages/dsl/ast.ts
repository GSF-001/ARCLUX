// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// AST for the ARCLUX scripting language. Node shapes are deliberately
// simple (discriminated unions) so the tree-walking runtime stays small.

export type Node =
  | ProgramNode
  | LetNode
  | AssignNode
  | IfNode
  | ForNode
  | WhileNode
  | FnNode
  | ReturnNode
  | BreakNode
  | ContinueNode
  | ExprStmtNode
  | LiteralNode
  | IdentifierNode
  | CallNode
  | MemberNode
  | IndexNode
  | BinaryNode
  | UnaryNode
  | ListNode
  | ObjectNode;

export interface ProgramNode {
  type: "Program";
  body: Node[];
}

export interface LetNode {
  type: "Let";
  name: string;
  value: Node;
}

export interface AssignNode {
  type: "Assign";
  name: string;
  value: Node;
}

export interface IfNode {
  type: "If";
  test: Node;
  consequent: Node[];
  alternate: Node[] | null;
}

export interface ForNode {
  type: "For";
  name: string;
  iterable: Node;
  where: Node | null;
  body: Node[];
}

export interface WhileNode {
  type: "While";
  test: Node;
  body: Node[];
}

export interface FnNode {
  type: "Fn";
  name: string;
  params: string[];
  body: Node[];
}

export interface ReturnNode {
  type: "Return";
  value: Node | null;
}

export interface BreakNode {
  type: "Break";
}

export interface ContinueNode {
  type: "Continue";
}

export interface ExprStmtNode {
  type: "ExprStmt";
  expr: Node;
}

export interface LiteralNode {
  type: "Literal";
  value: number | string | boolean | null;
}

export interface IdentifierNode {
  type: "Identifier";
  name: string;
}

export interface CallNode {
  type: "Call";
  callee: Node;
  args: Node[];
}

export interface MemberNode {
  type: "Member";
  object: Node;
  property: string;
}

export interface IndexNode {
  type: "Index";
  object: Node;
  index: Node;
}

export interface BinaryNode {
  type: "Binary";
  op: string;
  left: Node;
  right: Node;
}

export interface UnaryNode {
  type: "Unary";
  op: string;
  operand: Node;
}

export interface ListNode {
  type: "List";
  elements: Node[];
}

export interface ObjectNode {
  type: "Object";
  properties: Array<{ key: string; value: Node }>;
}