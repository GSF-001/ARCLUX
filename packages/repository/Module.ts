import type { ModuleInfo } from "../shared/types";

/** A module nothing else imports — candidate entry point or dead code. */
export function isEntryPoint(module: ModuleInfo): boolean {
  return module.importedBy.length === 0;
}

/** A file that only re-exports from other modules (e.g. index.ts barrel files). */
export function isBarrelFile(module: ModuleInfo): boolean {
  return module.exports.length > 0 && module.exports.every((e) => e.kind === "re-export");
}

export function getExportNames(module: ModuleInfo): string[] {
  return module.exports.map((e) => e.name);
}

export function dependencyCount(module: ModuleInfo): number {
  return module.imports.length;
}

export function consumerCount(module: ModuleInfo): number {
  return module.importedBy.length;
}
