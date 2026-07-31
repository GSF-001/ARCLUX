// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client";

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

export function GraphLegend() {
  return (
    <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2 rounded-lg border bg-background/90 p-3 text-xs shadow-sm backdrop-blur">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {(Object.keys(graphNodeColors) as GraphNodeType[]).map((type) => (
          <div key={type} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: graphNodeColors[type].dark }}
            />
            <span className="text-muted-foreground">{nodeLabels[type]}</span>
          </div>
        ))}
      </div>

      <div className="h-px bg-border" />

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {(Object.keys(graphEdgeColors) as GraphEdgeType[]).map((type) => (
          <div key={type} className="flex items-center gap-1.5">
            <span
              className="h-0.5 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: graphEdgeColors[type].dark }}
            />
            <span className="text-muted-foreground">{edgeLabels[type]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
