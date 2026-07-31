import type { SupportedLanguage } from "../../shared/types";

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

export function detectLanguage(extension: string): SupportedLanguage {
  return EXTENSION_TO_LANGUAGE[extension.toLowerCase()] ?? "unknown";
}

export function isSupportedExtension(extension: string): boolean {
  return detectLanguage(extension) !== "unknown";
}

export function getExtensionsForLanguage(language: SupportedLanguage): string[] {
  return Object.entries(EXTENSION_TO_LANGUAGE)
    .filter(([, lang]) => lang === language)
    .map(([ext]) => ext);
}
