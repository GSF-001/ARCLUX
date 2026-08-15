// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import ts from "typescript";
import type { RawImport, RawExport, ImportKind, RawCall } from "../../shared/types";

// Shared by parseJs.ts, parseJsx.ts, parseCommonJs.ts. Deliberately NOT
// reusing packages/parser/typescript/parseTs.ts's extractImports/
// extractExports -- the TS version detects TS-only syntax ("import type",
// interfaces) that plain JS/CJS files can never actually have. Reusing it
// would silently overclaim features these files don't support. The two
// implementations share structure on purpose (easier to compare/audit
// side by side) but are kept as separate functions.

function getLine(sourceFile: ts.SourceFile, pos: number): number {
  return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
}

export function extractImportsJs(sourceFile: ts.SourceFile): RawImport[] {
  const imports: RawImport[] = [];

  function visit(node: ts.Node) {
    // Static: import x, { y } from "z"
    // (No "import type" here -- that's TS-only syntax, plain JS can't have it.)
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const namedImports: string[] = [];
      let hasDefaultImport = false;
      let hasNamespaceImport = false;
      const kind: ImportKind = "static";

      if (node.importClause) {
        if (node.importClause.name) hasDefaultImport = true;
        const bindings = node.importClause.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
          for (const el of bindings.elements) {
            namedImports.push(el.name.text);
          }
        } else if (bindings && ts.isNamespaceImport(bindings)) {
          hasNamespaceImport = true;
        }
      }

      imports.push({
        source: node.moduleSpecifier.text,
        kind,
        namedImports,
        hasDefaultImport,
        hasNamespaceImport,
        line: getLine(sourceFile, node.getStart()),
      });
    }

    // Dynamic: await import("z")
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      imports.push({
        source: node.arguments[0].text,
        kind: "dynamic",
        namedImports: [],
        hasDefaultImport: false,
        hasNamespaceImport: false,
        line: getLine(sourceFile, node.getStart()),
      });
    }

    // require("z")
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      imports.push({
        source: node.arguments[0].text,
        kind: "require",
        namedImports: [],
        hasDefaultImport: false,
        hasNamespaceImport: false,
        line: getLine(sourceFile, node.getStart()),
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}

/**
 * Recognizes `module.exports.NAME = ...` and `exports.NAME = ...`
 * (per-property CommonJS assignment). Deliberately does NOT handle
 * whole-object exports (`module.exports = { a, b }`) -- that's a known
 * gap, tracked as follow-up work (see PROGRES.md). Real-world CommonJS
 * uses whole-object assignment extremely often, so this alone
 * under-reports exports for many packages until that follow-up lands.
 */
function matchCommonJsExportTarget(expr: ts.Expression): string | null {
  // exports.NAME
  if (
    ts.isPropertyAccessExpression(expr) &&
    ts.isIdentifier(expr.expression) &&
    expr.expression.text === "exports"
  ) {
    return expr.name.text;
  }

  // module.exports.NAME
  if (
    ts.isPropertyAccessExpression(expr) &&
    ts.isPropertyAccessExpression(expr.expression) &&
    ts.isIdentifier(expr.expression.expression) &&
    expr.expression.expression.text === "module" &&
    expr.expression.name.text === "exports"
  ) {
    return expr.name.text;
  }

  return null;
}

/**
 * Matches a bare whole-object CommonJS export target: the left-hand side
 * of `module.exports = { … }` / `exports = { … }` (as opposed to the
 * per-property `module.exports.NAME = …` handled by
 * matchCommonJsExportTarget above).
 */
function isBareModuleExports(expr: ts.Expression): boolean {
  // exports = { … }
  if (ts.isIdentifier(expr) && expr.text === "exports") return true;
  // module.exports = { … }
  return (
    ts.isPropertyAccessExpression(expr) &&
    ts.isIdentifier(expr.expression) &&
    expr.expression.text === "module" &&
    expr.name.text === "exports"
  );
}

/**
 * Extracts the exported name from one property of a whole-object export
 * (`module.exports = { a, b }`). Returns null for members that carry no
 * export name (spread `...rest`) or whose key cannot be statically
 * determined (computed `[key]: value`).
 */
function getObjectLiteralExportName(
  prop: ts.ObjectLiteralElement,
  sourceFile: ts.SourceFile
): string | null {
  if (ts.isSpreadAssignment(prop)) return null;

  if (ts.isShorthandPropertyAssignment(prop)) {
    return prop.name.text; // { a } -> "a"
  }

  if (ts.isPropertyAssignment(prop)) {
    // { foo: foo } / { foo: renamed } / { "foo-bar": x } -> the KEY
    if (
      ts.isIdentifier(prop.name) ||
      ts.isStringLiteral(prop.name) ||
      ts.isNumericLiteral(prop.name)
    ) {
      return prop.name.text;
    }
    return null; // computed key [expr]: value
  }

  if (
    ts.isMethodDeclaration(prop) ||
    ts.isGetAccessorDeclaration(prop) ||
    ts.isSetAccessorDeclaration(prop)
  ) {
    // { foo() {} } / { get foo() {} } — only statically-named methods
    if (
      ts.isIdentifier(prop.name) ||
      ts.isStringLiteral(prop.name) ||
      ts.isNumericLiteral(prop.name)
    ) {
      return prop.name.text;
    }
    return null;
  }

  return null;
}

export function extractExportsJs(sourceFile: ts.SourceFile): RawExport[] {
  const exports: RawExport[] = [];

  function visit(node: ts.Node) {
    // export default ...
    const isDefaultExport =
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);

    if (isDefaultExport) {
      exports.push({
        name: (node as ts.FunctionDeclaration | ts.ClassDeclaration).name?.text ?? "default",
        kind: "default",
        line: getLine(sourceFile, node.getStart()),
      });
    }

    // See parseTs.ts's identical guard for why !isDefaultExport matters:
    // "export default function X()" carries both Default and Export
    // modifiers on the same node, so without this it gets double-counted.
    const hasExportModifier =
      !isDefaultExport &&
      (node as ts.Node & { modifiers?: ts.NodeArray<ts.ModifierLike> })
        .modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

    if (hasExportModifier) {
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            exports.push({
              name: decl.name.text,
              kind: "named",
              line: getLine(sourceFile, node.getStart()),
            });
          }
        }
      } else if (
        (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
        node.name
      ) {
        exports.push({
          name: node.name.text,
          kind: "named",
          line: getLine(sourceFile, node.getStart()),
        });
      }
    }

    // export { a, b } from "./x"  /  export * from "./x"
    if (ts.isExportDeclaration(node)) {
      const reExportSource =
        node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
          ? node.moduleSpecifier.text
          : undefined;

      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const el of node.exportClause.elements) {
          exports.push({
            name: el.name.text,
            kind: reExportSource ? "re-export" : "named",
            reExportSource,
            line: getLine(sourceFile, node.getStart()),
          });
        }
      } else if (reExportSource) {
        exports.push({
          name: "*",
          kind: "re-export",
          reExportSource,
          line: getLine(sourceFile, node.getStart()),
        });
      }
    }

    // CommonJS: module.exports.NAME = ... / exports.NAME = ...
    if (
      ts.isExpressionStatement(node) &&
      ts.isBinaryExpression(node.expression) &&
      node.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      const target = matchCommonJsExportTarget(node.expression.left);
      if (target !== null) {
        exports.push({
          name: target,
          kind: "named",
          line: getLine(sourceFile, node.getStart()),
        });
      } else if (
        // Whole-object assignment: `module.exports = { a, b }` /
        // `exports = { a }`. Every property of the object literal becomes
        // a named export. Closes the long-standing gap noted in the
        // matchCommonJsExportTarget doc comment (issue #430).
        isBareModuleExports(node.expression.left) &&
        ts.isObjectLiteralExpression(node.expression.right)
      ) {
        const line = getLine(sourceFile, node.getStart());
        for (const prop of node.expression.right.properties) {
          const name = getObjectLiteralExportName(prop, sourceFile);
          if (name !== null) {
            exports.push({ name, kind: "named", line });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return exports;
}

/**
 * Bare-identifier call sites: `foo(...)` where the callee expression is a
 * plain Identifier. Deliberately excludes:
 *   - `obj.foo()` / `this.foo()` / `foo.bar.baz()` — the callee is a
 *     PropertyAccessExpression, not an Identifier, so these never match;
 *   - `require(...)` — a bare identifier call that is import-related, not
 *     a real function call (it is already captured as a RawImport of kind
 *     "require" by extractImportsJs).
 *
 * This is an AST-only pass — no type information is available — so a bare
 * call like `helper()` cannot be attributed to a module here. Attribution
 * happens later in buildIndex.ts pass 3, which matches the callee name
 * against the module's named imports. Two known limitations, both by
 * design (issue #50):
 *   1. Calls of default-imported functions (`import helper from "./h"`
 *      then `helper()`) can never be resolved — RawImport does not capture
 *      a local name for default imports, only hasDefaultImport: true.
 *   2. `obj.foo()` / `this.foo()` can never be resolved — even with type
 *      info this would need a full type-checker pass (method resolution),
 *      which the parser layer deliberately does not run.
 */
export function extractCallsJs(sourceFile: ts.SourceFile): RawCall[] {
  const calls: RawCall[] = [];

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text !== "require") {
        calls.push({
          calleeName: node.expression.text,
          line: getLine(sourceFile, node.getStart()),
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return calls;
}
