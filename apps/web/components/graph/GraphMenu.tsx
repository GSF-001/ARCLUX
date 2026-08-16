// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Consolidates GraphToolbar.tsx (zoom controls) and GraphLegend.tsx (node/
// edge color key) into one toggleable slide-out panel instead of two
// permanently-visible floating widgets — requested after dogfooding
// showed the canvas getting cluttered with the search bar, toolbar,
// legend, and focus view all fighting for corner space at once.
// GraphToolbar.tsx / GraphLegend.tsx are left in place (not deleted) in
// case something else still renders them standalone; GraphViewport.tsx
// should render THIS instead of both of those going forward.

"use client";

import { useState } from "react";
import { PanelRight, ZoomIn, ZoomOut, Maximize2, X, Box, Square } from "lucide-react";
import { useGraphContext } from "./GraphProvider";
import { Button } from "@/components/ui/button";
import { graphNodeColors, graphEdgeColors } from "@/theme/graphColors";
import type { GraphNodeType, GraphEdgeType } from "@/packages/shared/types";

const nodeLabels: Record<GraphNodeType, string> = {
  file: "File",
  folder: "Folder",
  "external-package": "External package",
  route: "Route",
  component: "Component",
  hook: "Hook",
};

const edgeLabels: Record<GraphEdgeType, string> = {
  import: "Import",
  export: "Export",
  call: "Call",
  "route-link": "Route link",
};

export function GraphMenu({ is3D, onToggle3D }: { is3D?: boolean; onToggle3D?: () => void } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const { zoomIn, zoomOut, resetView, transform } = useGraphContext();

  return (
    <>
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen((prev) => !prev)}
          className="gap-2 bg-background/90 backdrop-blur"
        >
          <PanelRight className="h-4 w-4" />
          Menu
        </Button>
      </div>

      {isOpen && (
        <div className="absolute inset-y-4 right-4 z-20 flex w-72 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border bg-background/95 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">Graph Menu</p>
            <Button variant="ghost" size="icon-xs" onClick={() => setIsOpen(false)} aria-label="Close menu">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto p-4 text-sm">
            {onToggle3D && (
              <section>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  View mode
                </h3>
                <div className="flex items-center gap-1 rounded-md border p-1">
                  <Button
                    variant={!is3D ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => is3D && onToggle3D()}
                    className="flex-1 gap-1.5"
                  >
                    <Square className="h-3.5 w-3.5" />
                    2D
                  </Button>
                  <Button
                    variant={is3D ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => !is3D && onToggle3D()}
                    className="flex-1 gap-1.5"
                  >
                    <Box className="h-3.5 w-3.5" />
                    3D
                  </Button>
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                View controls
              </h3>
              <div className="flex items-center gap-1 rounded-md border p-1">
                <Button variant="ghost" size="icon-sm" onClick={zoomOut} aria-label="Zoom out">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="min-w-[3rem] flex-1 text-center font-mono text-xs text-muted-foreground">
                  {Math.round(transform.scale * 100)}%
                </span>
                <Button variant="ghost" size="icon-sm" onClick={zoomIn} aria-label="Zoom in">
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <div className="mx-1 h-4 w-px bg-border" />
                <Button variant="ghost" size="icon-sm" onClick={resetView} aria-label="Reset view">
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Node types
              </h3>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {(Object.keys(graphNodeColors) as GraphNodeType[]).map((type) => (
                  <div key={type} className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: graphNodeColors[type].dark }}
                    />
                    <span className="text-xs text-muted-foreground">{nodeLabels[type]}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Edge types
              </h3>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {(Object.keys(graphEdgeColors) as GraphEdgeType[]).map((type) => (
                  <div key={type} className="flex items-center gap-1.5">
                    <span
                      className="h-0.5 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: graphEdgeColors[type].dark }}
                    />
                    <span className="text-xs text-muted-foreground">{edgeLabels[type]}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
