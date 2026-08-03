// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  /**
   * Allows bundling files outside apps/web (i.e. the monorepo's packages/ dir).
   * Needed because engine/pipeline.ts and friends live at ~/arclux/packages,
   * not inside apps/web.
   */
  outputFileTracingRoot: path.join(process.cwd(), "../../"),

  /**
   * web-tree-sitter's .wasm grammar files use Emscripten dynamic linking
   * (dylink), which Webpack's asyncWebAssembly experiment does not support
   * (fails with "Can't resolve 'GOT.func'"). The fix is NOT to make
   * Webpack bundle the .wasm -- it's to keep this package out of the
   * Webpack bundle entirely and let Node's native require() load it at
   * runtime instead, same as the CLI does. This only matters server-side
   * (API routes), since parsePython.ts is never imported client-side.
   */
  serverExternalPackages: ["web-tree-sitter", "tree-sitter-wasms"],

  webpack: (config) => {
    // require.resolve() on tree-sitter-python.wasm makes Webpack try to
    // bundle the file's contents. serverExternalPackages alone does not
    // stop this. The .wasm here uses Emscripten dylink, which Webpack's
    // WebAssembly module types do not support -- so instead of asking
    // Webpack to parse it as a WASM module, tell it to treat .wasm as a
    // plain binary asset (copy file, return a resolvable path). The
    // actual bytes get read by web-tree-sitter's own Node fs logic at
    // runtime, not by Webpack.
    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
    });
    return config;
  },
};

export default nextConfig;
