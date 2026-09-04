// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

/**
 * ARCLUX Core Types
 * Ini adalah "kamus" data utama. Semua package (parser, indexer, graph, engine, detectors)
 * WAJIB pakai type dari sini. Jangan define shape data sendiri-sendiri di file lain.
 */

// ─────────────────────────────────────────────
// Language & File
// ─────────────────────────────────────────────

export type SupportedLanguage =
  | "javascript"
  | "typescript"
  | "python"
  | "java"
  | "go"
  | "csharp"
  | "php"
  | "ruby"
  | "rust"
  | "cpp"
  | "bash"
  | "c"
  | "dart"
  | "elixir"
  | "kotlin"
  | "lua"
  | "objc"
  | "ocaml"
  | "scala"
  | "solidity"
  | "swift"
  | "vue"
  | "zig"
  | "elm"
  | "rescript"
  | "unknown";

export interface FileInfo {
  /** Absolute path on disk during analysis */
  absolutePath: string;
  /** Path relative to repository root, always POSIX-style ("/") */
  relativePath: string;
  language: SupportedLanguage;
  extension: string;
  sizeBytes: number;
  /** Content hash, used for cache invalidation & incremental updates */
  hash: string;
}

// ─────────────────────────────────────────────
// Parsing output (raw, before graph resolution)
// ─────────────────────────────────────────────

export type ImportKind =
  | "static" // import x from "y"
  | "dynamic" // await import("y")
  | "require" // require("y")
  | "type-only"; // import type x from "y"

export interface RawImport {
  /** The literal string written in source, e.g. "../utils/foo" or "react" */
  source: string;
  kind: ImportKind;
  /** Named imports, e.g. ["useState", "useEffect"]. Empty for default/namespace-only. */
  namedImports: string[];
  hasDefaultImport: boolean;
  /**
   * Local name of the default import, e.g. "h" in `import h from "./h"`.
   * Needed by the two-pass call resolver (resolveCalls.ts) so calls of
   * default-imported functions resolve instead of dropping silently (G2).
   * Absent when there is no default import.
   */
  defaultLocalName?: string;
  hasNamespaceImport: boolean;
  /** Line number in source file (1-indexed) */
  line: number;
}

export interface RawExport {
  name: string;
  kind: "default" | "named" | "re-export";
  /** For re-exports: the source module being re-exported from */
  reExportSource?: string;
  line: number;
}

/**
 * One bare-identifier call site: `foo(...)` where the callee is a plain
 * Identifier and NOT a property access (`obj.foo()`), `this.foo()`, or
 * `require(...)`. Extracted by packages/parser/javascript/extractJs.ts's
 * extractCallsJs (issue #50). Deliberately carries no argument info — the
 * call graph only needs who is called, not with what.
 */
export interface RawCall {
  /** Callee identifier text, e.g. "foo" in `foo(1, 2)` */
  calleeName: string;
  /** Line number in source file (1-indexed) */
  line: number;
}

// ─────────────────────────────────────────────
// Process runtime (kernel + storage)
// ─────────────────────────────────────────────

/**
 * Lifecycle states of an internal service process, PM2-inspired.
 * Moved here from packages/kernel/ProcessTable.ts (2026-08-14) so
 * packages/storage can persist process records without importing from
 * packages/kernel — fixes issue #312 (storage <-> kernel package cycle).
 */
export const ProcessStatus = {
  LAUNCHING: "launching",
  ONLINE: "online",
  STOPPING: "stopping",
  STOPPED: "stopped",
  ERRORED: "errored",
} as const;

export type ProcessStatusValue = (typeof ProcessStatus)[keyof typeof ProcessStatus];

/** One tracked process in the runtime's process table / persisted pid record. */
export interface ProcessEntry {
  id: string;
  pid: number | null;
  name: string;
  command: string;
  args: string[];
  cwd: string;
  status: ProcessStatusValue;
  startedAt: number | null;
  restarts: number;
  lastExitCode: number | null;
}

/**
 * Output of a single file parse. This is the CONTRACT every language parser
 * (parseJs, parseTs, parsePython, ...) must return, regardless of language.
 */
export interface ParsedFile {
  file: FileInfo;
  imports: RawImport[];
  exports: RawExport[];
  /**
   * Bare-identifier call sites found by the JS-family parsers
   * (parseJs/parseJsx/parseCommonJs -> extractCallsJs). Optional because
   * most language parsers do not extract call sites yet — only the JS
   * family populates it today. Consumed by buildIndex.ts pass 3, which
   * resolves each callee against the module's named imports.
   */
  calls?: RawCall[];
  /**
   * For languages where files sharing a directory (Go) or package
   * declaration (Java, by convention - package must match directory per
   * the language spec) implicitly share scope and can reference each
   * other with ZERO import statements. Only set by parseGo.ts and
   * parseJava.ts today. Consumed by resolveSameScopeDependencies.ts.
   */
  scopeId?: string;
  /** Parser-specific extras (e.g. React components found, hooks used) go here, not in the base shape */
  meta?: Record<string, unknown>;
  /** Non-fatal parse warnings (e.g. "could not parse dynamic require") */
  warnings: string[];
}

// ─────────────────────────────────────────────
// Repository entities (post-indexing)
// ─────────────────────────────────────────────

export interface RepositoryMeta {
  id: string;
  org: string;
  name: string;
  defaultBranch: string;
  rootPath: string;
  detectedFrameworks: string[]; // e.g. ["nextjs", "react"]
  packageManager: "npm" | "pnpm" | "yarn" | "poetry" | "uv" | "pipenv" | "pdm" | "pip" | "unknown";
  analyzedAt: string; // ISO timestamp
}

/**
 * Identifier-level detail of one resolved import, kept alongside the
 * flattened `imports: string[]` on ModuleInfo. `imports` only tells you
 * "file A imports file B" (used by buildDependencyGraph.ts for edges);
 * this tells you WHICH identifiers, needed by detectors that check
 * per-export usage (e.g. detectUnusedExports.ts).
 */
export interface ResolvedImport {
  moduleId: string; // resolved internal module id being imported
  kind: ImportKind;
  namedImports: string[];
  hasDefaultImport: boolean;
  hasNamespaceImport: boolean;
  line: number;
}

/**
 * A RawCall whose callee name matched a named import of the calling module,
 * resolved to the module that exports it. Built by buildIndex.ts pass 3
 * via packages/graph/resolveCalls.ts (two-pass resolver, ported from
 * ManSio/mscodebase-intelligence PR #20 — see resolveCalls.ts for the
 * strategy ladder). A RawCall that cannot be resolved is NOT dropped
 * silently anymore: it lands in ModuleInfo.unresolvedCalls with a reason.
 */
export interface ResolvedCall {
  /** Module id of the module that exports the callee */
  moduleId: string;
  calleeName: string;
  line: number;
  /**
   * Resolution confidence (ManSio ladder): 1.0 = matched via an explicit
   * import of the caller; 0.85 = unique global (exported by exactly one
   * repo module, no import). Optional so fixtures/tests built before the
   * two-pass resolver keep compiling — resolver output always sets it.
   */
  confidence?: 1.0 | 0.85;
  /** Which ladder rung resolved this call. Absent on pre-resolver fixtures. */
  resolver?: "import" | "unique-global";
}

/**
 * A call site the two-pass resolver explicitly could NOT resolve — the
 * anti-silent-drop record (ManSio rule 3.4). Every RawCall ends up either
 * in `calls` or here; nothing vanishes.
 */
export interface UnresolvedCall {
  calleeName: string;
  line: number;
  /**
   * - "ambiguous": exported/imported by 2+ modules — resolver refuses to
   *   pick (no last-write-wins). `candidates` lists the module ids.
   * - "external": callee comes from an external package (node builtin or
   *   package.json dep). `packageName` set. No graph node is created for
   *   it (call graph stays file-node-only) — the record is the evidence.
   * - "unknown": no import, no unique global, not external (local def,
   *   global, typo, or unsupported syntax like default-import without a
   *   verifiable default export).
   */
  reason: "ambiguous" | "external" | "unknown";
  /** Candidate module ids (reason "ambiguous" only). */
  candidates?: string[];
  /** Package name (reason "external" only). */
  packageName?: string;
}

export interface ModuleInfo {
  id: string; // stable id, usually = relativePath
  file: FileInfo;
  exports: RawExport[];
  /**
   * For exports of kind "re-export" whose reExportSource resolves to a
   * file inside the repo: exportName -> target moduleId. Populated by
   * buildIndex.ts alongside `imports`. Does NOT capture aliased re-exports
   * (`export { foo as bar } from "./x"`) correctly yet — RawExport only
   * stores the final exported name ("bar"), not the original identifier
   * ("foo") in the source module, so the chain breaks silently for that
   * specific case until the parser layer captures both names separately.
   */
  resolvedReExports: Record<string, string>;
  importedBy: string[]; // module ids that import this module
  imports: string[]; // module ids this module imports (resolved, not raw strings)
  resolvedImports: ResolvedImport[]; // identifier-level detail of `imports`
  /**
   * Resolved call sites in this module: callee -> module that exports it
   * (via named import). REQUIRED (not optional) per issue #50 — every
   * ModuleInfo carries an empty array when the source language's parser
   * does not extract calls (only the JS family does today). Known
   * limitations of the resolution are documented in extractJs.ts's
   * extractCallsJs doc comment: calls of default-imported functions and
   * `obj.foo()`/`this.foo()` calls are never resolved.
   */
  calls: ResolvedCall[];
  /**
   * Call sites the two-pass resolver explicitly left unresolved (with
   * reasons) — the anti-silent-drop counterpart to `calls`. Optional (not
   * REQUIRED like `calls`) so the ~15 test fixtures constructing ModuleInfo
   * manually keep compiling; buildIndex.ts always populates it. Consumers
   * treat absent as [].
   */
  unresolvedCalls?: UnresolvedCall[];
  /** Module ids that call this module's exported functions — back-filled by buildIndex.ts pass 4, mirrors `importedBy` */
  calledBy: string[];
  /**
   * Dependencies found via resolveSameScopeDependencies.ts's regex-based
   * whole-word scan, NOT from an actual import statement. Kept SEPARATE
   * from `imports` on purpose: imports[] is 100 percent certain (literal
   * from source), this is a guess that can false-positive (e.g. a name
   * mentioned in a comment or string literal). Not yet wired into any
   * graph builder - see PROGRES.md decisions entry.
   */
  implicitDependencies: string[];
}

// ─────────────────────────────────────────────
// Graph (what gets rendered / traversed)
// ─────────────────────────────────────────────

export type GraphNodeType =
  | "file"
  | "folder"
  | "external-package"
  | "route"
  | "component"
  | "hook";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  filePath?: string; // relative path, absent for external-package nodes
  metadata?: Record<string, unknown>;
}

export type GraphEdgeType = "import" | "export" | "call" | "route-link";

export interface GraphEdge {
  id: string;
  source: string; // GraphNode id
  target: string; // GraphNode id
  type: GraphEdgeType;
  weight?: number;
}

export interface DependencyGraph {
  repositoryId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  builtAt: string; // ISO timestamp
}

// ─────────────────────────────────────────────
// Errors (shared across packages, used by shared/errors.ts)
// ─────────────────────────────────────────────

export type ArcluxErrorCode =
  | "CLONE_FAILED"
  | "PARSE_FAILED"
  | "UNSUPPORTED_LANGUAGE"
  | "INDEX_FAILED"
  | "GRAPH_BUILD_FAILED"
  | "NOT_FOUND";

export interface ArcluxErrorShape {
  code: ArcluxErrorCode;
  message: string;
  filePath?: string;
  cause?: unknown;
}

// ─────────────────────────────────────────────
// Folder hierarchy (derived from file paths, used by graph/buildFolderGraph.ts)
// ─────────────────────────────────────────────

export interface FolderInfo {
  /** Relative path, POSIX-style. "" for the repository root itself. */
  path: string;
  name: string;
  /** Module ids (relativePaths) of files directly inside this folder (not nested subfolders) */
  fileIds: string[];
  /** Relative paths of direct child folders */
  childFolderPaths: string[];
}

// ─────────────────────────────────────────────
// External dependencies (npm packages actually imported, not indexed as modules)
// ─────────────────────────────────────────────

export interface ExternalDependency {
  packageName: string;
  /** Module ids that import this package at least once */
  importedByModuleIds: string[];
  /** Total number of import statements referencing this package, across all modules */
  importCount: number;
}

// ─────────────────────────────────────────────
// Scan accounting (the "eligible_seen" of ARCLUX — see progres/decisions.md)
// ─────────────────────────────────────────────

/**
 * How many files were scanned vs actually made it into the Repository.
 * The population-rot guard: a graph built from a snapshot silently drops
 * files whose language has no registered parser — without this, consumers
 * can't tell "repo has 0 Python modules" from "Python files were skipped".
 * Populated by buildIndex.ts pass 1; carried on Repository + surfaced in
 * AnalyzeRepositoryResult / /api/analyze.
 */
export interface ScanSummary {
  /** Total files matched by scanFiles (before parser dispatch). */
  filesScanned: number;
  /** Files that a registered parser successfully parsed into a ModuleInfo. */
  filesParsed: number;
  /** Files skipped because no parser is registered for their extension. */
  filesSkippedNoParser: number;
  /** skipped count per extension, e.g. {".py": 12} — why the population shrank. */
  skippedByExtension: Record<string, number>;
}
