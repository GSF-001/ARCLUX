// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// backup.ts — rotasi backup region snapshot (08 audit P3-7).
//
// Autosave region menulis `region-<id>.json`; sebelum overwrite, file lama
// dirotasi ke `backups/region-<id>-YYYYMMDD-HHMMSS.json` dengan retensi
// 7 hari (hapus yang lebih tua). Mekanisme, bukan janji: dipanggil dari
// server autosave path.

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

export const BACKUP_RETENTION_DAYS = 7;

/**
 * Rotasi satu file backup: salinan ber-timestamp ke <dir>/backups/, lalu
 * hapus backup yang lebih tua dari retensi. Kembalikan path salinan atau
 * null kalau sumber tidak ada.
 */
export function rotateBackup(
  sourcePath: string,
  backupsDir: string,
  retentionDays = BACKUP_RETENTION_DAYS,
  now = new Date(),
): string | null {
  if (!existsSync(sourcePath)) return null;
  mkdirSync(backupsDir, { recursive: true });

  const stamp = now.toISOString().replace(/[:T]/g, "-").slice(0, 19); // YYYY-MM-DD-HH-MM-SS
  const base = sourcePath.split(/[\\/]/).pop() ?? "region.json";
  const dest = join(backupsDir, `${base.replace(/\.json$/, "")}-${stamp}.json`);
  copyFileSync(sourcePath, dest);

  // retensi: hapus yang lebih tua dari N hari.
  const cutoff = now.getTime() - retentionDays * 86_400_000;
  for (const f of readdirSync(backupsDir)) {
    if (!f.endsWith(".json")) continue;
    const p = join(backupsDir, f);
    try {
      if (statSync(p).mtimeMs < cutoff) rmSync(p, { force: true });
    } catch {
      // file bisa saja dihapus proses lain — biarkan.
    }
  }
  return dest;
}
