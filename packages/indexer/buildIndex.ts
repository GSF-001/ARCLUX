import { scanFiles } from "../parser/core/scanFiles";
import { parserRegistry } from "../parser/core/ParserRegistry";
import { resolvePath } from "../graph/resolvePath";
import { loadAliasConfig } from "./resolveAliases";
import { Repository } from "../repository/Repository";
import { readFileSync } from "node:fs";
import { AriesError } from "../shared/errors";
import type { RepositoryMeta, ModuleInfo, ParsedFile } from "../shared/types";

export interface BuildIndexOptions {
  rootPath: string;
  meta: Omit<RepositoryMeta, "analyzedAt">;
}

/**
 * Full indexing pass over a repository:
 * 1. scanFiles      -> list every relevant file
 * 2. parserRegistry  -> parse each file with the right language parser
 * 3. resolvePath     -> turn raw import strings into module ids (using tsconfig
 *                       path aliases from resolveAliases.ts, plus relative resolution)
 * 4. Repository      -> populated with ModuleInfo, importedBy back-references filled in
 *
 * This is a full rebuild. For incremental updates see watcher/changeQueue.ts + updateIndex.ts.
 */
export async function buildIndex(options: BuildIndexOptions): Promise<Repository> {
  const { rootPath, meta } = options;

  const files = scanFiles(rootPath);
  const knownFiles = new Set(files.map((f) => f.relativePath));
  const aliasConfig = loadAliasConfig(rootPath);
  const repository = new Repository({ ...meta, analyzedAt: new Date().toISOString() });

  // Pass 1: parse every file
  const parsedByPath = new Map<string, ParsedFile>();
  for (const file of files) {
    const parser = parserRegistry.getParserForExtension(file.extension);
    if (!parser) continue; // no parser registered yet for this language — skip, don't crash

    let content: string;
    try {
      content = readFileSync(file.absolutePath, "utf-8");
    } catch (err) {
      throw new AriesError({
        code: "PARSE_FAILED",
        message: `Could not read file for parsing`,
        filePath: file.relativePath,
        cause: err,
      });
    }

    const parsed = await parser.parse(file, content);
    parsedByPath.set(file.relativePath, parsed);
  }

  // Pass 2: build ModuleInfo with resolved import ids (but importedBy not filled yet)
  const modulesByPath = new Map<string, ModuleInfo>();
  for (const [relativePath, parsed] of parsedByPath) {
    const resolvedImportIds: string[] = [];

    for (const rawImport of parsed.imports) {
      const resolution = resolvePath(relativePath, rawImport.source, knownFiles, aliasConfig);
      if (resolution.type === "internal") {
        resolvedImportIds.push(resolution.moduleId);
      }
      // external packages intentionally not added as modules — they're graph nodes, not repo modules
    }

    modulesByPath.set(relativePath, {
      id: relativePath,
      file: parsed.file,
      exports: parsed.exports,
      imports: resolvedImportIds,
      importedBy: [], // filled in pass 3
    });
  }

  // Pass 3: back-fill importedBy so consumers can be queried in O(1)
  for (const module of modulesByPath.values()) {
    for (const importedId of module.imports) {
      const target = modulesByPath.get(importedId);
      if (target) {
        target.importedBy.push(module.id);
      }
    }
  }

  for (const module of modulesByPath.values()) {
    repository.addModule(module);
  }

  return repository;
}
