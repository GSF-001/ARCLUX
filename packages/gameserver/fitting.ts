// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// fitting.ts — Fase 3 (blueprint 11 §5): server-authoritative fit
// authority untuk gameserver.
//
// Model: vessel.components = KATALOG (server-derived dari analisis —
// klien tidak pernah mengirim binding), vessel.fitted = subset yang
// terpasang (pilihan pemain, diubah hanya via intent equip/unequip).
//
// Semua kalkulasi didelegasikan ke packages/universe::fitCalc (Fase 1)
// — tidak ada duplikasi logika. Server menghitung ulang setiap
// proyeksi; klien hanya mengirim intent + (opsional) expectHash sebagai
// bukti sinkronisasi state (anti-cheat, Layer I.5).

import {
  computeFit,
  defaultSlotLayout,
  deriveComponentDefinition,
  type FitInput,
} from "../universe/fitCalc";
import { capacitorBudget, capStep } from "../universe/capSim";
import { checkComponent, type AuthorizationContext } from "../universe/license";
import type {
  ComponentBinding,
  ComponentDefinition,
  FitResult,
  SlotLayout,
  VesselModel,
} from "../universe/types";
import type { PlayerIntent, VesselEntity } from "./types";

/** Komponen terpasang. Legacy (fitted undefined): seluruh katalog. */
export function fittedComponents(vessel: VesselModel): ComponentBinding[] {
  if (!vessel.fitted) return vessel.components;
  const mounted = new Set(vessel.fitted);
  return vessel.components.filter((c) => mounted.has(c.id));
}

/** Komponen katalog yang belum terpasang (bay). Legacy: kosong. */
export function availableComponents(vessel: VesselModel): ComponentBinding[] {
  if (!vessel.fitted) return [];
  const mounted = new Set(vessel.fitted);
  return vessel.components.filter((c) => !mounted.has(c.id));
}

/** Definisi komponen terpasang (turunan deterministik dari binding). */
export function fitDefinitionsOf(vessel: VesselModel): ComponentDefinition[] {
  return fittedComponents(vessel).map(deriveComponentDefinition);
}

/** Input fit untuk computeFit — dari state entity saat ini. */
export function fitInputOf(entity: VesselEntity): FitInput {
  return {
    base: entity.vessel.systems,
    definitions: fitDefinitionsOf(entity.vessel),
    slotLayout: entity.vessel.slotLayout ?? defaultSlotLayout(),
  };
}

/**
 * Live fit authoritative. Server menghitung ulang setiap kali —
 * tidak pernah memercayai proyeksi klien.
 */
export function liveFit(entity: VesselEntity): FitResult {
  return computeFit(fitInputOf(entity));
}

/** Verifikasi klaim hash klien (anti-cheat: deterministic replay). */
export function verifyFitHash(entity: VesselEntity, claimed: string): boolean {
  return liveFit(entity).hash === claimed;
}

export type FitIntentOp = "equip" | "unequip";

export interface FitProjection {
  /** Ids yang terpasang setelah aksi (belum dikomit). */
  fitted: string[];
  /** Hasil kalkulasi setelah aksi. */
  fit: FitResult;
}

/**
 * Proyeksi murni aksi equip/unequip: hitung ulang fit tanpa memutasi
 * vessel. Validator memakai ini untuk memutuskan legalitas; simulation
 * mengomits hasilnya setelah intent diterima.
 */
export function projectFitAction(
  vessel: VesselModel,
  op: FitIntentOp,
  componentId: string
): FitProjection {
  const current = vessel.fitted ?? vessel.components.map((c) => c.id);
  const next =
    op === "equip"
      ? current.includes(componentId)
        ? current
        : [...current, componentId]
      : current.filter((id) => id !== componentId);
  const mounted = new Set(next);
  const definitions = vessel.components
    .filter((c) => mounted.has(c.id))
    .map(deriveComponentDefinition);
  const fit = computeFit({
    base: vessel.systems,
    definitions,
    slotLayout: vessel.slotLayout ?? defaultSlotLayout(),
  });
  return { fitted: next, fit };
}

/**
 * Validasi intent equip_component / unequip_component (Layer I.4).
 * Aturan:
 *   - componentId harus ada di katalog vessel (server-derived)
 *   - komponen harus di-authorized (Layer I.6, checkComponent)
 *   - equip: belum terpasang; unequip: harus terpasang
 *   - expectHash (opsional): bukti klien sinkron dengan state kini
 *   - proyeksi server harus valid (slot/prerequisite/subsystem)
 */
export function validateFitIntent(
  entity: VesselEntity,
  intent: PlayerIntent,
  auth: AuthorizationContext
): { decision: "accept" | "reject"; reason?: string } {
  const p = intent.payload as { componentId?: unknown; expectHash?: unknown } | undefined;
  if (!p || typeof p.componentId !== "string" || p.componentId.length === 0) {
    return { decision: "reject", reason: `${intent.type} requires componentId` };
  }
  const op: FitIntentOp = intent.type === "equip_component" ? "equip" : "unequip";
  const vessel = entity.vessel;

  // Katalog milik server — klien hanya boleh merujuk id.
  const binding = vessel.components.find((c) => c.id === p.componentId);
  if (!binding) {
    return { decision: "reject", reason: `unknown component: ${p.componentId}` };
  }

  // Layer I.6 — license/authorization, jalur yang sama dengan senjata.
  const check = checkComponent(binding, auth);
  if (check.decision === "disabled") {
    return { decision: "reject", reason: `component not authorized: ${check.reason}` };
  }

  const mountedIds = vessel.fitted ?? vessel.components.map((c) => c.id);
  if (op === "equip") {
    if (mountedIds.includes(binding.id)) {
      return { decision: "reject", reason: `component already fitted: ${binding.id}` };
    }
  } else if (!mountedIds.includes(binding.id)) {
    return { decision: "reject", reason: `component not fitted: ${binding.id}` };
  }

  // Anti-cheat: klien membuktikan ia melihat state terkini.
  if (
    typeof p.expectHash === "string" &&
    p.expectHash.length > 0 &&
    !verifyFitHash(entity, p.expectHash)
  ) {
    return { decision: "reject", reason: "fit hash mismatch — client state out of sync" };
  }

  // Otoritas server: proyeksi dihitung ulang di sini. Slot overflow,
  // prerequisite tier-3 hilang, atau subsystem tak dikenal → tolak.
  const projected = projectFitAction(vessel, op, binding.id);
  if (!projected.fit.valid) {
    const firstError = projected.fit.issues.find((i) => i.severity === "error");
    return { decision: "reject", reason: firstError?.message ?? "invalid fit" };
  }
  return { decision: "accept" };
}

// ─────────────────────────────────────────────────────────
// Kapasitor authority (Fase 3) — satu tick, server-side
// ─────────────────────────────────────────────────────────

/** Regen kapasitor penuh per tick pada reactor 100% health. */
export const CAP_REGEN_AT_FULL = 4;
/** Kapasitor minimum — vessel kecil tetap punya cadangan. */
export const CAP_MIN_CAPACITY = 20;

export interface CapacitorTickResult {
  capacity: number;
  /** Level akhir tick (0..capacity). */
  current: number;
  /** Draw = Σ powerDraw komponen terpasang. */
  draw: number;
  regen: number;
  /** true bila level 0 (aktivasi kemampuan ditolak). */
  depleted: boolean;
  /** true HANYA pada tick saat menyeberang ke depletion. */
  newlyDepleted: boolean;
}

const round2g = (n: number) => Math.round(n * 100) / 100;

/**
 * Tick kapasitor vessel SATU langkah, authoritative:
 *   - capacity = max(CAP_MIN_CAPACITY, reactor baseStat)
 *   - regen    ∝ reactor health (0 .. CAP_REGEN_AT_FULL/tick)
 *   - draw     = capacitorBudget(fitted components) dari capSim
 *   - level    = capStep(...) — rumus yang SAMA dengan yang klien
 *     pakai untuk proyeksi (bukan duplikasi: satu fungsi di capSim).
 * Mutates `entity.capacitor` (state game memang mutasi otoritatif).
 */
export function stepCapacitor(entity: VesselEntity): CapacitorTickResult {
  const reactor = entity.vessel.systems.find((s) => s.id === "reactor");
  const capacity = Math.max(CAP_MIN_CAPACITY, Math.round((reactor?.baseStat ?? 50) * 10) / 10);
  const regen = round2g(((reactor?.health ?? 50) / 100) * CAP_REGEN_AT_FULL);
  const draw = capacitorBudget(fitDefinitionsOf(entity.vessel));
  const prev = entity.capacitor?.current ?? capacity;
  const current = capStep(prev, draw, regen, capacity);
  entity.capacitor = { capacity, current, regenPerTick: regen };
  const depleted = current <= 0;
  return { capacity, current, draw, regen, depleted, newlyDepleted: depleted && prev > 0 };
}
