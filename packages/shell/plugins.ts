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
 * User-space plugin contract for ARCLUX sessions. A plugin is ONE
 * TypeScript file dropped into ~/.arclux/plugins/ (or any dir passed to
 * loadPlugins). ARCLUX itself has no idea what a plugin does — the
 * plugin gets the structural context and builds its own feature on top,
 * the same way a user-space program runs on Linux without the kernel
 * knowing what it does.
 *
 * Plugin file shape (default export):
 *
 *   import type { ArcluxPlugin } from "@arclux/shell";
 *
 *   export default {
 *     name: "my-tool",
 *     run: async (ctx) => {
 *       ctx.log("modules: " + (ctx.repository?.moduleCount ?? 0));
 *     },
 *   } satisfies ArcluxPlugin;
 */

import { readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Repository } from "../repository/Repository";
import type { DependencyGraph, RepositoryMeta } from "../shared/types";
import type { RepositoryQuery } from "./query";
import type { SessionSnapshot } from "./session";

/** What a plugin receives when run. This is the stable "user-space API". */
export interface ArcluxPluginContext {
  /** The analyzed repo in memory, or null if the session has no repo yet. */
  repository: Repository | null;
  /** The dependency graph of the current repo, or null. */
  graph: DependencyGraph | null;
  /** Repository metadata (org/name/frameworks/packageManager...), or null. */
  meta: RepositoryMeta | null;
  /** Absolute path of the session's current root, or "" if none. */
  rootPath: string;
  /** Command-line style arguments passed after the plugin name. */
  args: string[];
  /** Universal structural query surface over the current repo. */
  query: RepositoryQuery;
  /** The live session: environment + workspace + processes + services. */
  session: SessionSnapshot;
  /** Write a line to the session output. */
  log(message: string): void;
}

export interface ArcluxPlugin {
  name: string;
  description?: string;
  run(ctx: ArcluxPluginContext): Promise<void> | void;
}

export interface LoadedPlugin {
  name: string;
  description?: string;
  run(ctx: ArcluxPluginContext): Promise<void> | void;
  /** Absolute path of the plugin file — where it was loaded from. */
  filePath: string;
}

function defaultPluginsDir(): string {
  return join(homedir(), ".arclux", "plugins");
}

export interface LoadPluginsOptions {
  /** Plugin directory to scan. Defaults to ~/.arclux/plugins. */
  dir?: string;
  /** Known plugin files — injectable for tests. */
  fileNames?: string[];
}

/**
 * Scans a plugin directory for *.ts files, dynamically imports each one,
 * and validates it exposes a default export matching ArcluxPlugin.
 * A plugin file that fails to load is skipped with the error surfaced —
 * one bad plugin must not break the whole session (same crash-isolation
 * rule as runDoctor's safeRun).
 */
export async function loadPlugins(options: LoadPluginsOptions = {}): Promise<LoadedPlugin[]> {
  const dir = resolve(options.dir ?? defaultPluginsDir());
  const plugins: LoadedPlugin[] = [];

  let fileNames: string[];
  try {
    fileNames = options.fileNames ?? readdirSync(dir).filter((f) => f.endsWith(".ts"));
  } catch {
    // Directory doesn't exist yet — no plugins, not an error.
    return [];
  }

  for (const fileName of fileNames) {
    const filePath = join(dir, fileName);
    try {
      const mod = (await import(pathToFileURL(filePath).href)) as {
        default?: unknown;
      };
      const plugin = mod.default as ArcluxPlugin | undefined;
      if (!plugin || typeof plugin.run !== "function" || typeof plugin.name !== "string") {
        console.error(`[shell] plugin ${fileName}: missing default export { name, run(ctx) } — skipped`);
        continue;
      }
      plugins.push({ name: plugin.name, description: plugin.description, run: plugin.run, filePath });
    } catch (err) {
      console.error(
        `[shell] plugin ${fileName} failed to load: ${err instanceof Error ? err.message : String(err)} — skipped`
      );
    }
  }

  return plugins;
}