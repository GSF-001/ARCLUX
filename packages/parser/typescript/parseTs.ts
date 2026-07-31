// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import ts from "typescript";
import type { LanguageParser } from "../core/ParserInterface";
import type { FileInfo, ParsedFile, RawImport, RawExport, ImportKind } from "../../shared/types";

function getLine(sourceFile: ts.SourceFile, pos: number): number {
  return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
}

function extractImports(sourceFile: ts.SourceFile): RawImport[] {
  const imports: RawImport[] = [];

  function visit(node: ts.Node) {
    // Static: import x, { y } from "z"  /  import type { y } from "z"
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const namedImports: string[] = [];
      let hasDefaultImport = false;
      let hasNamespaceImport = false;
      let kind: ImportKind = node.importClause?.isTypeOnly ? "type-only" : "static";

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

function extractExports(sourceFile: ts.SourceFile): RawExport[] {
  const exports: RawExport[] = [];

  function visit(node: ts.Node) {
    // export default ...
    if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
    ) {
      exports.push({
        name: node.name?.text ?? "default",
        kind: "default",
        line: getLine(sourceFile, node.getStart()),
      });
    }

    // export const/function/class x = ...
    const hasExportModifier = (node as ts.Node & { modifiers?: ts.NodeArray<ts.ModifierLike> })
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
        (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) &&
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

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return exports;
}

export const parseTs: LanguageParser = {
  supportedLanguages: ["typescript"],
  extensions: [".ts", ".tsx"],

  async parse(file: FileInfo, content: string): Promise<ParsedFile> {
    const warnings: string[] = [];

    let sourceFile: ts.SourceFile;
    try {
      sourceFile = ts.createSourceFile(
        file.absolutePath,
        content,
        ts.ScriptTarget.Latest,
        /* setParentNodes */ true,
        file.extension === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      );
    } catch (err) {
      warnings.push(`Failed to parse: ${(err as Error).message}`);
      return { file, imports: [], exports: [], warnings };
    }

    const imports = extractImports(sourceFile);
    const exports = extractExports(sourceFile);

    return { file, imports, exports, warnings };
  },
};
