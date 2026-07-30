"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CodeBlockTerminalProps {
  code: string;
  language?: string;
  /** Shown in the terminal title bar, e.g. "buildIndex.ts" or a fake path */
  filename?: string;
  className?: string;
}

/**
 * A terminal-chrome code block: macOS-style traffic-light dots, filename in the
 * title bar, and a copy button. Used anywhere ARIES surfaces raw code or config
 * to the user (e.g. showing a resolved import path, a CLI command to run).
 */
export function CodeBlockTerminal({ code, language, filename, className }: CodeBlockTerminalProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail in insecure contexts / permission-denied — fail silently,
      // the user can still select-and-copy the text manually.
    }
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-neutral-800 bg-[#0d0d12] font-mono text-sm",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/60 px-3 py-2">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
          </div>
          {filename && (
            <span className="text-xs text-neutral-500">{filename}</span>
          )}
        </div>
        <button
          onClick={handleCopy}
          aria-label="Copy code"
          className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
      </div>

      <pre className="overflow-x-auto px-4 py-3 leading-relaxed text-neutral-200">
        <code data-language={language}>{code}</code>
      </pre>
    </div>
  );
}
