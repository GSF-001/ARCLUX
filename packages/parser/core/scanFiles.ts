import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { readGitignore } from "../../git/readGitignore";
import { EXTENSION_TO_LANGUAGE } from "../../shared/constants";
import { hashContent } from "../../shared/hash";
import { toPosixPath } from "../../shared/paths";
import type { FileInfo, SupportedLanguage } from "../../shared/types";

function detectLanguage(extension: string): SupportedLanguage {
  return EXTENSION_TO_LANGUAGE[extension] ?? "unknown";
}

/**
 * Recursively walks `rootPath`, returning FileInfo for every non-ignored file.
 * This does NOT parse file contents beyond hashing — that's parser/*'s job.
 */
export function scanFiles(rootPath: string): FileInfo[] {
  const ig = readGitignore(rootPath);
  const results: FileInfo[] = [];

  function walk(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const absolutePath = join(dir, entry);
      const relativePath = toPosixPath(relative(rootPath, absolutePath));

      if (ig.ignores(relativePath)) continue;

      let stat;
      try {
        stat = statSync(absolutePath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      if (!stat.isFile()) continue;

      const extension = extname(entry).toLowerCase();
      const language = detectLanguage(extension);
      if (language === "unknown") continue;

      let content: string;
      try {
        content = readFileSync(absolutePath, "utf-8");
      } catch {
        continue;
      }

      results.push({
        absolutePath,
        relativePath,
        language,
        extension,
        sizeBytes: stat.size,
        hash: hashContent(content),
      });
    }
  }

  walk(rootPath);
  return results;
}
