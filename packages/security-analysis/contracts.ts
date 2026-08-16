// Copyright 2026 Mikatoshi
// Licensed under the Apache License, Version 2.0

export interface LayerRecord {
  id: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export function createLayerRecord(source?: string, metadata?: Record<string, unknown>): LayerRecord {
  return { id: crypto.randomUUID(), source, metadata };
}

export interface SecurityFile {
  file: string;
  source: string;
}

export interface SecurityAnalysisOptions {
  target: string;
  files: SecurityFile[];
  analyzedAt?: string;
  includeInformational?: boolean;
}

export interface CorrelatedFinding {
  findingId: string;
  relatedFindingIds: string[];
  files: string[];
  impact: "low" | "medium" | "high" | "critical";
}
