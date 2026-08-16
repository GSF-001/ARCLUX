import type { SourceAcquirer } from "./SourceAcquirer";
export interface RepositoryAcquirer extends SourceAcquirer { kind: "repository"; }
export function createRepositoryAcquirer(acquirer: SourceAcquirer): RepositoryAcquirer { return { ...acquirer, kind: "repository" }; }
