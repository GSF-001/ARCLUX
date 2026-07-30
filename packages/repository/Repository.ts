import type { RepositoryMeta, ModuleInfo } from "../shared/types";

/**
 * In-memory representation of one analyzed repository.
 * This is the object passed around between indexer -> graph -> engine -> detectors.
 * It does NOT persist itself — packages/db/repositories/RepoStore.ts handles persistence.
 */
export class Repository {
  readonly meta: RepositoryMeta;
  private modules: Map<string, ModuleInfo> = new Map();

  constructor(meta: RepositoryMeta) {
    this.meta = meta;
  }

  addModule(module: ModuleInfo): void {
    this.modules.set(module.id, module);
  }

  getModule(id: string): ModuleInfo | undefined {
    return this.modules.get(id);
  }

  getAllModules(): ModuleInfo[] {
    return Array.from(this.modules.values());
  }

  get moduleCount(): number {
    return this.modules.size;
  }

  /** Modules that nothing else imports — candidates for entry points or dead code */
  findModulesWithNoImporters(): ModuleInfo[] {
    return this.getAllModules().filter((m) => m.importedBy.length === 0);
  }
}
