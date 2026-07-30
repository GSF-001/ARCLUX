import type { FileInfo, ParsedFile } from "../../shared/types";

/**
 * Every language parser (parseJs, parseTs, parsePython, ...) must implement this.
 * This is what makes the pipeline language-agnostic: engine/pipeline.ts only
 * ever talks to this interface, never to a specific parser directly.
 */
export interface LanguageParser {
  /** Which languages this parser handles, e.g. ["typescript"] or ["javascript", "jsx"] */
  readonly supportedLanguages: string[];

  /** File extensions this parser claims, e.g. [".ts", ".tsx"] */
  readonly extensions: string[];

  /**
   * Parse a single file's content into the shared ParsedFile shape.
   * Must NOT throw on malformed syntax — collect issues in `warnings` instead,
   * so one bad file doesn't kill the whole repo analysis.
   */
  parse(file: FileInfo, content: string): Promise<ParsedFile>;
}
