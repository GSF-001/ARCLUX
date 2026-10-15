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
// ThreatCrush (CWE-79): semua render via DOM API + textContent — tanpa innerHTML.

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

/** DOM helper — style object → elemen. Tanpa innerHTML (CWE-79). */
function div(css: Partial<CSSStyleDeclaration>, text?: string): HTMLDivElement {
  const d = document.createElement("div");
  Object.assign(d.style, css);
  if (text !== undefined) d.textContent = text;
  return d;
}

function span(css: Partial<CSSStyleDeclaration>, text?: string): HTMLSpanElement {
  const s = document.createElement("span");
  Object.assign(s.style, css);
  if (text !== undefined) s.textContent = text;
  return s;
}

const microLabel = (text: string): HTMLDivElement =>
  div({
    fontSize: typography.sizes.micro, color: colors.muted,
    textTransform: "uppercase", fontWeight: "700",
  }, text);

export function initCombatHud(container?: HTMLElement): CombatHud {
  const root = container ?? (typeof document !== "undefined" ? document.body : null);
  const noop = (): CombatHud => ({
    update: () => {}, setProjector: () => {}, onCue: () => {},
    arrowTargetId: null, nearestWreckId: () => null, cycleTargetId: () => null, dispose: () => {},
  });
  if (!root) return noop();

  const el = document.createElement("div");
  el.id = "arclux-combat-hud";
  Object.assign(el.style, {
    position: "fixed", inset: "0", pointerEvents: "none",
    fontFamily: typography.mono, color: colors.foreground,
    letterSpacing: typography.letterspacing, zIndex: "11",
  } satisfies Partial<CSSStyleDeclaration>);

  // ---- Skeleton (DOM API, bukan innerHTML) ----
  const lockList = div({ marginTop: "4px" });
  const locksPanel = div({
    position: "absolute", left: spacing.inset, bottom: spacing.inset,
    width: "260px",
    background: `linear-gradient(90deg, ${glow.panelBg}, transparent)`,
    borderLeft: `2px solid ${colors.edge}`, paddingLeft: "10px",
  });
  locksPanel.append(microLabel("TGT LOCK // ≤3"), lockList);

  const waveData = div({
    fontSize: typography.sizes.data, color: colors.tactical,
    fontWeight: "400", marginTop: "2px",
  });
  const wavePanel = div({
    position: "absolute", right: spacing.inset, top: spacing.inset,
    textAlign: "right",
    background: `linear-gradient(-90deg, ${glow.panelBg}, transparent)`,
    borderRight: `2px solid ${colors.edge}`, paddingRight: "10px", display: "none",
  });
  wavePanel.append(microLabel("WAVE"), waveData);

  const salvage = div({
    position: "absolute", bottom: spacing.inset, left: "50%",
    transform: "translateX(-50%)", display: "none",
    border: `1px solid ${colors.warn}`, background: glow.panelBg,
    padding: "6px 14px", fontSize: typography.sizes.data, color: colors.warn,
    textShadow: glow.textTech,
  });
  salvage.append(
    document.createTextNode("WRECK IN RANGE — "),
    span({ color: colors.foreground, fontWeight: "700" }, "[B]"),
    document.createTextNode(" SALVAGE"),
  );

  const reload = div({
    position: "absolute", bottom: spacing.inset, right: spacing.inset,
    display: "flex", gap: "8px",
  });

  const arrow = div({
    position: "absolute", left: "50%", top: "50%", display: "none",
    fontSize: "22px", color: colors.tactical,
    textShadow: `0 0 8px ${colors.tactical}`, transformOrigin: "center",
  }, "▲");

  el.append(locksPanel, wavePanel, salvage, reload, arrow);
  root.appendChild(el);

  let projector: ((pos: { x: number; y: number; z: number }) => { x: number; y: number; visible: boolean }) | null = null;
  let cueCb: ((cue: LockCue) => void) | null = null;
  const lastPhase = new Map<string, string>();
  let contacts: string[] = []; // cycle target (T)
  let cycleIdx = -1;
  const wrecksInRange: Array<{ id: string; d: number }> = [];
  let arrowTarget: string | null = null;

  /** Satu baris lock slot — DOM API. */
  const renderLockRow = (l: { targetId: string; phase: string; progress: number; need: number }, i: number): HTMLElement => {
    const pct = l.need > 0 ? Math.min(100, Math.round((l.progress / l.need) * 100)) : 0;
    const barColor = l.phase === "locked" ? colors.ok : l.phase === "breaking" ? colors.danger : colors.warn;

    const row = div({
      display: "flex", justifyContent: "space-between",
      fontSize: typography.sizes.micro, fontWeight: "400", lineHeight: "1.9",
    });
    row.append(span({ color: colors.body }, `${i === 0 ? "▸" : "·"} ${l.targetId.slice(0, 14)}`));

    const phaseSpan = document.createElement("span");
    if (l.phase === "locked") phaseSpan.textContent = "LOCKED";
    else if (l.phase === "breaking") phaseSpan.textContent = "BREAKING";
    else phaseSpan.textContent = `${pct}%`;
    phaseSpan.style.color = l.phase === "locked" ? colors.ok : l.phase === "breaking" ? colors.danger : colors.warn;
    row.append(phaseSpan);

    const track = span({
      display: "inline-block", width: "56px", height: "6px",
      background: colors.struct, border: `1px solid ${colors.edge}`,
    });
    const fill = span({
      display: "block", height: "100%", width: `${pct}%`,
      background: barColor, boxShadow: `0 0 6px ${barColor}`,
    });
    track.append(fill);
    row.append(track);
    return row;
  };

  const update = (snap: RegionSnapshot, localVessel?: VesselEntity): void => {
    const tac = snap.tactical;
    const pos = localVessel?.position;

    // ---- M8: lock slots + phase cues ----
    lockList.replaceChildren();
    if (!tac || tac.locks.length === 0) {
      lockList.append(div({
        fontSize: typography.sizes.data, color: colors.empty, fontWeight: "400",
      }, "NO LOCK"));
      lastPhase.clear();
      arrowTarget = null;
    } else {
      tac.locks.forEach((l, i) => {
        // Cue: transisi phase per target (tick acquiring tiap naik, locked, broken).
        const prev = lastPhase.get(l.targetId);
        if (prev !== l.phase) {
          if (prev && l.phase === "acquiring") cueCb?.("tick");
          if (l.phase === "locked") cueCb?.("locked");
          if (l.phase === "breaking" || (!prev && l.phase === "acquiring")) cueCb?.(prev ? "broken" : "tick");
          lastPhase.set(l.targetId, l.phase);
        }
        lockList.append(renderLockRow(l, i));
      });
      arrowTarget = tac.locks[0]?.targetId ?? null;
    }

    // ---- M8: off-screen arrow ke lock[0] ----
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

    // ---- M9: wave counter ----
    const w = tac?.wave;
    if (!w || w.wave <= 0) {
      wavePanel.style.display = "none";
    } else {
      wavePanel.style.display = "block";
      const alive = Math.max(0, w.spawned); // spawned = indikator kasar; phase label utama
      const phaseCol = w.phase === "failed" ? colors.danger : w.phase === "completed" ? colors.ok : colors.tactical;
      waveData.replaceChildren(
        document.createTextNode(`#${w.wave} · `),
        span({ color: phaseCol }, w.phase.toUpperCase()),
        document.createTextNode(` · ${alive}/${w.total}`),
        ...(w.continuous ? [span({ color: colors.muted }, " · CONT")] : []),
      );
    }

    // ---- M9: salvage prompt (wreck ≤ range dari posisi kapal) ----
    wrecksInRange.length = 0;
    if (tac && pos) {
      for (const wreck of tac.wrecks) {
        const d = Math.hypot(wreck.position.x - pos.x, wreck.position.y - pos.y, wreck.position.z - pos.z);
        if (d <= SALVAGE_RANGE_M) wrecksInRange.push({ id: wreck.id, d });
      }
      wrecksInRange.sort((a, b) => a.d - b.d);
      salvage.style.display = wrecksInRange.length ? "block" : "none";
    }

    // ---- M9: reload bars (cooldowns weapon aktif) ----
    reload.replaceChildren();
    if (localVessel) {
      const cds = Object.entries(localVessel.cooldowns ?? {}).filter(([k, v]) => k.startsWith("weapon.") && v > 0);
      for (const [k, v] of cds) {
        const max = WEAPON_DEFS[k]?.cooldownTicks ?? v;
        const pct = Math.min(100, Math.round((v / max) * 100));
        const name = WEAPON_LABEL[k] ?? k.slice(7, 10).toUpperCase();
        const cell = div({ textAlign: "center" });
        cell.append(microLabel(name));
        const track = span({
          display: "inline-block", width: "34px", height: "7px",
          background: colors.struct, border: `1px solid ${colors.edge}`, marginTop: "2px",
        });
        track.append(span({
          display: "block", height: "100%", width: `${pct}%`,
          background: colors.warn, boxShadow: `0 0 6px ${colors.warn}`,
        }));
        cell.append(track);
        reload.append(cell);
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
