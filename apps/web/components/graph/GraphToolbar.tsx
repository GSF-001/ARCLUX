// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { useGraphContext } from "./GraphProvider";
import { Button } from "@/components/ui/button";

export function GraphToolbar() {
  const { zoomIn, zoomOut, resetView, transform } = useGraphContext();

  return (
    <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1 rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur">
      <Button variant="ghost" size="icon-sm" onClick={zoomOut} aria-label="Zoom out">
        <ZoomOut className="h-4 w-4" />
      </Button>

      <span className="min-w-[3rem] text-center font-mono text-xs text-muted-foreground">
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
  )
}
