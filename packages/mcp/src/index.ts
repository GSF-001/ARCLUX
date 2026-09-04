// Copyright 2026 Mikatoshi
// Licensed under the Apache License, Version 2.0
//
// ARCLUX MCP Server — 30 tools covering the full analysis engine.
// Entry point: startMcpServer() (called by `arclux mcp` CLI command).

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// ── engine ────────────────────────────────────────────────────────────────
import { analyzeRepository } from "../../engine/pipeline.ts";
import { runDoctor } from "../../engine/runDoctor.ts";
import { runAllChecks } from "../../engine/contract.ts";
import { computeHealthScore } from "../../engine/healthScore.ts";

// ── graph ─────────────────────────────────────────────────────────────────
import { buildCallGraph } from "../../graph/buildCallGraph.ts";
import { buildDependencyGraph } from "../../graph/buildDependencyGraph.ts";
import { buildExportGraph } from "../../graph/buildExportGraph.ts";
import { buildFolderGraph, folderGraphToJSON } from "../../graph/buildFolderGraph.ts";

// ── impact ────────────────────────────────────────────────────────────────
import { buildImpactTree } from "../../impact/buildImpactTree.ts";
import { calculateAffectedFiles } from "../../impact/calculateAffectedFiles.ts";
import { calculateAffectedRoutes } from "../../impact/calculateAffectedRoutes.ts";
import { traceConsumers } from "../../impact/traceConsumers.ts";
import { traceDependencies } from "../../impact/traceDependencies.ts";

// ── security ──────────────────────────────────────────────────────────────
import { analyzeRepositorySecurity } from "../../security-analysis/integration.ts";
import { mapAttackSurface } from "../../correlation/AttackSurfaceMapper.ts";

// ── search ────────────────────────────────────────────────────────────────
import { buildSearchIndex } from "../../search/SearchIndex.ts";
import { search } from "../../search/SearchEngine.ts";

// ── diagnostics ───────────────────────────────────────────────────────────
import { runDiagnostics } from "../../diagnostics/DiagnosticEngine.ts";
import { getFixSuggestions } from "../../diagnostics/FixSuggestion.ts";

// ── diff ──────────────────────────────────────────────────────────────────
import { computeArchitecturalDiff } from "../../diff/architecturalDiff.ts";
import { computeSemanticDiff } from "../../semantic-diff/SemanticDiff.ts";

// ── git ───────────────────────────────────────────────────────────────────
import { cloneRepository } from "../../git/cloneRepository.ts";
import { cleanupRepository } from "../../git/cleanupRepository.ts";
import { getBranches } from "../../git/getBranches.ts";
import { detectDefaultBranch } from "../../git/detectDefaultBranch.ts";
import { getCommitHistory } from "../../git/getCommitHistory.ts";
import { getContributors } from "../../git/getContributors.ts";

// ── editor ────────────────────────────────────────────────────────────────
import { openFile, listDependencyTargets, listDirectConsumerTargets } from "../../editor/CodeNavigator.ts";

// ── dsl ───────────────────────────────────────────────────────────────────
import { runScriptSource } from "../../dsl/script.ts";

// ── parser ────────────────────────────────────────────────────────────────
// NOTE: tree-sitter parsers (Python, Go, Java, etc.) depend on WASM loading
// via web-tree-sitter. We do NOT import them at top level because the MCP
// server needs to start fast without blocking on WASM initialization.
// Only the TS/JS compiler API parser is imported here (pure JS, no WASM).
// For tree-sitter languages, use `analyze` → `file_info` instead.
import { detectLanguage, isSupportedExtension } from "../../parser/core/LanguageDetector.ts";

// ── indexer ───────────────────────────────────────────────────────────────
import { resolveRoutes } from "../../indexer/resolveRoutes.ts";
import { resolveComponents } from "../../indexer/resolveComponents.ts";
import { resolveHooks } from "../../indexer/resolveHooks.ts";
import { resolveProviders } from "../../indexer/resolveProviders.ts";

// ── daemon ────────────────────────────────────────────────────────────────
import { getDaemonStatus, getDaemonHealth } from "../../daemon/DaemonProcess.ts";

// ── db ────────────────────────────────────────────────────────────────────
import { listRepos, getRepo } from "../../db/repositories/RepoStore.ts";
import { listAnalysesForRepo, getAnalysis } from "../../db/repositories/AnalysisStore.ts";

// ── cache ─────────────────────────────────────────────────────────────────
import { getCacheStats, clearAllCaches } from "../../cache/CacheProvider.ts";

// ──────────────────────────────────────────────────────────────────────────
// DETECTORS — registry-driven.
// To add a new detector: 1) create packages/detectors/detectXxx.ts
//                         2) add ONE import line below
//                         3) add ONE entry to DETECTOR_MAP (key = CLI name)
// It auto-appears in the `detect` tool's description and tool list.
// ──────────────────────────────────────────────────────────────────────────
import { detectCircularDependency } from "../../detectors/detectCircularDependency.ts";
import { detectUnusedExports } from "../../detectors/detectUnusedExports.ts";
import { detectOrphanFiles } from "../../detectors/detectOrphanFiles.ts";
import { detectOrphanIntegration } from "../../detectors/detectOrphanIntegration.ts";
import { detectLargeModules } from "../../detectors/detectLargeModules.ts";
import { detectDuplicateModules } from "../../detectors/detectDuplicateModules.ts";
import { detectSharedModules } from "../../detectors/detectSharedModules.ts";
import { detectIndexFiles } from "../../detectors/detectIndexFiles.ts";
import { detectLayerViolation } from "../../detectors/detectLayerViolation.ts";
import { detectDeadCode } from "../../detectors/detectDeadCode.ts";
import { detectAmbiguousSymbolResolution } from "../../detectors/detectAmbiguousSymbolResolution.ts";
import { detectComponentConvention } from "../../detectors/detectComponentConvention.ts";
import { detectFeatureStructure } from "../../detectors/detectFeatureStructure.ts";
import { detectMissingExports } from "../../detectors/detectMissingExports.ts";
import { detectRepositoryPattern } from "../../detectors/detectRepositoryPattern.ts";
import { detectRouteConvention } from "../../detectors/detectRouteConvention.ts";
import { detectStoryConvention } from "../../detectors/detectStoryConvention.ts";
import { detectTestConvention } from "../../detectors/detectTestConvention.ts";
import { detectUnusedFiles } from "../../detectors/detectUnusedFiles.ts";
import { detectEntryPoints } from "../../detectors/detectEntryPoints.ts";

const DETECTOR_MAP: Record<string, (repo: any) => any[]> = {
  circular:             detectCircularDependency,
  unused_exports:       detectUnusedExports,
  orphan_files:         detectOrphanFiles,
  orphan_integration:   detectOrphanIntegration,
  large_modules:        detectLargeModules,
  duplicate_modules:    detectDuplicateModules,
  shared_modules:       detectSharedModules,
  index_files:          detectIndexFiles,
  layer_violation:      detectLayerViolation,
  dead_code:            detectDeadCode,
  ambiguous_symbols:    detectAmbiguousSymbolResolution,
  component_convention: detectComponentConvention,
  feature_structure:    detectFeatureStructure,
  missing_exports:      detectMissingExports,
  repository_pattern:   detectRepositoryPattern,
  route_convention:     detectRouteConvention,
  story_convention:     detectStoryConvention,
  test_convention:      detectTestConvention,
  unused_files:         detectUnusedFiles,
  entry_points:         detectEntryPoints,
};

const DETECTOR_NAMES = Object.keys(DETECTOR_MAP);

// ──────────────────────────────────────────────────────────────────────────
// RULES — registry-driven.
// Same pattern: add import + add to ALL_RULES below.
// runRules() filters by detectedFrameworks automatically.
// ──────────────────────────────────────────────────────────────────────────
import { runRules, type Rule } from "../../rules/RuleEngine.ts";
import { requirePage } from "../../rules/nextjs/requirePage.ts";
import { requireRoute } from "../../rules/nextjs/requireRoute.ts";
import { requireIndexUpdate } from "../../rules/nextjs/requireIndexUpdate.ts";
import { requireLayoutUpdate } from "../../rules/nextjs/requireLayoutUpdate.ts";
import { requireMetadata } from "../../rules/nextjs/requireMetadata.ts";
import { requireControllerBinding } from "../../rules/nestjs/requireControllerBinding.ts";
import { requireModuleRegistration } from "../../rules/nestjs/requireModuleRegistration.ts";
import { requireRouteRegistration } from "../../rules/express/requireRouteRegistration.ts";
import { requireEntryConfig } from "../../rules/vite/requireEntryConfig.ts";
import { requireMainProcessBinding } from "../../rules/electron/requireMainProcessBinding.ts";
import { requirePreloadExposure } from "../../rules/electron/requirePreloadExposure.ts";
import { requireComponentExport } from "../../rules/react/requireComponentExport.ts";
import { requireHookRules } from "../../rules/react/requireHookRules.ts";
import { requireController } from "../../rules/laravel/requireController.ts";

const ALL_RULES: Rule[] = [
  requirePage,
  requireRoute,
  requireIndexUpdate,
  requireLayoutUpdate,
  requireMetadata,
  requireControllerBinding,
  requireModuleRegistration,
  requireRouteRegistration,
  requireEntryConfig,
  requireMainProcessBinding,
  requirePreloadExposure,
  requireComponentExport,
  requireHookRules,
  requireController,
];

const RULE_FRAMEWORKS = [...new Set(ALL_RULES.map((r) => r.appliesToFramework))];

// ──────────────────────────────────────────────────────────────────────────
// Parser extensions (auto-detected from LanguageDetector).
// parse_file uses this to validate and route to the correct parser.
// ──────────────────────────────────────────────────────────────────────────
const TS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs", ".cjs", ".cts"];
const TREE_SITTER_EXTENSIONS = [
  ".py", ".go", ".java", ".php", ".rb", ".rs", ".cpp", ".c", ".h", ".hpp",
  ".cs", ".sh", ".bash", ".dart", ".ex", ".exs", ".kt", ".lua", ".m",
  ".ml", ".mli", ".scala", ".sol", ".swift", ".vue", ".zig",
];
const ALL_EXTENSIONS = [...TS_EXTENSIONS, ...TREE_SITTER_EXTENSIONS];

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────
function analyzeOpts(args: Record<string, unknown>) {
  if (args.localPath) return { localPath: args.localPath as string };
  if (args.repoUrl) return { repoUrl: args.repoUrl as string, branch: args.branch as string | undefined };
  return { localPath: process.cwd() };
}

async function doAnalyze(args: Record<string, unknown>) {
  return analyzeRepository(analyzeOpts(args));
}

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

async function withClone(repoUrl: string, branch: string | undefined, fn: (localPath: string) => Promise<any>) {
  const clone = await cloneRepository({ repoUrl, branch });
  try {
    return await fn(clone.localPath);
  } finally {
    await cleanupRepository(clone.localPath);
  }
}

function resolveFile(moduleId: string, repository: any) {
  // Repository API is getModule(id) where id === file.relativePath (POSIX, e.g. "packages/gameserver/netcode.ts")
  // Support direct id, normalized path, and linear fallback for robustness.
  let mod = repository.getModule?.(moduleId);
  if (mod) return mod;
  const normalized = moduleId.replace(/^\.\//, "").replace(/^\//, "");
  if (normalized !== moduleId) {
    mod = repository.getModule?.(normalized);
    if (mod) return mod;
  }
  // Fallback: search by file.relativePath (handles rare id != path cases)
  const all = repository.getAllModules?.() ?? [];
  mod = all.find((m: any) => m.id === moduleId || m.file?.relativePath === moduleId || m.file?.relativePath === normalized);
  if (mod) return mod;
  throw new Error("Module not found: " + moduleId + " (tried '" + moduleId + "'" + (normalized !== moduleId ? " and '" + normalized + "'" : "") + ")");
}

function getAllModules(repository: any) {
  return repository.getAllModules ? repository.getAllModules() : [];
}

function resolveImpactModuleId(repository: any, raw: string): string {
  if (!raw) return raw;
  if (repository.getModule?.(raw)) return raw;
  const normalized = raw.replace(/^\.\//, "").replace(/^\//, "");
  if (normalized !== raw && repository.getModule?.(normalized)) return normalized;
  const all = repository.getAllModules?.() ?? [];
  const found = all.find((m: any) => m.id === raw || m.id === normalized || m.file?.relativePath === raw || m.file?.relativePath === normalized);
  return found ? found.id : raw;
}

// ──────────────────────────────────────────────────────────────────────────
// Tool definitions — descriptions are built from registries above,
// so they auto-update when you add new detectors/rules/parsers.
// ──────────────────────────────────────────────────────────────────────────
const TOOLS = [
  // ── Core analysis ─────────────────────────────────────────────────
  {
    name: "analyze",
    description: "Full analysis pipeline - parse all files, build index, build dependency graph, detect frameworks.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string", description: "Git URL to clone and analyze" },
        localPath: { type: "string", description: "Local filesystem path" },
        branch:    { type: "string", description: "Branch to clone (default: main)" },
      },
    },
  },
  {
    name: "doctor",
    description: "Run all " + DETECTOR_NAMES.length + " architecture detectors. Returns findings with checkId, severity, filePath, message.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
      },
    },
  },
  {
    name: "health",
    description: "Compute health score with 4 categories (structural, hygiene, conventions, info). Score 0-100.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
      },
    },
  },
  {
    name: "verify",
    description: "Run " + DETECTOR_NAMES.length + " detectors + " + ALL_RULES.length + " framework rules (" + RULE_FRAMEWORKS.join("/") + "), return PASS/FAIL verdict.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
      },
    },
  },
  {
    name: "diagnose",
    description: "Diagnostics (circular, dead code, ambiguous) with impact context and fix suggestions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
      },
    },
  },

  // ── Graphs ────────────────────────────────────────────────────────
  {
    name: "callgraph",
    description: "Build function call graph (nodes + edges).",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
      },
    },
  },
  {
    name: "dependency_graph",
    description: "Build import dependency graph.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
      },
    },
  },
  {
    name: "export_graph",
    description: "Build export relationship graph.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
      },
    },
  },
  {
    name: "folder_graph",
    description: "Build directory tree structure with file counts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
      },
    },
  },

  // ── Impact ────────────────────────────────────────────────────────
  {
    name: "impact",
    description: "Full impact analysis - dependency tree, affected files, affected routes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
        moduleId:  { type: "string", description: "Relative file path or moduleId" },
      },
      required: ["moduleId"],
    },
  },
  {
    name: "impact_consumers",
    description: "Trace all consumers of a module (who calls this).",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
        moduleId:  { type: "string" },
      },
      required: ["moduleId"],
    },
  },
  {
    name: "impact_dependencies",
    description: "Trace all dependencies of a module (what does this call).",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
        moduleId:  { type: "string" },
      },
      required: ["moduleId"],
    },
  },

  // ── Security ──────────────────────────────────────────────────────
  {
    name: "security",
    description: "Full security analysis + attack surface map.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
      },
    },
  },

  // ── Search ────────────────────────────────────────────────────────
  {
    name: "search",
    description: "Fuzzy search for symbols, files, or code patterns.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
        query:     { type: "string" },
        limit:     { type: "number", description: "Max results (default 50)" },
      },
      required: ["query"],
    },
  },

  // ── Detectors ─────────────────────────────────────────────────────
  {
    name: "detect",
    description: "Run specific detector(s). Available: " + DETECTOR_NAMES.join(", ") + ". Use [\"all\"] for all.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
        detectors: { type: "array", items: { type: "string" }, description: "Detector names" },
      },
      required: ["detectors"],
    },
  },

  // ── Diff ──────────────────────────────────────────────────────────
  {
    name: "diff",
    description: "Architectural diff between two git refs - changed files + affected consumers.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
        refA:      { type: "string" },
        refB:      { type: "string" },
      },
      required: ["refA", "refB"],
    },
  },
  {
    name: "semantic_diff",
    description: "AST-level semantic diff between two git refs - understands code structure, not just text.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
        refA:      { type: "string" },
        refB:      { type: "string" },
      },
      required: ["refA", "refB"],
    },
  },

  // ── Git ───────────────────────────────────────────────────────────
  {
    name: "branches",
    description: "List remote branches + default branch.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl: { type: "string" },
      },
      required: ["repoUrl"],
    },
  },
  {
    name: "history",
    description: "Get commit history and contributors (clones shallowly, then cleans up).",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
        maxCount:  { type: "number", description: "Max commits (default 20)" },
      },
    },
  },

  // ── Editor ────────────────────────────────────────────────────────
  {
    name: "file_info",
    description: "Module info for a file - exports, imports, calls, dependencies, consumers.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
        filePath:  { type: "string" },
      },
      required: ["filePath"],
    },
  },

  // ── Parser ────────────────────────────────────────────────────────
  {
    name: "parse_file",
    description: "Parse a single TS/JS file → exports, imports, calls via Compiler API. For tree-sitter languages (Python/Go/Java/etc), use analyze → file_info instead.",
    inputSchema: {
      type: "object" as const,
      properties: {
        localPath: { type: "string", description: "Absolute path to repo root (for reading file from disk)" },
        filePath:  { type: "string", description: "Relative file path within repo" },
        content:   { type: "string", description: "File content (optional — if omitted, reads from disk)" },
        extension: { type: "string", description: "Override extension for detection (e.g. '.ts')" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "detect_language",
    description: "Detect programming language from file extension. Supports 27 languages (TS/JS via Compiler API, Python/Go/Java/etc via tree-sitter).",
    inputSchema: {
      type: "object" as const,
      properties: {
        extension: { type: "string", description: "File extension (e.g. 'ts', 'py', 'rs')" },
      },
      required: ["extension"],
    },
  },

  // ── Indexer ───────────────────────────────────────────────────────
  {
    name: "resolve_routes",
    description: "Resolve all route entries in a repository (Next.js/NestJS/Express routes).",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
      },
    },
  },
  {
    name: "resolve_components",
    description: "Resolve all React/component entries in a repository.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
      },
    },
  },
  {
    name: "resolve_hooks",
    description: "Resolve all custom hook entries in a repository.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
      },
    },
  },
  {
    name: "resolve_providers",
    description: "Resolve all provider entries in a repository.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
      },
    },
  },

  // ── Rules ─────────────────────────────────────────────────────────
  {
    name: "run_rules",
    description: "Run " + ALL_RULES.length + " framework rules (" + RULE_FRAMEWORKS.join("/") + "). Filtered by detected frameworks. Returns violations.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:    { type: "string" },
        localPath:  { type: "string" },
        branch:     { type: "string" },
        frameworks: { type: "array", items: { type: "string" }, description: "Filter by framework (e.g. [\"nextjs\"]). Empty = auto-detect." },
      },
    },
  },

  // ── Daemon ────────────────────────────────────────────────────────
  {
    name: "daemon_status",
    description: "Get ARCLUX daemon status (running, pid, health, bridge server).",
    inputSchema: {
      type: "object" as const,
      properties: {
        localPath: { type: "string", description: "Repository root path" },
      },
      required: ["localPath"],
    },
  },

  // ── DB ────────────────────────────────────────────────────────────
  {
    name: "db_repos",
    description: "List all repositories stored in the ARCLUX database.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "db_analyses",
    description: "List analysis history for a repository from the ARCLUX database.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoId: { type: "string", description: "Repository ID" },
      },
      required: ["repoId"],
    },
  },

  // ── DSL & Config ──────────────────────────────────────────────────
  {
    name: "dsl",
    description: "Execute an ARCLUX DSL script. Script should call analyze(\"url\") internally.",
    inputSchema: {
      type: "object" as const,
      properties: {
        source: { type: "string" },
      },
      required: ["source"],
    },
  },
  {
    name: "config",
    description: "Detect repository metadata - name, frameworks, package manager.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
      },
    },
  },
];

// ──────────────────────────────────────────────────────────────────────────
// Tool handlers
// ──────────────────────────────────────────────────────────────────────────
async function handleTool(name: string, args: Record<string, unknown>) {
  switch (name) {

    // ── Core ──────────────────────────────────────────────────────
    case "analyze": {
      const r = await doAnalyze(args);
      return json({
        meta: r.meta, moduleCount: r.moduleCount, scanSummary: r.scanSummary,
        graph: { nodeCount: r.graph.nodes.length, edgeCount: r.graph.edges.length },
        dependencies: r.dependencies,
      });
    }
    case "doctor": {
      const r = await doAnalyze(args);
      return json(runDoctor(r.repository));
    }
    case "health": {
      const r = await doAnalyze(args);
      const dr = runDoctor(r.repository);
      return json(computeHealthScore(dr.findings, r.moduleCount));
    }
    case "verify": {
      const r = await doAnalyze(args);
      const result = runAllChecks(r.repository);
      return json({ verdict: result.errorCount === 0 ? "PASS" : "FAIL", ...result });
    }
    case "diagnose": {
      const r = await doAnalyze(args);
      const findings = runDiagnostics(r.repository);
      return json({ findings, fixes: getFixSuggestions(findings) });
    }

    // ── Graphs ─────────────────────────────────────────────────────
    case "callgraph": {
      const r = await doAnalyze(args);
      const g = buildCallGraph(r.repository);
      return json({ nodes: g.nodes, edges: g.edges });
    }
    case "dependency_graph": {
      const r = await doAnalyze(args);
      const g = buildDependencyGraph(r.repository);
      return json({ nodes: g.nodes, edges: g.edges });
    }
    case "export_graph": {
      const r = await doAnalyze(args);
      const g = buildExportGraph(r.repository);
      return json({ nodes: g.nodes, edges: g.edges });
    }
    case "folder_graph": {
      const r = await doAnalyze(args);
      // folderGraphToJSON: HierarchyNode has parent pointers (circular) —
      // never JSON.stringify the raw buildFolderGraph() result (BUG-1).
      return json(folderGraphToJSON(buildFolderGraph(r.repository)));
    }

    // ── Impact ─────────────────────────────────────────────────────
    case "impact": {
      const r = await doAnalyze(args);
      const mid = resolveImpactModuleId(r.repository, args.moduleId as string);
      return json({
        requestedModuleId: args.moduleId,
        resolvedModuleId: mid,
        tree: buildImpactTree(r.repository, mid),
        affectedFiles: calculateAffectedFiles(r.repository, mid),
        affectedRoutes: calculateAffectedRoutes(r.repository, mid),
      });
    }
    case "impact_consumers": {
      const r = await doAnalyze(args);
      const mid = resolveImpactModuleId(r.repository, args.moduleId as string);
      const result = traceConsumers(r.repository, mid);
      // Enrich notFound with hint
      if (result.notFound) {
        return json({ ...result, requestedModuleId: args.moduleId, resolvedModuleId: mid, hint: "Module not found — try file_info or analyze to list available modules" });
      }
      return json({ ...result, requestedModuleId: args.moduleId, resolvedModuleId: mid });
    }
    case "impact_dependencies": {
      const r = await doAnalyze(args);
      const mid = resolveImpactModuleId(r.repository, args.moduleId as string);
      const result = traceDependencies(r.repository, mid);
      if (result.notFound) {
        return json({ ...result, requestedModuleId: args.moduleId, resolvedModuleId: mid, hint: "Module not found — try file_info or analyze to list available modules" });
      }
      return json({ ...result, requestedModuleId: args.moduleId, resolvedModuleId: mid });
    }

    // ── Security ───────────────────────────────────────────────────
    case "security": {
      const r = await doAnalyze(args);
      const sec = analyzeRepositorySecurity(r.repository, r.meta.rootPath);
      const graph = buildCallGraph(r.repository);
      return json({ security: sec, attackSurface: mapAttackSurface(r.repository, graph) });
    }

    // ── Search ─────────────────────────────────────────────────────
    case "search": {
      const r = await doAnalyze(args);
      const idx = buildSearchIndex(r.repository);
      return json(search(idx, args.query as string, { limit: (args.limit as number) ?? 50 }));
    }

    // ── Detect ─────────────────────────────────────────────────────
    case "detect": {
      const r = await doAnalyze(args);
      const names = (args.detectors as string[]) ?? [];
      const runAll = names.includes("all");
      const targets = runAll ? DETECTOR_NAMES : names;
      const results: Record<string, any> = {};
      let total = 0;
      for (const n of targets) {
        const fn = DETECTOR_MAP[n];
        if (!fn) { results[n] = { error: "Unknown: " + n + ". Available: " + DETECTOR_NAMES.join(", ") }; continue; }
        const findings = fn(r.repository);
        results[n] = { count: findings.length, findings };
        total += findings.length;
      }
      return json({ totalFindings: total, detectors: results });
    }

    // ── Diff ───────────────────────────────────────────────────────
    case "diff": {
      const r = await doAnalyze(args);
      return json(computeArchitecturalDiff(r.repository, r.meta.rootPath, args.refA as string, args.refB as string));
    }
    case "semantic_diff": {
      const r = await doAnalyze(args);
      return json(computeSemanticDiff({ repository: r.repository, repoPath: r.meta.rootPath, refA: args.refA as string, refB: args.refB as string }));
    }

    // ── Git ────────────────────────────────────────────────────────
    case "branches": {
      return json({ branches: getBranches(args.repoUrl as string), defaultBranch: detectDefaultBranch(args.repoUrl as string) });
    }
    case "history": {
      const fn = async (localPath: string) => {
        const commits = await getCommitHistory(localPath, { maxCount: (args.maxCount as number) ?? 20, branch: args.branch as string });
        const contributors = await getContributors(localPath);
        return { commits, contributors };
      };
      const result = args.localPath ? await fn(args.localPath as string) : await withClone(args.repoUrl as string, args.branch as string, fn);
      return json(result);
    }

    // ── Editor ─────────────────────────────────────────────────────
    case "file_info": {
      const r = await doAnalyze(args);
      const mod = resolveFile(args.filePath as string, r.repository);
      // ModuleInfo.imports is string[] (resolved moduleIds); identifier detail is in resolvedImports
      const imports = (mod.resolvedImports ?? []).map((i: any) => ({ source: i.moduleId, names: i.namedImports, kind: i.kind, line: i.line }));
      // Fallback to raw imports if resolvedImports empty (external-only deps)
      const importView = imports.length ? imports : (mod.imports ?? []).map((id: string) => ({ source: id, names: [] as string[] }));
      return json({
        moduleId: mod.id, filePath: mod.file.relativePath,
        exports: mod.exports.map((e: any) => ({ name: e.name, kind: e.kind, line: e.line })),
        imports: importView,
        calls: mod.calls.map((c: any) => ({ calleeName: c.calleeName, moduleId: c.moduleId, line: c.line })),
        // keep legacy string arrays for backward compat as well
        callsLegacy: mod.calls.map((c: any) => c.calleeName),
        dependencies: listDependencyTargets(r.repository, mod.id),
        consumers: listDirectConsumerTargets(r.repository, mod.id),
        importedBy: mod.importedBy,
        calledBy: mod.calledBy,
      });
    }

    // ── Parser (standalone — TS/JS via Compiler API, tree-sitter via analyze) ──
    case "parse_file": {
      const filePath = args.filePath as string;
      const ext = (args.extension as string) ?? undefined;
      const content = args.content as string | undefined;

      const dotExt = ext ?? ("." + filePath.split(".").pop());
      const language = detectLanguage(dotExt);

      // Tree-sitter languages (Python, Go, Java, etc.) need WASM runtime.
      // Direct standalone parsing isn't available in MCP mode — use
      // `analyze` + `file_info` for these. The error message tells the agent.
      if (TREE_SITTER_EXTENSIONS.includes(dotExt.toLowerCase())) {
        throw new Error(
          dotExt + " (" + language + ") requires WASM runtime. Use: "
          + 'analyze {repoUrl/localPath} → file_info {filePath: "' + filePath + '"}'
        );
      }

      // TS/JS files — use the TypeScript Compiler API (no WASM needed).
      let fileContent = content;
        if (!fileContent) {
          const fs = await import("node:fs/promises");
          const basePath = (args.localPath as string) ?? process.cwd();
          if (!basePath) throw new Error("localPath required when content is omitted");
        const fullPath = basePath.startsWith("/") ? basePath + "/" + filePath : basePath + "/" + filePath;
        fileContent = await fs.readFile(fullPath, "utf-8");
      }

      const ts = await import("typescript");
      const sourceFile = ts.createSourceFile(filePath, fileContent!, ts.ScriptTarget.Latest, true);

      const exports: any[] = [];
      const imports: any[] = [];
      const calls: any[] = [];

      ts.forEachChild(sourceFile, function visit(node) {
        // Exports
        if (ts.isExportAssignment(node)) {
          exports.push({ name: "default", kind: "default", line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
        } else if (ts.isFunctionDeclaration(node) && node.name) {
          const hasExport = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
          if (hasExport) exports.push({ name: node.name.text, kind: "function", line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
        } else if (ts.isVariableStatement(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
          for (const decl of node.declarationList.declarations) {
            if (ts.isIdentifier(decl.name)) exports.push({ name: decl.name.text, kind: "variable", line: sourceFile.getLineAndCharacterOfPosition(decl.getStart()).line + 1 });
          }
        } else if (ts.isClassDeclaration(node) && node.name) {
          const hasExport = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
          if (hasExport) exports.push({ name: node.name.text, kind: "class", line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
        } else if (ts.isInterfaceDeclaration(node)) {
          const hasExport = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
          if (hasExport) exports.push({ name: node.name.text, kind: "interface", line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
        } else if (ts.isTypeAliasDeclaration(node)) {
          const hasExport = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
          if (hasExport) exports.push({ name: node.name.text, kind: "type", line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
        } else if (ts.isEnumDeclaration(node)) {
          const hasExport = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
          if (hasExport) exports.push({ name: node.name.text, kind: "enum", line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
        }

        // Imports
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          const names: string[] = [];
          if (node.importClause?.name) names.push(node.importClause.name.text);
          if (node.importClause?.namedBindings) {
            if (ts.isNamedImports(node.importClause.namedBindings)) {
              for (const el of node.importClause.namedBindings.elements) names.push(el.name.text);
            } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
              names.push("* as " + node.importClause.namedBindings.name.text);
            }
          }
          imports.push({ source: node.moduleSpecifier.text, names, line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
        }

        // Function calls
        if (ts.isCallExpression(node) && node.expression) {
          const name = ts.isIdentifier(node.expression) ? node.expression.text
            : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : undefined;
          if (name) calls.push({ name, line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
        }

        ts.forEachChild(node, visit);
      });

      return json({ filePath, language: language ?? dotExt, exports, imports, calls });
    }
    case "detect_language": {
      const ext = (args.extension as string) ?? "";
      const dot = ext.startsWith(".") ? ext : "." + ext;
      const lang = detectLanguage(dot);
      return json({ extension: dot, language: lang, supported: isSupportedExtension(dot), category: TS_EXTENSIONS.includes(dot.toLowerCase()) ? "compiler-api" : TREE_SITTER_EXTENSIONS.includes(dot.toLowerCase()) ? "tree-sitter" : "unknown" });
    }

    // ── Indexer ────────────────────────────────────────────────────
    case "resolve_routes": {
      const r = await doAnalyze(args);
      const modules = getAllModules(r.repository);
      return json(resolveRoutes(modules));
    }
    case "resolve_components": {
      const r = await doAnalyze(args);
      const modules = getAllModules(r.repository);
      return json(resolveComponents(modules));
    }
    case "resolve_hooks": {
      const r = await doAnalyze(args);
      const modules = getAllModules(r.repository);
      return json(resolveHooks(modules));
    }
    case "resolve_providers": {
      const r = await doAnalyze(args);
      const modules = getAllModules(r.repository);
      return json(resolveProviders(modules));
    }

    // ── Rules (FIXED: was passing [] before, now passes ALL_RULES) ──
    case "run_rules": {
      const r = await doAnalyze(args);
      const frameworks = (args.frameworks as string[]) ?? (r.meta as any).frameworks ?? r.meta.detectedFrameworks ?? [];
      const violations = runRules(r.repository, ALL_RULES, frameworks);
      return json({ frameworks, violations, count: violations.length, rulesLoaded: ALL_RULES.length });
    }

    // ── Daemon ─────────────────────────────────────────────────────
    case "daemon_status": {
      const localPath = args.localPath as string;
      const status = getDaemonStatus(localPath);
      const health = status?.pid ? await getDaemonHealth(localPath) : null;
      return json({ status, health });
    }

    // ── DB ─────────────────────────────────────────────────────────
    case "db_repos": {
      return json(listRepos());
    }
    case "db_analyses": {
      return json(listAnalysesForRepo(args.repoId as string));
    }

    // ── DSL & Config ───────────────────────────────────────────────
    case "dsl": {
      return json(await runScriptSource(args.source as string));
    }
    case "config": {
      const r = await doAnalyze(args);
      return json({ meta: r.meta, dependencies: r.dependencies });
    }

    default:
      throw new Error("Unknown tool: " + name);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────
export async function startMcpServer(): Promise<void> {
  const server = new Server(
    { name: "arclux", version: "0.2.0" },
    { capabilities: { tools: {}, resources: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      return await handleTool(request.params.name, request.params.arguments ?? {});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text" as const, text: "Error: " + message }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ARCLUX MCP server running on stdio - " + TOOLS.length + " tools, " + DETECTOR_NAMES.length + " detectors, " + ALL_RULES.length + " rules");
}
