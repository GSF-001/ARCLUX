// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

export interface SourceHealthReport {
  id: string;
  source?: string;
  ok: boolean;
  files: number;
  parsedFiles: number;
  skippedFiles: number;
  errors: string[];
  metadata?: Record<string, unknown>;
}

export function createSourceHealthReport(
  source?: string,
  values: Partial<Omit<SourceHealthReport, "id" | "source">> = {},
): SourceHealthReport {
  return {
    id: crypto.randomUUID(),
    source,
    ok: values.ok ?? false,
    files: values.files ?? 0,
    parsedFiles: values.parsedFiles ?? 0,
    skippedFiles: values.skippedFiles ?? 0,
    errors: values.errors ?? [],
    ...values,
  };
}
