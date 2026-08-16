import { createLayerRecord, type LayerRecord } from "./contracts";
export type { LayerRecord } from "./contracts";
export function makeRecord(source?: string, metadata?: Record<string, unknown>): LayerRecord { return createLayerRecord(source, metadata); }
