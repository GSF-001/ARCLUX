// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// src/renderer/combatHud.ts — combat UX layer Fase 3 (09-addendum M8/M9):
//   M8: target lock panel (≤3 slot, phase + progress per slot), off-screen
//       direction arrow ke lock pertama, lock audio cues (transisi phase).
//   M9: reload/cooldown bar per weapon (dari entity.cooldowns), wave counter
//       (snapshot.tactical.wave), salvage prompt (wreck ≤ 500m, tombol B).
// Semua data = snapshot server (tactical projection PR-J) — visual saja di
// sini; TIDAK ada logika combat client-side (D-008).

import type { RegionSnapshot, VesselEntity } from "../../../../mmo/packages/gameserver/types";
import { colors, typography, spacing, glow } from "../ui/tokens";
import { WEAPON_DEFS } from "../../../../mmo/packages/gameserver/projectiles";
import { SALVAGE_RANGE_M } from "../../../../mmo/packages/gameserver/npcBrain";

/** Transisi phase lock per target — renderer kirim ke audio.ui(). */
export type LockCue = "tick" | "locked" | "broken";

export interface CombatHud {
  update(snap: RegionSnapshot, localVessel?: VesselEntity): void;
  /** World → screen (dari scene camera). Dipakai off-screen arrow. */
  setProjector(fn: ((pos: { x: number; y: number; z: number }) => { x: number; y: number; visible: boolean }) | null): void;
  /** Callback transisi lock (untuk sfx). */
  onCue(cb: ((cue: LockCue) => void) | null): void;
  /** Target terpilih untuk arrow (snapshot tactical.locks[0]). */
  readonly arrowTargetId: string | null;
  /** Wreck terdekat dalam salvage range (untuk keybind B di renderer). */
  nearestWreckId(): string | null;
  /** Kontak cycle untuk keybind T (lock berikutnya). */
  cycleTargetId(): string | null;
  dispose(): void;
}

const WEAPON_LABEL: Record<string, string> = {
  "weapon.missile": "MSL",
  "weapon.torpedo": "TRP",
  "weapon.rocket": "RKT",
  "weapon.plasma": "PLS",
  "weapon.railgun": "RAIL",
  "weapon.emp": "EMP",
  "weapon.explosive": "EXPL",
};

export function initCombatHud(container?: HTMLElement): CombatHud {
  const root = container ?? (typeof document !== "undefined" ? document.body : null);
  const noop = (): CombatHud => ({
    update: () => {}, setProjector: () => {}, onCue: () => {},
    arrowTargetId: null, nearestWreckId: () => null, cycleTargetId: () => null, dispose: () => {},
  });
  if (!root) return noop();

  const el = document.createElement("div");
  el.id = "arclux-combat-hud";
  el.style.cssText = [
    "position:fixed", "inset:0", "pointer-events:none",
    `font-family:${typography.mono}`, `color:${colors.foreground}`,
    `letter-spacing:${typography.letterspacing}`, "z-index:11",
  ].join(";");
  const label = `style="font-size:${typography.sizes.micro};color:${colors.muted};text-transform:uppercase;font-weight:700"`;
  const esc = (s: unknown): string =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  el.innerHTML = `
    <div data-chud="locks" style="position:absolute;left:${spacing.inset};bottom:${spacing.inset};width:260px;background:linear-gradient(90deg,${glow.panelBg},transparent);border-left:2px solid ${colors.edge};padding-left:10px">
      <div ${label}>TGT LOCK // ${"≤3"}</div>
      <div data-chud="locklist" style="margin-top:4px"></div>
    </div>
    <div data-chud="wave" style="position:absolute;right:${spacing.inset};top:${spacing.inset};text-align:right;background:linear-gradient(-90deg,${glow.panelBg},transparent);border-right:2px solid ${colors.edge};padding-right:10px;display:none">
      <div ${label}>WAVE</div>
      <div data-chud="wavedata" style="font-size:${typography.sizes.data};color:${colors.tactical};font-weight:400;margin-top:2px"></div>
    </div>
    <div data-chud="salvage" style="position:absolute;bottom:${spacing.inset};left:50%;transform:translateX(-50%);display:none;border:1px solid ${colors.warn};background:${glow.panelBg};padding:6px 14px;font-size:${typography.sizes.data};color:${colors.warn};text-shadow:${glow.textTech}">
      WRECK IN RANGE — <span style="color:${colors.foreground};font-weight:700">[B]</span> SALVAGE
    </div>
    <div data-chud="reload" style="position:absolute;bottom:${spacing.inset};right:${spacing.inset};display:flex;gap:8px"></div>
    <div data-chud="arrow" style="position:absolute;left:50%;top:50%;display:none;font-size:22px;color:${colors.tactical};text-shadow:0 0 8px ${colors.tactical};transform-origin:center">▲</div>
  `;
  root.appendChild(el);
  const q = (sel: string): HTMLElement | null => el.querySelector(sel);

  let projector: ((pos: { x: number; y: number; z: number }) => { x: number; y: number; visible: boolean }) | null = null;
  let cueCb: ((cue: LockCue) => void) | null = null;
  const lastPhase = new Map<string, string>();
  let contacts: string[] = []; // cycle target (T)
  let cycleIdx = -1;
  const wrecksInRange: Array<{ id: string; d: number }> = [];
  let arrowTarget: string | null = null;

  const update = (snap: RegionSnapshot, localVessel?: VesselEntity): void => {
    const tac = snap.tactical;
    const pos = localVessel?.position;

    // ---- M8: lock slots + phase cues ----
    const lockList = q('[data-chud="locklist"]');
    if (lockList) {
      if (!tac || tac.locks.length === 0) {
        lockList.innerHTML = `<div style="font-size:${typography.sizes.data};color:${colors.empty};font-weight:400">NO LOCK</div>`;
        lastPhase.clear();
        arrowTarget = null;
      } else {
        lockList.innerHTML = tac.locks.map((l, i) => {
          const pct = l.need > 0 ? Math.min(100, Math.round((l.progress / l.need) * 100)) : 0;
          const barColor = l.phase === "locked" ? colors.ok : l.phase === "breaking" ? colors.danger : colors.warn;
          const phaseTag = l.phase === "locked" ? `<span style="color:${colors.ok}">LOCKED</span>`
            : l.phase === "breaking" ? `<span style="color:${colors.danger}">BREAKING</span>`
            : `<span style="color:${colors.warn}">${pct}%</span>`;
          // Cue: transisi phase per target (tick acquiring tiap naik, locked, broken).
          const prev = lastPhase.get(l.targetId);
          if (prev !== l.phase) {
            if (prev && l.phase === "acquiring") cueCb?.("tick");
            if (l.phase === "locked") cueCb?.("locked");
            if (l.phase === "breaking" || (!prev && l.phase === "acquiring")) cueCb?.(prev ? "broken" : "tick");
            lastPhase.set(l.targetId, l.phase);
          }
          return `<div style="display:flex;justify-content:space-between;font-size:${typography.sizes.micro};font-weight:400;line-height:1.9">
            <span style="color:${colors.body}">${i === 0 ? "▸" : "·"} ${esc(l.targetId.slice(0, 14))}</span>
            <span>${phaseTag}</span>
            <span style="display:inline-block;width:56px;height:6px;background:${colors.struct};border:1px solid ${colors.edge}">
              <span style="display:block;height:100%;width:${pct}%;background:${barColor};box-shadow:0 0 6px ${barColor}"></span>
            </span>
          </div>`;
        }).join("");
        arrowTarget = tac.locks[0]?.targetId ?? null;
      }
    }

    // ---- M8: off-screen arrow ke lock[0] ----
    const arrow = q('[data-chud="arrow"]');
    if (arrow) {
      const tgtEnt = arrowTarget ? snap.entities.find((e) => e.id === arrowTarget) : undefined;
      if (!tgtEnt || !projector || !pos) {
        arrow.style.display = "none";
      } else {
        const p = projector(tgtEnt.position);
        if (p.visible) {
          arrow.style.display = "none"; // di viewport — marker scene yang pegang
        } else {
          // Arahkan panah ke tepi layar: vektor proyeksi relatif pusat.
          const dx = p.x - window.innerWidth / 2;
          const dy = p.y - window.innerHeight / 2;
          const ang = Math.atan2(dy, dx);
          const rx = (window.innerWidth / 2 - 36) * Math.cos(ang);
          const ry = (window.innerHeight / 2 - 36) * Math.sin(ang);
          arrow.style.display = "block";
          arrow.style.left = `${window.innerWidth / 2 + rx - 10}px`;
          arrow.style.top = `${window.innerHeight / 2 + ry - 12}px`;
          arrow.style.transform = `rotate(${ang + Math.PI / 2}rad)`;
        }
      }
    }

    // ---- M9: wave counter ----
    const waveEl = q('[data-chud="wave"]');
    const waveData = q('[data-chud="wavedata"]');
    if (waveEl && waveData) {
      const w = tac?.wave;
      if (!w || w.wave <= 0) {
        waveEl.style.display = "none";
      } else {
        waveEl.style.display = "block";
        const alive = Math.max(0, w.spawned); // spawned = indikator kasar; phase label utama
        const phaseCol = w.phase === "failed" ? colors.danger : w.phase === "completed" ? colors.ok : colors.tactical;
        waveData.innerHTML = `#${w.wave} · <span style="color:${phaseCol}">${esc(w.phase.toUpperCase())}</span> · ${alive}/${w.total}${w.continuous ? ` · <span style="color:${colors.muted}">CONT</span>` : ""}`;
      }
    }

    // ---- M9: salvage prompt (wreck ≤ range dari posisi kapal) ----
    const salv = q('[data-chud="salvage"]');
    wrecksInRange.length = 0;
    if (salv && tac && pos) {
      for (const w of tac.wrecks) {
        const d = Math.hypot(w.position.x - pos.x, w.position.y - pos.y, w.position.z - pos.z);
        if (d <= SALVAGE_RANGE_M) wrecksInRange.push({ id: w.id, d });
      }
      wrecksInRange.sort((a, b) => a.d - b.d);
      salv.style.display = wrecksInRange.length ? "block" : "none";
    }

    // ---- M9: reload bars (cooldowns weapon aktif) ----
    const reload = q('[data-chud="reload"]');
    if (reload && localVessel) {
      const cds = Object.entries(localVessel.cooldowns ?? {}).filter(([k, v]) => k.startsWith("weapon.") && v > 0);
      if (!cds.length) {
        reload.innerHTML = "";
      } else {
        reload.innerHTML = cds.map(([k, v]) => {
          const max = WEAPON_DEFS[k]?.cooldownTicks ?? v;
          const pct = Math.min(100, Math.round((v / max) * 100));
          const name = WEAPON_LABEL[k] ?? k.slice(7, 10).toUpperCase();
          return `<div style="text-align:center">
            <div style="font-size:${typography.sizes.micro};color:${colors.muted};font-weight:700">${esc(name)}</div>
            <span style="display:inline-block;width:34px;height:7px;background:${colors.struct};border:1px solid ${colors.edge};margin-top:2px">
              <span style="display:block;height:100%;width:${pct}%;background:${colors.warn};box-shadow:0 0 6px ${colors.warn}"></span>
            </span>
          </div>`;
        }).join("");
      }
    }

    // ---- Kontak cycle (T) — semua vessel selain diri ----
    contacts = snap.entities
      .filter((e) => e.kind === "vessel" && e.id !== localVessel?.id)
      .map((e) => e.id);
  };

  return {
    update,
    setProjector: (fn) => { projector = fn; },
    onCue: (cb) => { cueCb = cb; },
    get arrowTargetId() { return arrowTarget; },
    nearestWreckId: () => wrecksInRange[0]?.id ?? null,
    cycleTargetId: () => {
      if (!contacts.length) return null;
      cycleIdx = (cycleIdx + 1) % contacts.length;
      return contacts[cycleIdx];
    },
    dispose: () => { if (el.parentElement) el.parentElement.removeChild(el); },
  };
}
