// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// adminAudit.ts — jejak audit admin TAK-berUBAH (08 audit P3-8).
//
// Setiap aksi admin (deliver handoff, teleport, spawn_station, …) dicatat
// sebagai baris JSONL: { ts, actor (operator), action, target, tick, meta }.
// File APPEND-ONLY — tak ada update/delete lewat API ini (immutable trail).
// Lokasi: <root>/.arclux/admin-audit/audit-YYYY-MM-DD.jsonl (per hari).

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface AdminAuditEvent {
  actor: string;
  action: string;
  target?: string;
  tick?: number;
  meta?: Record<string, unknown>;
}

function auditDir(root: string): string {
  return join(root, ".arclux", "admin-audit");
}

function auditFile(root: string, d = new Date()): string {
  const day = d.toISOString().slice(0, 10);
  return join(auditDir(root), `audit-${day}.jsonl`);
}

/**
 * Append satu event audit. Gagal menulis TIDAK boleh mematikan alur game —
 * kembalikan false (caller boleh log sekunder).
 */
export function appendAdminEvent(root: string, ev: AdminAuditEvent): boolean {
  try {
    mkdirSync(auditDir(root), { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      actor: ev.actor,
      action: ev.action,
      target: ev.target,
      tick: ev.tick,
      meta: ev.meta,
    });
    appendFileSync(auditFile(root), line + "\n", "utf8");
    return true;
  } catch {
    return false;
  }
}

/** Factory: bind root sekali, pakai `audit(ev)` di handler. */
export function createAdminAudit(root: string) {
  return {
    audit(ev: AdminAuditEvent): boolean {
      return appendAdminEvent(root, ev);
    },
  };
}

export type AdminAudit = ReturnType<typeof createAdminAudit>;
