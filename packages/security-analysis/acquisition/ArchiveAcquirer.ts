import type { SourceAcquirer } from "./SourceAcquirer";
export interface ArchiveAcquirer extends SourceAcquirer { kind: "archive"; }
export function createArchiveAcquirer(acquirer: SourceAcquirer): ArchiveAcquirer { return { ...acquirer, kind: "archive" }; }
