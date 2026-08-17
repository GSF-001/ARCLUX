import type { WebsiteManifest } from "./WebsiteManifest"; export interface IntakeResult { source: string; manifest: WebsiteManifest; assets: string[]; warnings: string[]; }
