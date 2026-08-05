// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Thin wrapper over chokidar (github.com/paulmillr/chokidar, MIT license).
// Deliberately does NOT re-implement raw fs.watch/fs.watchFile handling —
// chokidar already normalizes per-OS event quirks (VSCode itself depends
// on it), so writing that from scratch here would just be reinventing a
// well-solved problem. The custom/novel part of this feature is in
// changeQueue.ts and watchRepository.ts, not here.

import { watch, type FSWatcher } from "chokidar";

export type FileChangeKind = "add" | "change" | "unlink";

export interface FileChangeEvent {
  kind: FileChangeKind;
  absolutePath: string;
}

export interface FilesystemWatcher {
  close(): Promise<void>;
}

/**
 * Watches rootPath recursively, calling onChange for every add/change/unlink.
 * Directory events (addDir/unlinkDir) are intentionally NOT surfaced —
 * changeQueue.ts and the incremental Cell layer operate on individual
 * files, a directory appearing/disappearing doesn't need its own signal
 * separate from the file events chokidar emits for its contents.
 */
export function watchFilesystem(rootPath: string, onChange: (event: FileChangeEvent) => void): FilesystemWatcher {
  const watcher: FSWatcher = watch(rootPath, {
    ignoreInitial: true,
    ignored: (path: string) => path.includes("node_modules") || path.includes("/.git/"),
  });

  watcher.on("add", (absolutePath: string) => onChange({ kind: "add", absolutePath }));
  watcher.on("change", (absolutePath: string) => onChange({ kind: "change", absolutePath }));
  watcher.on("unlink", (absolutePath: string) => onChange({ kind: "unlink", absolutePath }));

  return {
    close: () => watcher.close(),
  };
}
