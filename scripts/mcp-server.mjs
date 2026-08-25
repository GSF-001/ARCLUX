// Copyright 2026 Mikatoshi
// Licensed under the Apache License, Version 2.0
//
// ARCLUX MCP Server — exposes the full analysis engine as MCP tools.
// Run with: npx tsx scripts/mcp-server.mjs
// Client config: { "arclux": { "command": "npx", "args": ["tsx", "scripts/mcp-server.mjs"] } }

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// ── engine ────────────────────────────────────────────────────────────────
import { analyzeRepository } from "../packages/engine/pipeline.ts";
import { runDoctor } from "../packages/engine/runDoctor.ts";
import { runAllChecks } from "../packages/engine/contract.ts";
import { computeHealthScore } from "../packages/engine/healthScore.ts";

// ── graph ─────────────────────────────────────────────────────────────────
import { buildCallGraph } from "../packages/graph/buildCallGraph.ts";
import { buildDependencyGraph } from "../packages/graph/buildDependencyGraph.ts";
import { buildExportGraph } from "../packages/graph/buildExportGraph.ts";
import { buildFolderGraph } from "../packages/graph/buildFolderGraph.ts";

// ── impact ────────────────────────────────────────────────────────────────
import { buildImpactTree } from "../packages/impact/buildImpactTree.ts";
import { calculateAffectedFiles } from "../packages/impact/calculateAffectedFiles.ts";
import { calculateAffectedRoutes } from "../packages/impact/calculateAffectedRoutes.ts";
import { traceConsumers } from "../packages/impact/traceConsumers.ts";
import { traceDependencies } from "../packages/impact/traceDependencies.ts";

// ── security ──────────────────────────────────────────────────────────────
import { analyzeRepositorySecurity } from "../packages/security-analysis/integration.ts";
import { mapAttackSurface } from "../packages/correlation/AttackSurfaceMapper.ts";

// ── search ────────────────────────────────────────────────────────────────
import { buildSearchIndex } from "../packages/search/SearchIndex.ts";
import { search } from "../packages/search/SearchEngine.ts";

// ── diagnostics ───────────────────────────────────────────────────────────
import { runDiagnostics } from "../packages/diagnostics/DiagnosticEngine.ts";
import { getFixSuggestions } from "../packages/diagnostics/FixSuggestion.ts";

// ── diff ──────────────────────────────────────────────────────────────────
import { computeArchitecturalDiff } from "../packages/diff/architecturalDiff.ts";

// ── git ───────────────────────────────────────────────────────────────────
import { cloneRepository } from "../packages/git/cloneRepository.ts";
import { cleanupRepository } from "../packages/git/cleanupRepository.ts";
import { getBranches } from "../packages/git/getBranches.ts";
import { detectDefaultBranch } from "../packages/git/detectDefaultBranch.ts";
import { getCommitHistory } from "../packages/git/getCommitHistory.ts";
import { getContributors } from "../packages/git/getContributors.ts";

// ── editor ────────────────────────────────────────────────────────────────
import { openFile, listDependencyTargets, listDirectConsumerTargets } from "../packages/editor/CodeNavigator.ts";

// ── dsl ───────────────────────────────────────────────────────────────────
import { runScriptSource } from "../packages/dsl/script.ts";

// ── detectors (for the `detect` tool) ─────────────────────────────────────
import { detectCircularDependency } from "../packages/detectors/detectCircularDependency.ts";
import { detectUnusedExports } from "../packages/detectors/detectUnusedExports.ts";
import { detectOrphanFiles } from "../packages/detectors/detectOrphanFiles.ts";
import { detectOrphanIntegration } from "../packages/detectors/detectOrphanIntegration.ts";
import { detectLargeModules } from "../packages/detectors/detectLargeModules.ts";
import { detectDuplicateModules } from "../packages/detectors/detectDuplicateModules.ts";
import { detectSharedModules } from "../packages/detectors/detectSharedModules.ts";
import { detectIndexFiles } from "../packages/detectors/detectIndexFiles.ts";
import { detectLayerViolation } from "../packages/detectors/detectLayerViolation.ts";
import { detectDeadCode } from "../packages/detectors/detectDeadCode.ts";
import { detectAmbiguousSymbolResolution } from "../packages/detectors/detectAmbiguousSymbolResolution.ts";
import { detectComponentConvention } from "../packages/detectors/detectComponentConvention.ts";
import { detectFeatureStructure } from "../packages/detectors/detectFeatureStructure.ts";
import { detectMissingExports } from "../packages/detectors/detectMissingExports.ts";
import { detectRepositoryPattern } from "../packages/detectors/detectRepositoryPattern.ts";
import { detectRouteConvention } from "../packages/detectors/detectRouteConvention.ts";
import { detectStoryConvention } from "../packages/detectors/detectStoryConvention.ts";
import { detectTestConvention } from "../packages/detectors/detectTestConvention.ts";
import { detectUnusedFiles } from "../packages/detectors/detectUnusedFiles.ts";
import { detectEntryPoints } from "../packages/detectors/detectEntryPoints.ts";

// ── cache ─────────────────────────────────────────────────────────────────
import { getCacheStats, clearAllCaches } from "../packages/cache/CacheProvider.ts";

// ──────────────────────────────────────────────────────────────────────────
// Detector registry — name => function(repository) => finding[]
// ──────────────────────────────────────────────────────────────────────────
const DETECTORS = {
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
function analyzeOpts(args) {
  if (args.localPath) return { localPath: args.localPath };
  if (args.repoUrl) return { repoUrl: args.repoUrl, branch: args.branch };
  throw new Error("Provide repoUrl or localPath");
}

async function doAnalyze(args) {
  return analyzeRepository(analyzeOpts(args));
}

function json(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

async function withClone(repoUrl, branch, fn) {
  const clone = await cloneRepository({ url: repoUrl, branch });
  try {
    return await fn(clone.localPath);
  } finally {
    await cleanupRepository(clone.localPath);
  }
}

function resolveFile(moduleId, repository) {
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
      type: "object",
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
      type: "object",
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
      type: "object",
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
      type: "object",
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
      type: "object",
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
      type: "object",
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
      type: "object",
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
      type: "object",
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
      type: "object",
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
      type: "object",
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
      type: "object",
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
      type: "object",
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
      type: "object",
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
      type: "object",
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
      type: "object",
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
      type: "object",
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
      type: "object",
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
      type: "object",
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
      type: "object",
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
      type: "object",
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
      type: "object",
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
async function handleTool(name, args) {
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
        tree: buildImpactTree(r.repository, args.moduleId),
        affectedFiles: calculateAffectedFiles(r.repository, args.moduleId),
        affectedRoutes: calculateAffectedRoutes(r.repository, args.moduleId),
      });
    }

    case "impact_consumers": {
      const r = await doAnalyze(args);
      return json(traceConsumers(r.repository, args.moduleId));
    }

    case "impact_dependencies": {
      const r = await doAnalyze(args);
      return json(traceDependencies(r.repository, args.moduleId));
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
      return json(search(idx, args.query, { limit: args.limit ?? 50 }));
    }

    case "detect": {
      const r = await doAnalyze(args);
      const names = args.detectors ?? [];
      const runAll = names.includes("all");
      const targets = runAll ? Object.keys(DETECTORS) : names;
      const results = {};
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
      return json(computeArchitecturalDiff(r.repository, r.meta.rootPath, args.refA, args.refB));
    }

    case "branches": {
      return json({
        branches: getBranches(args.repoUrl),
        defaultBranch: detectDefaultBranch(args.repoUrl),
      });
    }

    case "history": {
      const fn = async (localPath) => {
        const commits = await getCommitHistory(localPath, { maxCount: args.maxCount ?? 20, branch: args.branch });
        const contributors = await getContributors(localPath);
        return { commits, contributors };
      };
      const result = args.localPath ? await fn(args.localPath) : await withClone(args.repoUrl, args.branch, fn);
      return json(result);
    }

    case "file_info": {
      const r = await doAnalyze(args);
      const mod = resolveFile(args.filePath, r.repository);
      return json({
        moduleId: mod.id, filePath: mod.file.relativePath,
        exports: mod.exports.map(e => ({ name: e.name, kind: e.kind })),
        imports: mod.imports.map(i => ({ source: i.source, names: i.names })),
        calls: mod.calls.map(c => c.name),
        dependencies: listDependencyTargets(r.repository, mod.id),
        consumers: listDirectConsumerTargets(r.repository, mod.id),
      });
    }

    case "dsl": {
      return json(await runScriptSource(args.source));
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
// Server
// ──────────────────────────────────────────────────────────────────────────
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
    return { content: [{ type: "text", text: "Error: " + message }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ARCLUX MCP server running on stdio - 21 tools ready");
}

main().catch((error) => { console.error("Fatal error:", error); process.exit(1); });
