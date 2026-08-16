// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { GraphNodeType } from "@/packages/shared/types";

/**
 * Minimal SVG path icons for node rendering. Deliberately simple
 * single-path shapes (not a full icon library import like lucide-react
 * here) — these get rendered once per node, and a graph can have
 * thousands of nodes (see the 1,842-node reference mockup this was
 * scoped down from). Each path is designed to fit inside an 8x8 viewBox
 * centered at origin, matching GraphNode's BASE_RADIUS.
 *
 * Node-type icons (getNodeIconPath) are used for non-file node types
 * (folder/package/route/component/hook). File nodes resolve their icon
 * from the FILE NAME via getMaterialIcon — a Material-Icon-Theme-style
 * mapping (file extension / special folder names), so a .py node looks
 * different from a .ts node.
 */

// ---------------------------------------------------------------------------
// Material-style file icons, keyed by lowercased extension. Values are
// simple recognizable shapes (not pixel-perfect Material assets) drawn in
// the same ±3.5 coordinate box as the node-type icons.
// ---------------------------------------------------------------------------

// Generic code file (page with folded corner) — TS/JS default.
const CODE_FILE = "M-2.5,-3.5 L0.5,-3.5 L2.5,-1.5 L2.5,3.5 L-2.5,3.5 Z M0.5,-3.5 L0.5,-1.5 L2.5,-1.5";
// Python: interlocked loops (lemniscate/snake motif). The old icon appended
// a diagonal slash (`M-2,2 L2,-2`) that read as a prohibition sign — a
// crossed-out circle — at node size on every .py file (user feedback).
const PYTHON_FILE = "M-2,-2 Q0,-3.6 2,-2 Q3.6,0 2,2 Q0,3.6 -2,2 Q-3.6,0 -2,-2";
// Config: curly braces.
const CONFIG_FILE = "M-1.5,-3.5 L-1.5,-1.5 C-1.5,0 -2.5,0.5 -2.5,0 C-2.5,-0.5 -1.5,0 -1.5,1.5 L-1.5,3.5 M1.5,-3.5 L1.5,-1.5 C1.5,0 2.5,0.5 2.5,0 C2.5,-0.5 1.5,0 1.5,1.5 L1.5,3.5";
// Documentation: page with text lines.
const DOC_FILE = "M-2.5,-3.5 L2.5,-3.5 L2.5,3.5 L-2.5,3.5 Z M-1.5,-1.5 L1.5,-1.5 M-1.5,0 L1.5,0 M-1.5,1.5 L0.5,1.5";
// Docker: stacked container boxes.
const DOCKER_FILE = "M-3,-3 L3,-3 L3,-1 L-3,-1 Z M-3,-1 L3,-1 L1.5,2 L-1.5,2 Z M-1.5,2 L1.5,2";
// Database: cylinder (ellipse + body).
const DATABASE_FILE = "M-3,-1 C-3,-2.8 3,-2.8 3,-1 C3,0.8 -3,0.8 -3,-1 M-3,-1 L-3,2 C-3,3.8 3,3.8 3,2 L3,-1";
// Go: hexagonal seal mark (simplified go gopher-less logo).
const GO_FILE = "M-2.2,-3 L2.2,-3 L3.6,0 L2.2,3 L-2.2,3 L-3.6,0 Z";
// Java: coffee cup with handle + steam.
const JAVA_FILE = "M-3,-2.6 L3,-2.6 L2.7,0.2 Q2.5,2.6 0,2.6 Q-2.5,2.6 -2.7,0.2 Z M2.9,-1.7 Q3.8,-1.7 3.8,-0.4 Q3.8,0.9 2.8,0.9 M-1.7,-3.4 L-1.7,-2.95 M-0.2,-3.4 L-0.2,-2.95";
// C#: hash symbol.
const CSHARP_FILE = "M-1.2,-3.5 L-0.4,3.5 M1.2,-3.5 L2,3.5 M-3.2,-1.2 L3.4,-1.2 M-3.2,1.2 L3.4,1.2";
// PHP: "P" glyph.
const PHP_FILE = "M-2.8,-3.5 L-2.8,3.5 M-2.8,-3.5 L0.8,-3.5 Q2.8,-3.5 2.8,-1 Q2.8,1.5 0.8,1.5 L-2.8,1.5";
// Ruby: faceted gem.
const RUBY_FILE = "M0,-3.2 L3,0 L0,3.2 L-3,0 Z M-3,0 L0,1.2 L3,0";
// Rust: hexagonal nut with inner hole.
const RUST_FILE = "M0,-3 L2.6,-1.5 L2.6,1.5 L0,3 L-2.6,1.5 L-2.6,-1.5 Z M0,-1.4 A1.4 1.4 0 1 1 0.05,-1.4";
// C++: C curve + two plus marks.
const CPP_FILE = "M1.9,-2.7 C-0.3,-3.4 -2.9,-2.1 -2.9,0 C-2.9,2.1 -0.3,3.4 1.9,2.7 M-0.5,-1 L-0.5,1 M-1.5,0 L0.5,0 M1.2,-1 L1.2,1 M0.2,0 L2.2,0";
// CSS/SCSS: cascading C curves ("Cascading Style Sheets").
const CSS_FILE = "M1.5,-3 C0,-3.6 -2.4,-2.4 -2.4,0 C-2.4,2.4 0,3.6 1.5,3 M0.8,-2.2 C-0.3,-2.6 -1.6,-1.6 -1.6,0 C-1.6,1.6 -0.3,2.6 0.8,2.2";
// HTML/XML: angle brackets.
const HTML_FILE = "M-2.2,-3.2 L1,0 L-2.2,3.2 M2.2,-3.2 L-1,0 L2.2,3.2";
// Image: frame with a mountain.
const IMAGE_FILE = "M-3,-3 L3,-3 L3,3 L-3,3 Z M-2.4,2 L-0.3,-1 L1.2,0.7 L2.4,-1.2 L2.8,2 Z";

const MATERIAL_FILE_ICONS: Record<string, string> = {
  ".py": PYTHON_FILE,
  ".ts": CODE_FILE,
  ".tsx": CODE_FILE,
  ".js": CODE_FILE,
  ".jsx": CODE_FILE,
  ".mjs": CODE_FILE,
  ".cjs": CODE_FILE,
  ".json": CONFIG_FILE,
  ".yaml": CONFIG_FILE,
  ".yml": CONFIG_FILE,
  ".toml": CONFIG_FILE,
  ".env": CONFIG_FILE,
  ".md": DOC_FILE,
  ".txt": DOC_FILE,
  ".sql": DATABASE_FILE,
  ".db": DATABASE_FILE,
  ".go": GO_FILE,
  ".java": JAVA_FILE,
  ".cs": CSHARP_FILE,
  ".php": PHP_FILE,
  ".rb": RUBY_FILE,
  ".rs": RUST_FILE,
  ".cpp": CPP_FILE,
  ".cc": CPP_FILE,
  ".h": CPP_FILE,
  ".hpp": CPP_FILE,
  ".css": CSS_FILE,
  ".scss": CSS_FILE,
  ".sass": CSS_FILE,
  ".less": CSS_FILE,
  ".html": HTML_FILE,
  ".htm": HTML_FILE,
  ".xml": HTML_FILE,
  ".svg": IMAGE_FILE,
  ".png": IMAGE_FILE,
  ".jpg": IMAGE_FILE,
  ".jpeg": IMAGE_FILE,
  ".gif": IMAGE_FILE,
  ".webp": IMAGE_FILE,
  ".ico": IMAGE_FILE,
  ".gitignore": CONFIG_FILE,
  ".editorconfig": CONFIG_FILE,
  ".prettierrc": CONFIG_FILE,
  ".eslintrc": CONFIG_FILE,
  ".babelrc": CONFIG_FILE,
  ".npmrc": CONFIG_FILE,
};

// ---------------------------------------------------------------------------
// Material-style folder icons, keyed by lowercased folder name. All inherit
// the base folder silhouette; the extras mark the architectural role.
// ---------------------------------------------------------------------------

const FOLDER_BASE = "M-3,-2 L-1,-2 L-0.2,-1 L3,-1 L3,2.5 L-3,2.5 Z";
// Source: folder with a solid dot in the middle.
const FOLDER_SRC = FOLDER_BASE + " M0,0.8 A1.3 1.3 0 1 1 0.1,0.8";
// Test: folder with a checkmark.
const FOLDER_TEST = FOLDER_BASE + " M-1.2,0.8 L0,2 L2,-1";
// Components: folder with a plus.
const FOLDER_COMPONENTS = FOLDER_BASE + " M0,-1.3 L0,2.3 M-1.8,0.5 L1.8,0.5";
// Core: folder with a star.
const FOLDER_CORE = FOLDER_BASE + " M0,-0.2 L0.7,0.9 L2,1.2 L1.2,2.2 L1.4,3.5 L0,2.8 L-1.4,3.5 L-1.2,2.2 L-2,1.2 L-0.7,0.9 Z";
// Utils: folder with a gear-ish ring + center dot.
const FOLDER_UTILS = FOLDER_BASE + " M0,0.8 A1.6 1.6 0 1 1 0.1,0.8 M0,0.8 A0.7 0.7 0 1 1 0.05,0.8";

const MATERIAL_FOLDER_ICONS: Record<string, string> = {
  src: FOLDER_SRC,
  tests: FOLDER_TEST,
  test: FOLDER_TEST,
  components: FOLDER_COMPONENTS,
  core: FOLDER_CORE,
  utils: FOLDER_UTILS,
};

/**
 * Material-Icon-Theme-style resolver: returns an SVG path for a node based
 * on its file name (extension) or, for folders, its directory name.
 * Unknown extensions fall back to a generic code file; unknown folders to
 * the base folder silhouette.
 */
export function getMaterialIcon(fileName: string, isFolder: boolean): string {
  if (isFolder) {
    return MATERIAL_FOLDER_ICONS[fileName.toLowerCase()] ?? FOLDER_BASE;
  }

  // Name-based specials (no extension to key on).
  if (fileName === "Dockerfile" || fileName.startsWith("docker-compose")) {
    return DOCKER_FILE;
  }

  const extMatch = /(\.[^.]+)$/.exec(fileName);
  const ext = extMatch ? extMatch[1].toLowerCase() : "";
  // Dotfiles (.gitignore, .eslintrc, ...) match the regex as-is and are
  // keyed directly in MATERIAL_FILE_ICONS.
  return MATERIAL_FILE_ICONS[ext] ?? CODE_FILE;
}

/**
 * Icon path for a node, keyed by node type. File/folder nodes with a known
 * file name get the Material-style icon resolved from that name; all other
 * types use their fixed shape.
 */
export function getNodeIconPath(type: GraphNodeType, fileName?: string): string {
  switch (type) {
    case "file":
      return fileName ? getMaterialIcon(fileName, false) : CODE_FILE;
    case "folder":
      return fileName ? getMaterialIcon(fileName, true) : FOLDER_BASE;
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
