import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative, extname, sep } from "node:path";
import { createHash } from "node:crypto";
import { readGitignore } from "../../git/readGitignore";
import type { FileInfo, SupportedLanguage } from "../../shared/types";

const EXTENSION_TO_LANGUAGE: Record<string, SupportedLanguage> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".py": "python",
  ".java": "java",
  ".go": "go",
  ".cs": "csharp",
  ".php": "php",
  ".rb": "ruby",
  ".rs": "rust",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".h": "cpp",
  ".hpp": "cpp",
};

function detectLanguage(extension: string): SupportedLanguage {
  return EXTENSION_TO_LANGUAGE[extension] ?? "unknown";
}

function hashContent(content: string): string {
  return createHash("sha1").update(content).digest("hex").slice(0, 12);
}

function toPosixPath(p: string): string {
  return p.split(sep).join("/");
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
      return; // permission denied etc — skip silently
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
      if (language === "unknown") continue; // skip binaries, images, etc.

      let content: string;
      try {
        content = readFileSync(absolutePath, "utf-8");
      } catch {
        continue; // unreadable / non-utf8 file — skip
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
