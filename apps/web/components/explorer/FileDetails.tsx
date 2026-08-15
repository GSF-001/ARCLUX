"use client";

import { useState, type ReactNode } from "react";
import { useEffect } from "react";
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

/** One diagnostic finding pinned to a specific line in this file. Shape matches DiagnosticEvent (packages/diagnostics/DiagnosticEvent.ts) as returned by POST /api/diagnostics, filtered by the caller to this file's filePath. */
export interface DiagnosticMarker {
  line: number;
  severity: "error" | "warning";
  message: string;
  checkId: string;
  suggestion?: string;
}

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

const SEVERITY_COLOR: Record<DiagnosticMarker["severity"], string> = {
  error: "#F75590",
  warning: "#F2A700",
};

export interface FileDetailsProps {
  repoUrl: string;
  filePath: string;
  branch?: string;
  /** Diagnostic findings for THIS file only -- caller (Explorer.tsx) fetches /api/diagnostics once and filters by filePath, so this component doesn't re-fetch the (expensive, full-repo) diagnostics call per file open. */
  diagnostics?: DiagnosticMarker[];
}

export function FileDetails({ repoUrl, filePath, branch, diagnostics = [] }: FileDetailsProps) {
  const [data, setData] = useState<FileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedLine, setExpandedLine] = useState<number | null>(null);

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

  const markersByLine = new Map<number, DiagnosticMarker[]>();
  for (const marker of diagnostics) {
    const list = markersByLine.get(marker.line) ?? [];
    list.push(marker);
    markersByLine.set(marker.line, list);
  }

  return (
    <div className="h-full overflow-auto bg-black">
      <div className="flex items-center justify-between bg-neutral-900/40 px-4 py-2 font-mono text-xs text-muted-foreground">
        <span>{filePath}</span>
        {diagnostics.length > 0 && (
          <span style={{ color: SEVERITY_COLOR.error }}>{diagnostics.length} finding(s)</span>
        )}
      </div>
      <div className="text-sm leading-relaxed">
        {renderLines(data.content, data.tokens, markersByLine, expandedLine, setExpandedLine)}
      </div>
    </div>
  );
}

/**
 * Renders source split by line, one row per line: a gutter (line number +
 * colored bar if a diagnostic exists on that line) and the syntax-highlighted
 * content. Clicking a marked line expands a message row below it showing
 * the diagnostic message + fix suggestion, matching how an editor's Problems
 * panel works but inline instead of in a separate list.
 *
 * Token offsets from /api/file are global string indices (see the original
 * comment this replaces) -- converted here to per-line by tracking each
 * line's start offset. Tokens are assumed not to span multiple lines
 * (true for keyword/string/comment/etc token types the highlighter emits).
 */
function renderLines(
  source: string,
  tokens: HighlightToken[],
  markersByLine: Map<number, DiagnosticMarker[]>,
  expandedLine: number | null,
  setExpandedLine: (line: number | null) => void
): ReactNode {
  const lines = source.split("\n");
  const lineStarts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineStarts.push(offset);
    offset += line.length + 1;
  }

  const tokensByLineIndex: HighlightToken[][] = lines.map(() => []);
  for (const token of tokens) {
    let lineIdx = 0;
    for (let i = 0; i < lineStarts.length; i++) {
      if (lineStarts[i] <= token.startIndex) lineIdx = i;
      else break;
    }
    tokensByLineIndex[lineIdx]?.push(token);
  }

  return lines.map((lineText, idx) => {
    const lineNumber = idx + 1;
    const lineStart = lineStarts[idx];
    const lineMarkers = markersByLine.get(lineNumber) ?? [];
    const hasError = lineMarkers.some((m) => m.severity === "error");
    const barColor = lineMarkers.length > 0 ? SEVERITY_COLOR[hasError ? "error" : "warning"] : "transparent";
    const isExpanded = expandedLine === lineNumber;

    return (
      <div key={lineNumber}>
        <button
          type="button"
          onClick={() => lineMarkers.length > 0 && setExpandedLine(isExpanded ? null : lineNumber)}
          className={`flex w-full items-start gap-3 px-2 text-left font-mono ${
            lineMarkers.length > 0 ? "cursor-pointer hover:bg-neutral-900/60" : "cursor-default"
          } ${isExpanded ? "bg-neutral-900/60" : ""}`}
        >
          <span style={{ backgroundColor: barColor }} className="mt-0.5 h-full w-0.5 shrink-0 self-stretch" />
          <span className="w-8 shrink-0 select-none text-right text-neutral-600">{lineNumber}</span>
          <span className="flex-1 whitespace-pre">
            {renderLineTokens(lineText, lineStart, tokensByLineIndex[idx] ?? [])}
          </span>
        </button>
        {isExpanded &&
          lineMarkers.map((marker) => (
            <div
              key={marker.checkId}
              className="ml-[52px] mr-2 mb-1 rounded bg-neutral-900/80 px-3 py-2 text-xs"
              style={{ borderLeft: `2px solid ${SEVERITY_COLOR[marker.severity]}` }}
            >
              <p style={{ color: SEVERITY_COLOR[marker.severity] }}>{marker.message}</p>
              {marker.suggestion && <p className="mt-1 text-neutral-400">Fix: {marker.suggestion}</p>}
            </div>
          ))}
      </div>
    );
  });
}

function renderLineTokens(lineText: string, lineStart: number, lineTokens: HighlightToken[]): ReactNode {
  if (lineTokens.length === 0) return lineText;

  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const token of lineTokens) {
    const relStart = Math.max(0, token.startIndex - lineStart);
    const relEnd = Math.min(lineText.length, token.endIndex - lineStart);
    if (relStart > cursor) nodes.push(lineText.slice(cursor, relStart));
    const color = TOKEN_COLORS[token.tokenType];
    nodes.push(
      <span key={`${token.startIndex}-${token.endIndex}`} style={{ color }}>
        {lineText.slice(relStart, relEnd)}
      </span>
    );
    cursor = relEnd;
  }

  if (cursor < lineText.length) nodes.push(lineText.slice(cursor));
  return nodes;
}
