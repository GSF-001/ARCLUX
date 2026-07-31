import { readFileSync, existsSync } from "node:fs";
import { join, posix } from "node:path";

export interface AliasMap {
  paths: Record<string, string[]>;
}

export function loadAliasMap(rootPath: string): AliasMap {
  const tsconfigPath = join(rootPath, "tsconfig.json");
  if (!existsSync(tsconfigPath)) return { paths: {} };

  try {
    const raw = readFileSync(tsconfigPath, "utf-8");
    const stripped = raw.replace(/\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1");
    const parsed = JSON.parse(stripped);
    return { paths: parsed.compilerOptions?.paths ?? {} };
  } catch {
    return { paths: {} };
  }
}

export function resolveAlias(importSource: string, aliasMap: AliasMap): string | null {
  for (const [pattern, targets] of Object.entries(aliasMap.paths)) {
    if (!pattern.endsWith("/*") || !targets[0]?.endsWith("/*")) continue;

    const prefix = pattern.slice(0, -1);
    if (!importSource.startsWith(prefix)) continue;

    const rest = importSource.slice(prefix.length);
    const targetPrefix = targets[0].slice(0, -1);
    return posix.normalize(posix.join(targetPrefix, rest));
  }

  return null;
}
