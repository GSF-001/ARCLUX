import type { RemoteSource } from "./RemoteSource"; export interface RemoteRepository extends RemoteSource { revision?: string; }
export function createRemoteRepository(source: string, revision?: string): RemoteRepository { return { ...({ url: source, provider: "unknown" } as RemoteSource), revision }; }
