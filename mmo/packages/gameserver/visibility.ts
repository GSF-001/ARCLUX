// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// visibility.ts — snapshot sanitasi per-pemirsa (P2-4, EVE intel privacy).
//
// `RegionSnapshot` penuh berisi semua komponen vessel — pemain bisa scout
// komponen private lawan. Sebelum snapshot DIKIRIM ke pemirsa:
//   - viewer = owner vessel → penuh
//   - komponen license "open" → penuh (publik)
//   - sisanya (shared/private) → redact jadi {id, capability} saja —
//     tanpa label/provenance (dasar: LicenseTier universe/license.ts).
// Tanpa viewer (anonim/dev) → penuh — jalur legacy; jalur produksi wajib
// mengirim identitas (token sub / ?playerId=).

import type { RegionSnapshot, WorldEntity, VesselEntity } from "./types";
import type { ComponentBinding } from "../universe/types";

/** Komponen non-public dipangkas jadi id + capability saja (P2-4). */
export function redactComponent(c: ComponentBinding): Pick<ComponentBinding, "id" | "capability"> | ComponentBinding {
  if (c.license === "open") return c;
  return { id: c.id, capability: c.capability };
}

/**
 * Sanitasi snapshot untuk satu pemirsa. Objek lain TIDAK di-mutasi
 * (copy-on-write per vessel yang kena redact) — aman dipanggil per request.
 */
export function sanitizeSnapshot(snapshot: RegionSnapshot, viewerPlayerId?: string): RegionSnapshot {
  if (!viewerPlayerId) return snapshot; // anonim/dev: legacy penuh
  let changed = false;
  const entities: WorldEntity[] = snapshot.entities.map((e) => {
    if (e.kind !== "vessel") return e;
    const v = e as VesselEntity;
    if (v.owner === viewerPlayerId) return e; // pemilik: penuh
    if (v.vessel?.components?.every((c) => c.license === "open")) return e; // tak ada yang private
    changed = true;
    return {
      ...v,
      vessel: {
        ...v.vessel,
        // Cast sengaja: komponen hasil redact memang SETENGAH (hanya
        // {id, capability}) — tipe wire di-cast, klien memperlakukan
        // field yang hilang sebagai intel yang disembunyikan (P2-4).
        components: v.vessel.components.map(redactComponent) as VesselEntity["vessel"]["components"],
      },
    };
  });
  if (!changed) return snapshot;
  return { ...snapshot, entities };
}
