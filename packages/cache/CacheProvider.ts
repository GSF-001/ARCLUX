// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { fileCacheSize, clearFileCache } from "./fileCache";
import { repositoryCacheSize, clearRepositoryCache } from "./repositoryCache";
import { graphCacheSize, clearGraphCache } from "./graphCache";

export interface CacheStats {
  fileCacheSize: number;
  repositoryCacheSize: number;
  graphCacheSize: number;
  totalEntries: number;
}

export function getCacheStats(): CacheStats {
  const file = fileCacheSize();
  const repository = repositoryCacheSize();
  const graph = graphCacheSize();
  return { fileCacheSize: file, repositoryCacheSize: repository, graphCacheSize: graph, totalEntries: file + repository + graph };
}

export function clearAllCaches(): void {
  clearFileCache();
  clearRepositoryCache();
  clearGraphCache();
}
