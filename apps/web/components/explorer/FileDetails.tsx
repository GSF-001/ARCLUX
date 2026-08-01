"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LoadingState } from "@/components/patterns/LoadingState";
import { ErrorState } from "@/components/patterns/ErrorState";

interface HighlightToken {
  startIndex: number;
  endIndex: number;
  text: string;
  tokenType: string;
}

interface FileResponse {
  content: string;
  language: string;
  branch: string;
  tokens: HighlightToken[];
}

// Mirrors theme/theme.dark.ts `syntax` tokens. Duplicated here rather than
// imported because that file exports color values meant for CSS variable
// wiring, not a ready-to-use token-name -> hex map — keeping this local
// avoids coupling this client component to globals.css wiring specifics.
const TOKEN_COLORS: Record<string, string> = {
  comment: "#878787",
  keyword: "#F75590",
  string: "#63C46D",
  variable: "#EDEDED",
  property: "#0AC7AC",
  type: "#0AC7AC",
  constant: "#F2A700",
  operator: "#F75590",
  punctuation: "#EDEDED",
};

export interface FileDetailsProps {
  repoUrl: string;
  filePath: string;
  branch?: string;
}

/**
 * STATUS: not yet wired up to any page (components/explorer/Explorer.tsx is
 * still empty) — this is a standalone building block for now. Also not yet
 * visually verified in a browser; see highlightPython.ts and
 * apps/web/app/api/file/route.ts for what's still unconfirmed.
 */
export function FileDetails({ repoUrl, filePath, branch }: FileDetailsProps) {
  const [data, setData] = useState<FileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ repoUrl, filePath });
        if (branch) params.set("branch", branch);

        const res = await fetch(`/api/file?${params.toString()}`);
        const json = await res.json();

        if (!res.ok) throw new Error(json.error ?? `Request failed with status ${res.status}`);
        if (!cancelled) setData(json as FileResponse);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load file");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [repoUrl, filePath, branch]);

  if (isLoading) return <LoadingState label="Loading file..." />;
  if (error) return <ErrorState title="Couldn't load file" message={error} />;
  if (!data) return null;

  return (
    <div className="h-full overflow-auto bg-black">
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        {filePath}
      </div>
      <pre className="p-4 text-sm leading-relaxed">
        <code>{renderTokens(data.content, data.tokens)}</code>
      </pre>
    </div>
  );
}

/**
 * Renders source with highlighted spans, filling gaps between tokens as
 * plain unstyled text. Assumes token.startIndex/endIndex line up with JS
 * string indices — that's how the reference examples for web-tree-sitter
 * use them when the parser is fed a JS string directly, but it hasn't been
 * visually confirmed in-browser for this project yet. If colors land on
 * the wrong characters, check that assumption first.
 */
function renderTokens(source: string, tokens: HighlightToken[]): ReactNode {
  if (tokens.length === 0) {
    return source;
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const token of tokens) {
    if (token.startIndex > cursor) {
      nodes.push(source.slice(cursor, token.startIndex));
    }
    const color = TOKEN_COLORS[token.tokenType];
    nodes.push(
      <span key={`${token.startIndex}-${token.endIndex}`} style={{ color }}>
        {source.slice(token.startIndex, token.endIndex)}
      </span>
    );
    cursor = token.endIndex;
  }

  if (cursor < source.length) {
    nodes.push(source.slice(cursor));
  }

  return nodes;
}
