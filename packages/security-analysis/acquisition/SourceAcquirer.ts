import { createSourceSnapshot, type SourceSnapshot } from "./SourceSnapshot";
export interface SourceAcquirer { acquire(source: string): Promise<SourceSnapshot>; }
export function createSourceAcquirer(): SourceAcquirer { return { async acquire(source) { return createSourceSnapshot(source, []); } }; }
