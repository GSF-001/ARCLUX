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
import type { ForceGraphMethods } from "react-force-graph-3d";

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

/**
 * Narrow surface of the ForceGraph3D instance the view controls need. The
 * library's own types require a `position` argument on cameraPosition even
 * though calling it with none returns the current camera coords (getter),
 * so the ref is cast to this shape once at the call site.
 */
interface CameraControls {
  cameraPosition(
    position?: { x: number; y: number; z: number },
    lookAt?: { x: number; y: number; z: number } | null,
    transitionMs?: number
  ): { x: number; y: number; z: number; lookAt: { x: number; y: number; z: number } };
  zoomToFit(durationMs?: number, padding?: number): void;
}

export interface GraphMenuProps {
  is3D?: boolean;
  onToggle3D?: () => void;
  /** ForceGraph3D instance (populated only while the 3D canvas is mounted)
   * so the view controls drive the 3D camera instead of the 2D transform.
   * Passed by GraphViewport; optional so standalone renderers still work. */
  fgRef?: React.MutableRefObject<ForceGraphMethods | undefined>;
}

export function GraphMenu({ is3D, onToggle3D, fgRef }: GraphMenuProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const { graph, zoomIn, zoomOut, resetView, transform } = useGraphContext();

  /** 3D zoom = move the camera along its view axis (z * factor) toward the
   * point it is currently looking at. The library resets lookAt to the
   * origin when given null/undefined (three-render-objects: `lookAt ||
   * {x:0,y:0,z:0}`), so the current lookAt is threaded through explicitly
   * to keep the zoom anchored in place instead of yanking the view.
   * Falls back to the 2D transform handlers when not in 3D mode. */
  const handleZoomIn = () => {
    if (is3D && fgRef?.current) {
      const camera = fgRef.current as unknown as CameraControls;
      const { x, y, z, lookAt } = camera.cameraPosition();
      camera.cameraPosition({ x, y, z: z * 0.75 }, lookAt, 300);
    } else {
      zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (is3D && fgRef?.current) {
      const camera = fgRef.current as unknown as CameraControls;
      const { x, y, z, lookAt } = camera.cameraPosition();
      camera.cameraPosition({ x, y, z: z * 1.25 }, lookAt, 300);
    } else {
      zoomOut();
    }
  };

  const handleResetView = () => {
    if (is3D && fgRef?.current) {
      const camera = fgRef.current as unknown as CameraControls;
      // zoomToFit needs a non-empty bbox; an empty graph has nothing to fit.
      if ((graph?.nodes.length ?? 0) > 0) {
        camera.zoomToFit(400, 20);
      }
    } else {
      resetView();
    }
  };

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
                <Button variant="ghost" size="icon-sm" onClick={handleZoomOut} aria-label="Zoom out">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="min-w-[3rem] flex-1 text-center font-mono text-xs text-muted-foreground">
                  {is3D ? "3D" : `${Math.round(transform.scale * 100)}%`}
                </span>
                <Button variant="ghost" size="icon-sm" onClick={handleZoomIn} aria-label="Zoom in">
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <div className="mx-1 h-4 w-px bg-border" />
                <Button variant="ghost" size="icon-sm" onClick={handleResetView} aria-label="Reset view">
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
