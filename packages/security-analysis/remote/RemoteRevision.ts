export interface RemoteRevision { value: string; immutable: boolean; }
export function createRemoteRevision(value: string): RemoteRevision { return { value, immutable: /^[0-9a-f]{7,64}$/i.test(value) }; }
