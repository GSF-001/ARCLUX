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
import { buildFolderGraph } from "../../graph/buildFolderGraph.ts";

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
import { detectLanguage, isSupportedExtension, getExtensionsForLanguage } from "../../parser/core/LanguageDetector.ts";
import { parserRegistry } from "../../parser/core/ParserRegistry.ts";

// ── indexer ───────────────────────────────────────────────────────────────
import { resolveRoutes } from "../../indexer/resolveRoutes.ts";
import { resolveComponents } from "../../indexer/resolveComponents.ts";
import { resolveHooks } from "../../indexer/resolveHooks.ts";
import { resolveProviders } from "../../indexer/resolveProviders.ts";
import { buildIndex } from "../../indexer/buildIndex.ts";

// ── rules ─────────────────────────────────────────────────────────────────
import { runRules, type Rule, type RuleViolation } from "../../rules/RuleEngine.ts";

// ── daemon ────────────────────────────────────────────────────────────────
import { getDaemonStatus, getDaemonHealth } from "../../daemon/DaemonProcess.ts";

// ── db ────────────────────────────────────────────────────────────────────
import { listRepos, getRepo } from "../../db/repositories/RepoStore.ts";
import { listAnalysesForRepo, getAnalysis } from "../../db/repositories/AnalysisStore.ts";

// ── cache ─────────────────────────────────────────────────────────────────
import { getCacheStats, clearAllCaches } from "../../cache/CacheProvider.ts";

// ── detectors (import ALL for registry-driven detect tool) ─────────────────
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

// ──────────────────────────────────────────────────────────────────────────
// Registry-driven detector map — auto-discovers all detectors
// ──────────────────────────────────────────────────────────────────────────
const DETECTOR_MAP: Record<string, (repo: any) => any[]> = {
  circular:               detectCircularDependency,
  unused_exports:         detectUnusedExports,
  orphan_files:           detectOrphanFiles,
  orphan_integration:     detectOrphanIntegration,
  large_modules:          detectLargeModules,
  duplicate_modules:      detectDuplicateModules,
  shared_modules:         detectSharedModules,
  index_files:            detectIndexFiles,
  layer_violation:        detectLayerViolation,
  dead_code:              detectDeadCode,
  ambiguous_symbols:      detectAmbiguousSymbolResolution,
  component_convention:   detectComponentConvention,
  feature_structure:      detectFeatureStructure,
  missing_exports:        detectMissingExports,
  repository_pattern:     detectRepositoryPattern,
  route_convention:       detectRouteConvention,
  story_convention:       detectStoryConvention,
  test_convention:        detectTestConvention,
  unused_files:           detectUnusedFiles,
  entry_points:           detectEntryPoints,
};

// Auto-build detector list description for the `detect` tool
const DETECTOR_NAMES = Object.keys(DETECTOR_MAP);

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────
function analyzeOpts(args: Record<string, unknown>) {
  if (args.localPath) return { localPath: args.localPath as string };
  if (args.repoUrl) return { repoUrl: args.repoUrl as string, branch: args.branch as string | undefined };
  throw new Error("Provide repoUrl or localPath");
}

async function doAnalyze(args: Record<string, unknown>) {
  return analyzeRepository(analyzeOpts(args));
}

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

async function withClone(repoUrl: string, branch: string | undefined, fn: (localPath: string) => Promise<any>) {
  const clone = await cloneRepository({ url: repoUrl, branch });
  try {
    return await fn(clone.localPath);
  } finally {
    await cleanupRepository(clone.localPath);
  }
}

function resolveFile(moduleId: string, repository: any) {
  const mod = repository.getModuleById(moduleId)
    ?? repository.getModuleByPath(moduleId);
  if (!mod) throw new Error("Module not found: " + moduleId);
  return mod;
}

function getAllModules(repository: any) {
  return repository.getAllModules ? repository.getAllModules() : [];
}

// ──────────────────────────────────────────────────────────────────────────
// Tool definitions (30 tools)
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
    description: "Run all 20 architecture detectors. Returns findings with checkId, severity, filePath, message.",
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
    description: "Run 10 core detectors + 14 framework rules, return PASS/FAIL verdict.",
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
    description: "Parse a single file and return its symbols (exports, imports, calls). Auto-detects language.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
        filePath:  { type: "string", description: "Relative file path" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "detect_language",
    description: "Detect programming language from file extension. Returns language name and whether ARCLUX supports it.",
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
    description: "Run framework-specific rules (nextjs/nestjs/express/vite/electron/react/laravel). Returns violations.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
        frameworks: { type: "array", items: { type: "string" }, description: "Filter by framework (e.g. [\"nextjs\"]). Empty = all detected." },
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
      return json(buildFolderGraph(r.repository));
    }

    // ── Impact ─────────────────────────────────────────────────────
    case "impact": {
      const r = await doAnalyze(args);
      const mid = args.moduleId as string;
      return json({
        tree: buildImpactTree(r.repository, mid),
        affectedFiles: calculateAffectedFiles(r.repository, mid),
        affectedRoutes: calculateAffectedRoutes(r.repository, mid),
      });
    }
    case "impact_consumers": {
      const r = await doAnalyze(args);
      return json(traceConsumers(r.repository, args.moduleId as string));
    }
    case "impact_dependencies": {
      const r = await doAnalyze(args);
      return json(traceDependencies(r.repository, args.moduleId as string));
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
        if (!fn) { results[n] = { error: "Unknown: " + n }; continue; }
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
      return json({
        moduleId: mod.id, filePath: mod.file.relativePath,
        exports: mod.exports.map((e: any) => ({ name: e.name, kind: e.kind })),
        imports: mod.imports.map((i: any) => ({ source: i.source, names: i.names })),
        calls: mod.calls.map((c: any) => c.name),
        dependencies: listDependencyTargets(r.repository, mod.id),
        consumers: listDirectConsumerTargets(r.repository, mod.id),
      });
    }

    // ── Parser ─────────────────────────────────────────────────────
    case "parse_file": {
      const r = await doAnalyze(args);
      const mod = resolveFile(args.filePath as string, r.repository);
      return json({
        moduleId: mod.id, filePath: mod.file.relativePath,
        language: mod.file.language,
        exports: mod.exports.map((e: any) => ({ name: e.name, kind: e.kind, line: e.line })),
        imports: mod.imports.map((i: any) => ({ source: i.source, names: i.names, line: i.line })),
        calls: mod.calls.map((c: any) => ({ name: c.name, line: c.line })),
      });
    }
    case "detect_language": {
      const ext = (args.extension as string) ?? "";
      const dot = ext.startsWith(".") ? ext : "." + ext;
      const lang = detectLanguage(dot);
      return json({ extension: dot, language: lang, supported: isSupportedExtension(dot) });
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

    // ── Rules ──────────────────────────────────────────────────────
    case "run_rules": {
      const r = await doAnalyze(args);
      const frameworks = (args.frameworks as string[]) ?? r.meta.frameworks ?? [];
      const violations = runRules(r.repository, [], frameworks);
      return json({ frameworks, violations, count: violations.length });
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
  console.error("ARCLUX MCP server running on stdio - " + TOOLS.length + " tools ready");
}
