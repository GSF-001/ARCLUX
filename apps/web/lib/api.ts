// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

// Shared fetch helper for the /api/* routes. Extracted from the
// duplicated fetch+parse pattern found in ImpactSummary.tsx and
// GlobalSearch.tsx: build query params, fetch, check res.ok, parse
// JSON, throw a readable Error on failure.
//
// Callers still own their own loading/error state and AbortController
// cancellation flag (see ImpactSummary.tsx for that pattern) -- this
// helper only replaces the fetch+parse boilerplate, not the React
// lifecycle around it.

export async function fetchJson<T>(
  path: string,
  params?: Record<string, string | undefined>
): Promise<T> {
  const query = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.set(key, value);
    }
  }
  const qs = query.toString();
  const url = qs ? `${path}?${qs}` : path;

  const res = await fetch(url);
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      json && typeof json === "object" && "error" in json
        ? String((json as { error: unknown }).error)
        : `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return json as T;
}
