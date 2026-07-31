"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useGraphContext } from "./GraphProvider";
import { Input } from "@/components/ui/input";

export function GraphSearch() {
  const { graph, selectNode, setTransform, positions, dimensions } = useGraphContext();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const results = useMemo(() => {
    if (!graph || query.trim().length === 0) return [];
    const q = query.toLowerCase();
    return graph.nodes.filter((n) => n.label.toLowerCase().includes(q)).slice(0, 8);
  }, [graph, query]);

  function focusNode(nodeId: string) {
    const pos = positions.get(nodeId);
    selectNode(nodeId);
    setQuery("");
    setIsOpen(false);
    if (pos) {
      setTransform({
        x: dimensions.width / 2 - pos.x * 2,
        y: dimensions.height / 2 - pos.y * 2,
        scale: 2,
      });
    }
  }

  return (
    <div className="absolute left-4 top-4 z-10 w-64">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search nodes..."
          className="h-8 bg-background/90 pl-8 text-sm backdrop-blur"
        />
      </div>

      {isOpen && results.length > 0 && (
        <div className="mt-1 overflow-hidden rounded-md border bg-background/95 shadow-sm backdrop-blur">
          {results.map((node) => (
            <button
              key={node.id}
              onClick={() => focusNode(node.id)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span className="truncate">{node.label}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{node.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
