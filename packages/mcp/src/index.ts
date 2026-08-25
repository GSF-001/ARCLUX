// Copyright 2026 Mikatoshi
// Licensed under the Apache License, Version 2.0
//
// ARCLUX MCP Server — 21 tools covering the full analysis engine.
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

// ── detectors ─────────────────────────────────────────────────────────────
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

// ── cache ─────────────────────────────────────────────────────────────────
import { getCacheStats, clearAllCaches } from "../../cache/CacheProvider.ts";

// ──────────────────────────────────────────────────────────────────────────
// Detector registry
// ──────────────────────────────────────────────────────────────────────────
const DETECTORS: Record<string, (repo: any) => any[]> = {
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

// ──────────────────────────────────────────────────────────────────────────
// Tool definitions (21 tools)
// ──────────────────────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "analyze",
    description: "Full analysis pipeline - parse all files, build index, build dependency graph, detect frameworks. Returns meta, moduleCount, graph stats, scanSummary, dependencies.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string", description: "Git URL to clone and analyze" },
        localPath: { type: "string", description: "Local filesystem path to analyze (no clone)" },
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
    description: "Compute health score with 4 categories (structural, hygiene, conventions, info). Returns overall score 0-100 + per-category breakdown.",
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
    description: "Run diagnostic adapters (circular, dead code, ambiguous symbols), attach impact context, return events with fix suggestions.",
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
    name: "callgraph",
    description: "Build function call graph. Returns nodes (functions) and edges (caller to callee).",
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
    description: "Build import dependency graph. Returns nodes and edges.",
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
    description: "Build export relationship graph - who exports what, who imports where from.",
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
    description: "Build directory tree structure with file counts per folder.",
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
    name: "impact",
    description: "Full impact analysis for a file - dependency tree, affected files list, affected routes.",
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
    description: "Trace all direct and transitive consumers of a module (who calls this).",
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
    description: "Trace all direct and transitive dependencies of a module (what does this call).",
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
    name: "security",
    description: "Full security analysis - hardcoded secrets, unsafe patterns, trust boundaries, cross-boundary calls, dependency risk. Includes attack surface map.",
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
    name: "search",
    description: "Fuzzy search for symbols, files, or code patterns across the repository.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
        query:     { type: "string", description: "Search query" },
        limit:     { type: "number", description: "Max results (default 50)" },
      },
      required: ["query"],
    },
  },
  {
    name: "detect",
    description: "Run specific detector(s) by name. Available: circular, unused_exports, orphan_files, orphan_integration, large_modules, duplicate_modules, shared_modules, index_files, layer_violation, dead_code, ambiguous_symbols, component_convention, feature_structure, missing_exports, repository_pattern, route_convention, story_convention, test_convention, unused_files, entry_points. Use [\"all\"] for all.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
        detectors: {
          type: "array",
          items: { type: "string" },
          description: "Detector names to run",
        },
      },
      required: ["detectors"],
    },
  },
  {
    name: "diff",
    description: "Architectural diff between two git refs - lists changed files and traces affected consumers.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
        refA:      { type: "string", description: "First git ref (commit, tag, branch)" },
        refB:      { type: "string", description: "Second git ref" },
      },
      required: ["refA", "refB"],
    },
  },
  {
    name: "branches",
    description: "List remote branches for a repository. Returns branch names and default branch.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl: { type: "string", description: "Git URL" },
      },
      required: ["repoUrl"],
    },
  },
  {
    name: "history",
    description: "Get commit history and contributors. Clones repo shallowly, reads git log, then cleans up.",
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
  {
    name: "file_info",
    description: "Get module info for a file - exports, imports, calls, dependency targets, and direct consumers.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repoUrl:   { type: "string" },
        localPath: { type: "string" },
        branch:    { type: "string" },
        filePath:  { type: "string", description: "Relative file path in the repo" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "dsl",
    description: "Execute an ARCLUX DSL script. The script should call analyze(\"url\") or analyze(\"/path\") internally.",
    inputSchema: {
      type: "object" as const,
      properties: {
        source: { type: "string", description: "DSL source code" },
      },
      required: ["source"],
    },
  },
  {
    name: "config",
    description: "Detect repository metadata - name, frameworks, package manager, root path.",
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

    case "impact": {
      const r = await doAnalyze(args);
      return json({
        tree: buildImpactTree(r.repository, args.moduleId as string),
        affectedFiles: calculateAffectedFiles(r.repository, args.moduleId as string),
        affectedRoutes: calculateAffectedRoutes(r.repository, args.moduleId as string),
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

    case "security": {
      const r = await doAnalyze(args);
      const sec = analyzeRepositorySecurity(r.repository, r.meta.rootPath);
      const graph = buildCallGraph(r.repository);
      return json({ security: sec, attackSurface: mapAttackSurface(r.repository, graph) });
    }

    case "search": {
      const r = await doAnalyze(args);
      const idx = buildSearchIndex(r.repository);
      return json(search(idx, args.query as string, { limit: (args.limit as number) ?? 50 }));
    }

    case "detect": {
      const r = await doAnalyze(args);
      const names = (args.detectors as string[]) ?? [];
      const runAll = names.includes("all");
      const targets = runAll ? Object.keys(DETECTORS) : names;
      const results: Record<string, any> = {};
      let total = 0;
      for (const n of targets) {
        const fn = DETECTORS[n];
        if (!fn) {
          results[n] = { error: "Unknown detector: " + n + ". Available: " + Object.keys(DETECTORS).join(", ") };
          continue;
        }
        const findings = fn(r.repository);
        results[n] = { count: findings.length, findings };
        total += findings.length;
      }
      return json({ totalFindings: total, detectors: results });
    }

    case "diff": {
      const r = await doAnalyze(args);
      return json(computeArchitecturalDiff(r.repository, r.meta.rootPath, args.refA as string, args.refB as string));
    }

    case "branches": {
      return json({
        branches: getBranches(args.repoUrl as string),
        defaultBranch: detectDefaultBranch(args.repoUrl as string),
      });
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
// Public API — called by `arclux mcp` CLI command
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
  console.error("ARCLUX MCP server running on stdio - 21 tools ready");
}
