/**
 * Copyright 2026 ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * The ARCLUX interactive session: analyze a repo ONCE, then answer
 * questions about it instantly — no re-index per query (local-path CLI
 * commands re-run analyzeRepository() every invocation; the shell keeps
 * the Repository in memory, so impact/doctor/search/graph are O(1)-ish).
 *
 * Command surface (meant to feel like a prompt, not a CLI):
 *   <path>                    analyze a repo (bare path = analyze)
 *   analyze <path>            same, explicit
 *   impact <file>             affected files if <file> changes
 *   deps <file>               what <file> imports
 *   consumers <file>          who imports <file>
 *   graph [file]              module/edge counts, or a file's neighbors
 *   doctor                    run the 19-detector suite
 *   search <query>            fuzzy filename/export search
 *   plugins                   list user-space plugins
 *   run <plugin> [args...]    run a user-space plugin against the session
 *   system                    workspace/system snapshot (kernel state)
 *   watch on|off              pick up file edits automatically (re-analyze
 *                             only when the tree actually changed)
 *   help                      command list
 *   exit / .exit              leave
 *
 * The REPL plumbing (node:repl) lives in apps/cli/shell.ts; this class
 * is pure command logic, so it is testable without a terminal.
 */

import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { analyzeRepository, type AnalyzeRepositoryResult } from "../engine/pipeline";
import { runDoctor } from "../engine/runDoctor";
import { calculateAffectedFiles } from "../impact/calculateAffectedFiles";
import { buildSearchIndex } from "../search/SearchIndex";
import { search } from "../search/SearchEngine";
import { buildDependencyGraph } from "../graph/buildDependencyGraph";
import { watchRepository, type RepositoryWatcher } from "../watcher/watchRepository";
import { Kernel } from "../kernel/Kernel";
import { SystemManager } from "../system/SystemManager";
import type { Repository } from "../repository/Repository";
import type { DependencyGraph, RepositoryMeta } from "../shared/types";
import { loadPlugins, type ArcluxPluginContext, type LoadedPlugin } from "./plugins";

export interface ShellCommandResult {
  /** Lines to print to the terminal. */
  output: string[];
  /** True when the user wants to leave the session. */
  exit?: boolean;
}

export class ArcluxShell {
  private repository: Repository | null = null;
  private graph: DependencyGraph | null = null;
  private meta: RepositoryMeta | null = null;
  private rootPath = "";
  private plugins: LoadedPlugin[] = [];
  private watcher: RepositoryWatcher | null = null;

  constructor(private readonly pluginsDir?: string) {}

  /** The current repo's display name for the prompt (e.g. "flask"). */
  get promptLabel(): string {
    return this.meta?.name ?? "arclux";
  }

  /** True while `watch on` is active — the prompt shows a `*` suffix. */
  get watchActive(): boolean {
    return this.watcher !== null;
  }

  /** Closes the watcher and any other resources. Idempotent. */
  async dispose(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  private applyResult(result: AnalyzeRepositoryResult): void {
    this.repository = result.repository;
    this.graph = result.graph;
    this.meta = result.meta;
  }

  /**
   * While watching, pulls the latest analysis from the watcher BEFORE a
   * query — instant on cache hit (tree unchanged), full re-analyze only
   * when the tree actually changed (the watcher's debounced ChangeQueue
   * decides). This is the "edit file → next query sees it" experience.
   */
  private async refreshFromWatcher(): Promise<void> {
    if (!this.watcher) return;
    this.applyResult(await this.watcher.getAnalysis());
  }

  async analyze(rootPath: string): Promise<ShellCommandResult> {
    await this.dispose();
    const expanded = rootPath === "~" ? homedir() : rootPath.startsWith("~/") ? join(homedir(), rootPath.slice(2)) : rootPath;
    const resolved = resolve(expanded);
    const result: AnalyzeRepositoryResult = await analyzeRepository({ localPath: resolved });
    this.applyResult(result);
    this.rootPath = resolved;
    return {
      output: [
        `Repository: ${result.meta.name}`,
        `Modules: ${result.moduleCount}`,
        `Graph: ${result.graph.nodes.length} nodes, ${result.graph.edges.length} edges`,
        `Scan: ${result.scanSummary.filesScanned} files, ${result.scanSummary.filesParsed} parsed, ${result.scanSummary.filesSkippedNoParser} skipped (no parser)`,
      ],
    };
  }

  async handleCommand(line: string): Promise<ShellCommandResult> {
    const trimmed = line.trim();
    if (!trimmed) return { output: [] };

    const [rawCommand, ...rest] = trimmed.split(/\s+/);
    const command = rawCommand.toLowerCase();
    const arg = rest.join(" ");

    switch (command) {
      case "exit":
      case "quit":
      case ".exit":
        return { output: ["Bye."], exit: true };

      case "help":
        return { output: this.helpText() };

      case "analyze":
        if (!arg) return { output: ["usage: analyze <path>"] };
        return this.analyze(arg);

      case "impact": {
        if (!this.repository) return { output: ["no repo — analyze <path> first"] };
        await this.refreshFromWatcher();
        if (!arg) return { output: ["usage: impact <file>"] };
        const module = this.repository.getModule(arg);
        if (!module) return { output: [`module not found: ${arg}`] };
        const result = calculateAffectedFiles(this.repository, module.id);
        return {
          output: [
            `Direct consumers: ${module.importedBy.length}`,
            ...module.importedBy.map((id) => `  ${id}`),
            `Affected total: ${result.totalAffected}`,
            ...result.affectedFiles.slice(0, 20).map((f) => `  [dist ${f.distance}] ${f.moduleId}`),
          ],
        };
      }

      case "deps": {
        if (!this.repository) return { output: ["no repo — analyze <path> first"] };
        await this.refreshFromWatcher();
        if (!arg) return { output: ["usage: deps <file>"] };
        const module = this.repository.getModule(arg);
        if (!module) return { output: [`module not found: ${arg}`] };
        return { output: [`imports (${module.imports.length}):`, ...module.imports.map((id) => `  ${id}`)] };
      }

      case "consumers": {
        if (!this.repository) return { output: ["no repo — analyze <path> first"] };
        await this.refreshFromWatcher();
        if (!arg) return { output: ["usage: consumers <file>"] };
        const module = this.repository.getModule(arg);
        if (!module) return { output: [`module not found: ${arg}`] };
        return { output: [`imported by (${module.importedBy.length}):`, ...module.importedBy.map((id) => `  ${id}`)] };
      }

      case "graph": {
        if (!this.repository) return { output: ["no repo — analyze <path> first"] };
        await this.refreshFromWatcher();
        if (arg) {
          const module = this.repository.getModule(arg);
          if (!module) return { output: [`module not found: ${arg}`] };
          return {
            output: [
              `${arg}:`,
              `  imports: ${module.imports.length}`,
              `  imported by: ${module.importedBy.length}`,
              `  calls: ${module.calls.length}`,
              `  called by: ${module.calledBy.length}`,
            ],
          };
        }
        const graph = this.graph ?? buildDependencyGraph(this.repository);
        return { output: [`${graph.nodes.length} nodes, ${graph.edges.length} edges`] };
      }

      case "doctor": {
        if (!this.repository) return { output: ["no repo — analyze <path> first"] };
        await this.refreshFromWatcher();
        const result = runDoctor(this.repository);
        const byCheck = new Map<string, number>();
        for (const f of result.findings) byCheck.set(f.checkId, (byCheck.get(f.checkId) ?? 0) + 1);
        return {
          output: [
            `${result.errorCount} error(s), ${result.warningCount} warning(s), ${result.infoCount} info`,
            ...[...byCheck.entries()].map(([id, count]) => `  ${id}: ${count}`),
          ],
        };
      }

      case "search": {
        if (!this.repository) return { output: ["no repo — analyze <path> first"] };
        await this.refreshFromWatcher();
        if (!arg) return { output: ["usage: search <query>"] };
        const index = buildSearchIndex(this.repository);
        const results = search(index, arg, { limit: 20 });
        if (results.length === 0) return { output: ["no matches"] };
        return {
          output: results.map((r) => `  ${String(r.score).padStart(3)}  ${r.filePath}`),
        };
      }

      case "plugins": {
        await this.ensurePlugins();
        if (this.plugins.length === 0) return { output: ["no plugins — drop *.ts files into ~/.arclux/plugins/"] };
        return { output: this.plugins.map((p) => `  ${p.name}${p.description ? ` — ${p.description}` : ""}`) };
      }

      case "run": {
        if (!arg) return { output: ["usage: run <plugin> [args...]"] };
        await this.ensurePlugins();
        const [pluginName, ...pluginArgs] = rest;
        const plugin = this.plugins.find((p) => p.name === pluginName);
        if (!plugin) {
          return { output: [`plugin not found: ${pluginName}. Available: ${this.plugins.map((p) => p.name).join(", ")}`] };
        }
        const lines: string[] = [];
        const ctx: ArcluxPluginContext = {
          repository: this.repository,
          graph: this.graph,
          meta: this.meta,
          rootPath: this.rootPath,
          log: (message) => lines.push(message),
        };
        try {
          await plugin.run(ctx);
        } catch (err) {
          lines.push(`[plugin error] ${err instanceof Error ? err.message : String(err)}`);
        }
        return { output: lines.length > 0 ? lines : [`${plugin.name} ran with no output`] };
      }

      case "system": {
        const kernel = new Kernel();
        const manager = new SystemManager({ kernel });
        const state = manager.snapshot();
        return {
          output: [
            `workspaces: ${state.workspaces.length}`,
            `processes: ${state.processes.length}`,
            `services: ${state.services.length}`,
            `jobs: ${state.jobs.length}`,
            `health: ${state.health.overall}`,
          ],
        };
      }

      case "watch": {
        if (!this.repository) return { output: ["no repo — analyze <path> first"] };
        const action = arg.toLowerCase();
        if (action === "on") {
          if (this.watcher) return { output: ["watch already on"] };
          this.watcher = watchRepository(this.rootPath);
          await this.refreshFromWatcher();
          return { output: ["watch on — file edits are picked up on the next query"] };
        }
        if (action === "off") {
          if (!this.watcher) return { output: ["watch already off"] };
          await this.watcher.close();
          this.watcher = null;
          return { output: ["watch off"] };
        }
        return { output: [this.watcher ? "watch is on" : "watch is off", 'usage: watch on|off'] };
      }

      default: {
        // A bare path (no command prefix) means "analyze this repo" —
        // the prompt-first experience: `arclux~$ flask/`.
        if (rawCommand.startsWith(".") || rawCommand.startsWith("/") || rawCommand.includes("/") || rawCommand.endsWith("/")) {
          return this.analyze(trimmed);
        }
        return { output: [`unknown command: ${rawCommand} — try "help"`] };
      }
    }
  }

  private async ensurePlugins(): Promise<void> {
    if (this.plugins.length > 0) return;
    this.plugins = await loadPlugins({ dir: this.pluginsDir });
  }

  private helpText(): string[] {
    return [
      "  <path>            analyze a repository (bare path)",
      "  analyze <path>    same, explicit",
      "  impact <file>     affected files if <file> changes",
      "  deps <file>       what <file> imports",
      "  consumers <file>  who imports <file>",
      "  graph [file]      graph summary or a file's neighbors",
      "  doctor            run all detectors",
      "  search <query>    fuzzy search over paths/exports",
      "  watch on|off      re-analyze automatically when files change",
      "  plugins           list user-space plugins",
      "  run <plugin>      run a plugin",
      "  system            workspace/system snapshot",
      "  help / exit",
    ];
  }
}