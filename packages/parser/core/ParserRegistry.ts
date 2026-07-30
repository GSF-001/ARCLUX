import type { LanguageParser } from "./ParserInterface";
import { AriesError } from "../../shared/errors";

/**
 * Central place where all language parsers register themselves.
 * engine/pipeline.ts asks THIS for "who handles .tsx files", never imports
 * parseTs.ts directly — that's what keeps parser/* swappable.
 */
export class ParserRegistry {
  private parsersByExtension: Map<string, LanguageParser> = new Map();

  register(parser: LanguageParser): void {
    for (const ext of parser.extensions) {
      this.parsersByExtension.set(ext.toLowerCase(), parser);
    }
  }

  getParserForExtension(extension: string): LanguageParser | undefined {
    return this.parsersByExtension.get(extension.toLowerCase());
  }

  getParserOrThrow(extension: string): LanguageParser {
    const parser = this.getParserForExtension(extension);
    if (!parser) {
      throw new AriesError({
        code: "UNSUPPORTED_LANGUAGE",
        message: `No parser registered for extension "${extension}"`,
      });
    }
    return parser;
  }

  get registeredExtensions(): string[] {
    return Array.from(this.parsersByExtension.keys());
  }
}

/** Shared singleton registry — import THIS everywhere, don't `new ParserRegistry()` elsewhere */
export const parserRegistry = new ParserRegistry();
