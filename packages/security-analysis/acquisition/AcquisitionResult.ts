import type { SourceSnapshot } from "./SourceSnapshot";
export interface AcquisitionResult { ok: boolean; snapshot?: SourceSnapshot; errors: string[]; }
