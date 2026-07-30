import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  /**
   * Allows bundling files outside apps/web (i.e. the monorepo's packages/ dir).
   * Needed because engine/pipeline.ts and friends live at ~/ARIES/packages,
   * not inside apps/web.
   */
  outputFileTracingRoot: path.join(process.cwd(), "../../"),
};

export default nextConfig;
