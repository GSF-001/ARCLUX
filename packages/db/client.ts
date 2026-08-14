// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Generic collection client: one JSON file per record, under
// ~/.arclux/db/<collection>/<id>.json. Writes go through
// packages/storage/RecoveryManager.ts's writeTransactional() -- same
// crash-safety guarantee already verified for process records
// (packages/storage/SnapshotManager.ts uses the same function).

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { writeTransactional } from "../storage/RecoveryManager";
import { SCHEMA_VERSION, type CollectionName } from "./schema";

function arcluxRoot(): string {
  return process.env.ARCLUX_ROOT || path.join(os.homedir(), ".arclux");
}

function collectionDir(collection: CollectionName): string {
  return path.join(arcluxRoot(), "db", collection);
}

function recordPath(collection: CollectionName, id: string): string {
  return path.join(collectionDir(collection), `${id}.json`);
}

/** Writes (or overwrites) one record, journaled through RecoveryManager for crash safety. */
export function putRecord<T extends { id: string }>(collection: CollectionName, record: T): void {
  const withVersion = { ...record, __schemaVersion: SCHEMA_VERSION };
  writeTransactional(recordPath(collection, record.id), JSON.stringify(withVersion, null, 2));
}

/** Reads one record by id, or null if it doesn't exist / is corrupt. */
export function getRecord<T>(collection: CollectionName, id: string): T | null {
  try {
    const raw = fs.readFileSync(recordPath(collection, id), "utf8");
    const parsed = JSON.parse(raw);
    delete parsed.__schemaVersion;
    return parsed as T;
  } catch {
    return null;
  }
}

/** Reads every record in a collection. Skips (does not throw on) individual corrupt files. */
export function listRecords<T>(collection: CollectionName): T[] {
  const dir = collectionDir(collection);
  let files: string[];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return [];
  }

  const records: T[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const parsed = JSON.parse(raw);
      delete parsed.__schemaVersion;
      records.push(parsed as T);
    } catch {
      continue;
    }
  }
  return records;
}

export function deleteRecord(collection: CollectionName, id: string): void {
  try {
    fs.unlinkSync(recordPath(collection, id));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
