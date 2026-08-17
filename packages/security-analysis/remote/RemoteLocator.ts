export interface RemoteLocator { source: string; revision?: string; }
export function createRemoteLocator(source: string, revision?: string): RemoteLocator { return { source, revision }; }
