// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { GraphNodeType } from "@/packages/shared/types";

/**
 * Minimal SVG path icons per node type, drawn inside GraphNode's circle.
 * Deliberately simple single-path shapes (not a full icon library import
 * like lucide-react here) — these get rendered once per node, and a graph
 * can have thousands of nodes (see the 1,842-node reference mockup this
 * was scoped down from). Each path is designed to fit inside an 8x8
 * viewBox centered at origin, matching GraphNode's BASE_RADIUS.
 */
export function getNodeIconPath(type: GraphNodeType): string {
  switch (type) {
    case "file":
      // Simple document/page shape
      return "M-2.5,-3.5 L0.5,-3.5 L2.5,-1.5 L2.5,3.5 L-2.5,3.5 Z M0.5,-3.5 L0.5,-1.5 L2.5,-1.5";
    case "folder":
      // Folder shape
      return "M-3,-2 L-1,-2 L-0.2,-1 L3,-1 L3,2.5 L-3,2.5 Z";
    case "external-package":
      // Package/box shape (hexagon-ish cube outline, simplified to a diamond)
      return "M0,-3.2 L3,0 L0,3.2 L-3,0 Z M-3,0 L3,0 M0,-3.2 L0,3.2";
    case "route":
      // Signpost/arrow shape
      return "M-2.5,0 L1.5,0 M1.5,0 L-0.2,-1.7 M1.5,0 L-0.2,1.7 M-2.5,-2.5 L-2.5,2.5";
    case "component":
      // Puzzle-piece-ish block (simplified to a rounded square outline)
      return "M-2.8,-2.8 L2.8,-2.8 L2.8,2.8 L-2.8,2.8 Z M-2.8,0 L2.8,0 M0,-2.8 L0,2.8";
    case "hook":
      // Hook/curve shape
      return "M-1.5,-3 Q-3,-3 -3,-1 Q-3,1 -1,1 L1.5,1 Q3,1 3,3";
    default:
      return "";
  }
}
