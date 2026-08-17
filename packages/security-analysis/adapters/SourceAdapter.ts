import type { SourceSnapshot } from "../acquisition/SourceSnapshot";
export interface SourceAdapter { readonly kind: string; resolve(source: string): Promise<SourceSnapshot>; }
