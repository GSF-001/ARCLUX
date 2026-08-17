export interface RemoteProvider { name: string; supports(source: string): boolean; }
export function createRemoteProvider(name: string, matcher: RegExp): RemoteProvider { return { name, supports: (source) => matcher.test(source) }; }
