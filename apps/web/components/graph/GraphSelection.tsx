"use client";

import { X } from "lucide-react";
import { useGraphContext } from "./GraphProvider";
import { Button } from "@/components/ui/button";

export function GraphSelection() {
  const { graph, selectedNodeId, selectNode } = useGraphContext();

  const node = graph?.nodes.find((n) => n.id === selectedNodeId);
  if (!node) return null;

  const incoming = graph?.edges.filter((e) => e.target === node.id) ?? [];
  const outgoing = graph?.edges.filter((e) => e.source === node.id) ?? [];

  return (
    <div className="absolute right-4 top-4 z-10 w-72 rounded-lg border bg-background/95 p-4 text-sm shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{node.label}</p>
          {node.filePath && (
            <p className="truncate font-mono text-xs text-muted-foreground">{node.filePath}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => selectNode(null)}
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border px-2 py-1.5">
          <p className="text-muted-foreground">Incoming</p>
          <p className="font-mono text-sm">{incoming.length}</p>
        </div>
        <div className="rounded-md border px-2 py-1.5">
          <p className="text-muted-foreground">Outgoing</p>
          <p className="font-mono text-sm">{outgoing.length}</p>
        </div>
      </div>
    </div>
  )
}
