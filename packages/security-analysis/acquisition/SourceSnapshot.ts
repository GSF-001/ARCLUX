export interface SourceSnapshot { id: string; source: string; revision?: string; createdAt: string; files: string[]; }
export function createSourceSnapshot(source: string, files: string[], revision?: string): SourceSnapshot {
  return { id: crypto.randomUUID(), source, files: [...files], revision, createdAt: new Date().toISOString() };
}
