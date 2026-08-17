export interface WebsiteManifest { title?: string; scripts: string[]; styles: string[]; sourceMaps: string[]; }
export function createWebsiteManifest(): WebsiteManifest { return { scripts: [], styles: [], sourceMaps: [] }; }
