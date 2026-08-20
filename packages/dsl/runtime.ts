// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Tree-walking runtime for the ARCLUX scripting language. The runtime
// itself knows NOTHING about repositories — every capability comes in
// through the bindings table (bindings.ts), which is built from the
// engine registries. That's what makes the language grow with ARCLUX:
// register a new parser or detector and the next script run picks it up.

import type { Node } from "./ast";

export type ArcluxValue =
  | number
  | string
  | boolean
  | null
  | ArcluxValue[]
  | Record<string, ArcluxValue>
  | ArcluxNativeFn
  | ArcluxScriptFn;

export interface ArcluxNativeFn {
  kind: "native";
  name: string;
  fn: (args: ArcluxValue[], ctx: RuntimeContext) => Promise<ArcluxValue>;
}

export interface ArcluxScriptFn {
  kind: "script";
  name: string;
  params: string[];
  body: Node[];
}

export interface RuntimeContext {
  stdout: (line: string) => void;
  /** User-defined print/log sink; CLI prints to console, daemon captures. */
  log: (level: string, message: string) => void;
  /** Per-run scratch state for bindings (e.g. last analyzed repo). */
  state: Map<string, unknown>;
}

export class RuntimeError extends Error {
  constructor(message: string, readonly line?: number, readonly column?: number) {
    super(message);
    this.name = "RuntimeError";
  }
}

export interface RuntimeOptions {
  stdout?: (line: string) => void;
  log?: (level: string, message: string) => void;
  maxIterations?: number;
}

export function runScript(
  program: Node,
  bindings: Record<string, ArcluxNativeFn>,
  options: RuntimeOptions = {}
): Promise<void> {
  const context: RuntimeContext = {
    stdout: options.stdout ?? ((line) => console.log(line)),
    log: options.log ?? ((_level, message) => console.log(message)),
    state: new Map(),
  };
  const interpreter = new Interpreter(context, bindings, options.maxIterations ?? 1000000);
  return interpreter.run(program);
}

class Interpreter {
  private scopes: Array<Map<string, ArcluxValue>> = [new Map()];
  private loopDepth = 0;
  private iterations = 0;

  constructor(
    private readonly context: RuntimeContext,
    private readonly bindings: Record<string, ArcluxNativeFn>,
    private readonly maxIterations: number
  ) {
    // Seed the top scope with the bindings so `analyze(...)` resolves.
    const top = this.scopes[0];
    for (const [name, fn] of Object.entries(bindings)) {
      top.set(name, fn);
    }
  }

  async run(program: Node): Promise<void> {
    try {
      await this.executeBlock(program.body);
    } catch (err) {
      if (err instanceof ControlSignal) return;
      throw err;
    }
  }

  private async executeBlock(body: Node[]): Promise<void> {
    for (const node of body) {
      await this.execute(node);
    }
  }

  private async execute(node: Node): Promise<ArcluxValue | undefined> {
    switch (node.type) {
      case "Program":
        await this.executeBlock(node.body);
        return undefined;
      case "Let": {
        const value = await this.evaluate(node.value);
        this.declare(node.name, value);
        return undefined;
      }
      case "Assign": {
        const value = await this.evaluate(node.value);
        this.assign(node.name, value);
        return undefined;
      }
      case "If": {
        const test = await this.evaluate(node.test);
        if (truthy(test)) {
          await this.executeBlock(node.consequent);
        } else if (node.alternate) {
          await this.executeBlock(node.alternate);
        }
        return undefined;
      }
      case "For": {
        const iterable = await this.evaluate(node.iterable);
        if (!Array.isArray(iterable)) {
          throw new RuntimeError(`Cannot iterate over ${typeof iterable}`);
        }
        this.loopDepth++;
        this.pushScope();
        try {
          for (const item of iterable) {
            if (node.where) {
              this.scopes[this.scopes.length - 1].set(node.name, item);
              const keep = await this.evaluate(node.where);
              if (!truthy(keep)) continue;
            }
            this.scopes[this.scopes.length - 1].set(node.name, item);
            await this.executeBlock(node.body);
          }
        } catch (err) {
          if (err instanceof ControlSignal && err.signal === "break") {
            // consumed
          } else if (err instanceof ControlSignal && err.signal === "continue") {
            // consumed
          } else {
            throw err;
          }
        } finally {
          this.popScope();
          this.loopDepth--;
        }
        return undefined;
      }
      case "While": {
        this.loopDepth++;
        this.pushScope();
        try {
          while (truthy(await this.evaluate(node.test))) {
            await this.executeBlock(node.body);
          }
        } catch (err) {
          if (err instanceof ControlSignal && err.signal === "break") {
            // consumed
          } else if (err instanceof ControlSignal && err.signal === "continue") {
            // consumed
          } else {
            throw err;
          }
        } finally {
          this.popScope();
          this.loopDepth--;
        }
        return undefined;
      }
      case "Fn": {
        const fn: ArcluxScriptFn = {
          kind: "script",
          name: node.name,
          params: node.params,
          body: node.body,
        };
        this.declare(node.name, fn);
        return undefined;
      }
      case "Return": {
        const value = node.value ? await this.evaluate(node.value) : null;
        throw new ControlSignal("return", value);
      }
      case "Break":
        throw new ControlSignal("break", null);
      case "Continue":
        throw new ControlSignal("continue", null);
      case "ExprStmt":
        return this.evaluate(node.expr);
    }
  }

  private async evaluate(node: Node): Promise<ArcluxValue> {
    this.iterations++;
    if (this.iterations > this.maxIterations) {
      throw new RuntimeError(`Script exceeded ${this.maxIterations} operations — possible infinite loop`);
    }

    switch (node.type) {
      case "Literal":
        return node.value;
      case "Identifier":
        return this.resolve(node.name);
      case "List":
        return Promise.all(node.elements.map((e) => this.evaluate(e)));
      case "Object": {
        const obj: Record<string, ArcluxValue> = {};
        for (const { key, value } of node.properties) {
          obj[key] = await this.evaluate(value);
        }
        return obj;
      }
      case "Unary": {
        const operand = await this.evaluate(node.operand);
        if (node.op === "-") {
          if (typeof operand !== "number") throw new RuntimeError(`Cannot negate ${typeof operand}`);
          return -operand;
        }
        if (node.op === "not") return !truthy(operand);
        throw new RuntimeError(`Unknown unary operator ${node.op}`);
      }
      case "Binary":
        return this.evaluateBinary(node.op, await this.evaluate(node.left), await this.evaluate(node.right));
      case "Member": {
        const obj = await this.evaluate(node.object);
        return getMember(obj, node.property);
      }
      case "Index": {
        const obj = await this.evaluate(node.object);
        const index = await this.evaluate(node.index);
        return getIndex(obj, index);
      }
      case "Call": {
        const callee = await this.evaluate(node.callee);
        const args = await Promise.all(node.args.map((a) => this.evaluate(a)));
        return this.call(callee, args);
      }
    }
    throw new RuntimeError(`Unknown node type: ${(node as { type: string }).type}`);
  }

  private async evaluateBinary(op: string, left: ArcluxValue, right: ArcluxValue): Promise<ArcluxValue> {
    switch (op) {
      case "+":
        if (typeof left === "number" && typeof right === "number") return left + right;
        return stringify(left) + stringify(right);
      case "-":
        return asNumber(left) - asNumber(right);
      case "*":
        return asNumber(left) * asNumber(right);
      case "/":
        return asNumber(left) / asNumber(right);
      case "%":
        return asNumber(left) % asNumber(right);
      case "==":
        return looseEquals(left, right);
      case "!=":
        return !looseEquals(left, right);
      case "<":
        return asNumber(left) < asNumber(right);
      case ">":
        return asNumber(left) > asNumber(right);
      case "<=":
        return asNumber(left) <= asNumber(right);
      case ">=":
        return asNumber(left) >= asNumber(right);
      case "and":
        return truthy(left) && truthy(right);
      case "or":
        return truthy(left) || truthy(right);
    }
    throw new RuntimeError(`Unknown operator ${op}`);
  }

  private async call(callee: ArcluxValue, args: ArcluxValue[]): Promise<ArcluxValue> {
    if (typeof callee === "object" && callee !== null && "kind" in callee) {
      if (callee.kind === "native") {
        return callee.fn(args, this.context);
      }
      if (callee.kind === "script") {
        if (args.length !== callee.params.length) {
          throw new RuntimeError(
            `Function ${callee.name} expects ${callee.params.length} args, got ${args.length}`
          );
        }
        this.pushScope();
        for (let i = 0; i < callee.params.length; i++) {
          this.scopes[this.scopes.length - 1].set(callee.params[i], args[i]);
        }
        try {
          await this.executeBlock(callee.body);
          return null;
        } catch (err) {
          if (err instanceof ControlSignal && err.signal === "return") {
            return err.value;
          }
          throw err;
        } finally {
          this.popScope();
        }
      }
    }
    if (typeof callee === "string") {
      // Reserved: could dispatch to a bound member function.
      throw new RuntimeError(`Cannot call value "${callee}"`);
    }
    throw new RuntimeError(`Cannot call ${typeof callee}`);
  }

  private declare(name: string, value: ArcluxValue): void {
    const scope = this.scopes[this.scopes.length - 1];
    if (scope.has(name)) {
      throw new RuntimeError(`Variable "${name}" already declared in this scope`);
    }
    scope.set(name, value);
  }

  private resolve(name: string): ArcluxValue {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const found = this.scopes[i].get(name);
      if (found !== undefined) return found;
    }
    throw new RuntimeError(`Undefined variable "${name}"`);
  }

  private assign(name: string, value: ArcluxValue): void {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (this.scopes[i].has(name)) {
        this.scopes[i].set(name, value);
        return;
      }
    }
    throw new RuntimeError(`Cannot assign to undeclared variable "${name}" — use let first`);
  }

  private pushScope(): void {
    this.scopes.push(new Map());
  }

  private popScope(): void {
    this.scopes.pop();
  }
}

class ControlSignal {
  constructor(
    readonly signal: "return" | "break" | "continue",
    readonly value: ArcluxValue
  ) {}
}

function truthy(value: ArcluxValue): boolean {
  if (value === null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function asNumber(value: ArcluxValue): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    if (!Number.isNaN(n)) return n;
  }
  throw new RuntimeError(`Expected number, got ${typeof value}`);
}

function looseEquals(a: ArcluxValue, b: ArcluxValue): boolean {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "string") return a === parseFloat(b);
  if (typeof a === "string" && typeof b === "number") return parseFloat(a) === b;
  if (typeof a === "boolean" && typeof b === "string") return a === (b === "true");
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => looseEquals(v, b[i]));
  }
  return false;
}

export function getMember(obj: ArcluxValue, property: string): ArcluxValue {
  if (obj === null || obj === undefined) {
    throw new RuntimeError(`Cannot read property "${property}" of null`);
  }
  if (typeof obj === "object" && !Array.isArray(obj) && "kind" in obj) {
    // native/script functions expose nothing by default
    throw new RuntimeError(`Cannot read property "${property}" of function`);
  }
  if (typeof obj === "object" || Array.isArray(obj)) {
    const record = obj as Record<string, ArcluxValue>;
    if (property in record) return record[property];
    if (Array.isArray(obj)) {
      if (property === "length") return obj.length;
    }
    throw new RuntimeError(`No property "${property}"`);
  }
  if (typeof obj === "string") {
    const strObj = obj as unknown as Record<string, ArcluxValue>;
    if (property === "length") return (obj as string).length;
    if (property in strObj) return (strObj as unknown as Record<string, ArcluxValue>)[property];
    throw new RuntimeError(`No property "${property}" on string`);
  }
  throw new RuntimeError(`Cannot read property "${property}" of ${typeof obj}`);
}

function getIndex(obj: ArcluxValue, index: ArcluxValue): ArcluxValue {
  if (Array.isArray(obj)) {
    if (typeof index !== "number") throw new RuntimeError("List index must be a number");
    const i = index < 0 ? obj.length + index : index;
    if (i < 0 || i >= obj.length) throw new RuntimeError(`Index ${index} out of bounds (length ${obj.length})`);
    return obj[i];
  }
  if (typeof obj === "object" && obj !== null) {
    return (obj as Record<string, ArcluxValue>)[stringify(index)];
  }
  if (typeof obj === "string" && typeof index === "number") {
    return (obj as string)[index] ?? "";
  }
  throw new RuntimeError(`Cannot index ${typeof obj}`);
}

export function stringify(value: ArcluxValue): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map(stringify).join(", ")}]`;
  if (typeof value === "object" && "kind" in value) {
    const fn = value as ArcluxNativeFn | ArcluxScriptFn;
    return `<fn ${fn.name}>`;
  }
  const entries = Object.entries(value as Record<string, ArcluxValue>)
    .map(([k, v]) => `${k}: ${stringify(v)}`)
    .join(", ");
  return `{ ${entries} }`;
}