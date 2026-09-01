// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// src/renderer/hud.ts — EVE-level command HUD overlay (01-spatial-ux §20/§28).
// Data-dense INDUSTRIAL, bukan SaaS dashboard card: cockpit universal (§20.4),
// tactical readout (§7), region/system telemetry, vessel identity (§20.8).
// Visual hanya representasi client; data authoritative dari server (D-008).

import type { RegionState, VesselEntity, StationEntity } from "../../../../packages/gameserver/types";

export interface Hud {
  update(region: RegionState): void;
  setTick(tick: number): void;
  dispose(): void;
}

export function initHud(container?: HTMLElement): Hud {
  const root = container ?? (typeof document !== "undefined" ? document.body : null);
  if (!root) return { update: () => {}, setTick: () => {}, dispose: () => {} };

  const el = document.createElement("div");
  el.id = "arclux-hud";
  el.style.cssText = [
    "position:fixed", "inset:0", "pointer-events:none",
    "font-family:'JetBrains Mono',monospace", "color:#c9d6ff",
    "text-shadow:0 0 6px rgba(60,160,255,0.35)",
    "letter-spacing:0.5px", "z-index:10",
  ].join(";");
  el.innerHTML = `
    <div data-hud="top" style="position:absolute;top:16px;left:50%;transform:translateX(-50%);text-align:center">
      <div data-hud="region" style="font-size:15px;font-weight:600;color:#9cd6ff;text-transform:uppercase">—</div>
      <div data-hud="sysmeta" style="font-size:10px;color:#5c7db0;margin-top:3px">SYSTEM ONLINE</div>
    </div>
    <div data-hud="left" style="position:absolute;left:18px;top:50%;transform:translateY(-50%);width:230px">
      <div style="font-size:9px;color:#5c7db0;text-transform:uppercase;margin-bottom:6px">TAC // TARGET</div>
      <div data-hud="target" style="font-size:11px;line-height:1.7;color:#8fb1e0"></div>
    </div>
    <div data-hud="right" style="position:absolute;right:18px;top:50%;transform:translateY(-50%);width:250px;text-align:right">
      <div style="font-size:9px;color:#5c7db0;text-transform:uppercase;margin-bottom:6px">VESSEL // STATE</div>
      <div data-hud="vessel" style="font-size:11px;line-height:1.7;color:#8fb1e0"></div>
    </div>
    <div data-hud="bottom" style="position:absolute;bottom:18px;left:50%;transform:translateX(-50%);text-align:center">
      <div style="font-size:9px;color:#5c7db0;text-transform:uppercase;margin-bottom:6px">COCKPIT // UNIVERSAL</div>
      <div data-hud="slots" style="display:flex;gap:10px;justify-content:center">
        ${["MOVE", "TARGET", "SCAN", "DOCK", "ACTIVATE"].map((s, i) => `
          <div style="border:1px solid #2c4566;padding:5px 12px;font-size:10px;color:#9cd6ff;background:rgba(10,18,32,0.55)">
            <span style="color:#5c7db0">${i + 1}</span> ${s}
          </div>`).join("")}
      </div>
      <div data-hud="tick" style="font-size:10px;color:#5c7db0;margin-top:8px">TICK —</div>
    </div>
    <div data-hud="frame" style="position:absolute;top:16px;left:16px;background:linear-gradient(135deg,rgba(60,140,255,0.12),rgba(60,140,255,0));width:90px;height:54px;border:1px solid #2c4566;border-right:none;border-top:none;opacity:0.6"></div>
    <div data-hud="frame2" style="position:absolute;top:16px;right:16px;background:linear-gradient(-135deg,rgba(60,140,255,0.12),rgba(60,140,255,0));width:90px;height:54px;border:1px solid #2c4566;border-left:none;border-top:none;opacity:0.6"></div>
  `;
  root.appendChild(el);

  const q = (sel: string): HTMLElement | null => el.querySelector(sel);

  const update = (region: RegionState): void => {
    const regionEl = q('[data-hud="region"]');
    if (regionEl) regionEl.textContent = region.name || region.regionId;

    // Vessel utama (pertama) = "kapal pemain" untuk demo; data server-authoritative.
    let player: VesselEntity | undefined;
    let station: StationEntity | undefined;
    for (const e of region.entities.values()) {
      if (e.kind === "vessel" && !player) player = e as VesselEntity;
      else if (e.kind === "station" && !station) station = e as StationEntity;
      if (player && station) break;
    }

    if (player) {
      const v = q('[data-hud="vessel"]');
      if (v) {
        const model = player.vessel;
        v.innerHTML = [
          `<div style="color:#9cd6ff;font-size:12px">${model?.name ?? "VESSEL"} <span style="color:#5c7db0">· ${log2(player.id)}</span></div>`,
          `OWNER <span style="color:#c9d6ff">${player.owner ?? "—"}</span>`,
          `FACTION <span style="color:#c9d6ff">${player.faction ?? "NEUTRAL"}</span>`,
          `INTEGRITY <span style="color:#c9d6ff">${model?.integrity != null ? Math.round(model.integrity) : "—"}</span>`,
          `DEFENSE <span style="color:#c9d6ff">${model?.defense != null ? Math.round(model.defense) : "—"}</span>`,
          `WEAPONS <span style="color:#c9d6ff">${model?.weapons != null ? Math.round(model.weapons) : "—"}</span>`,
          `ENGINE <span style="color:#c9d6ff">${model?.engine != null ? Math.round(model.engine) : "—"}</span>`,
          `SPEED <span style="color:#c9d6ff">${Math.round(mag(player.velocity) ?? 0)} m/s</span>`,
          `HASH <span style="color:#5c7db0">${player.stateHash?.slice(0, 10) ?? "—"}</span>`,
        ].join("<br>");
      }
    }

    const tgt = q('[data-hud="target"]');
    if (tgt) {
      const vacuum: string[] = [];
      for (const e of region.entities.values()) {
        if (!player || e.id === player.id) continue;
        const d = player ? dist(player.position, e.position) : 0;
        const tag = e.kind === "vessel" ? `🚀 ${log2(e.id)}` : `🛰 ${(e as StationEntity).name ?? log2(e.id)}`;
        vacuum.push(`${tag} <span style="color:#5c7db0">${formatDist(d)}</span>`);
      }
      tgt.innerHTML = vacuum.length ? vacuum.join("<br>") : `<span style="color:#33455e">NO CONTACTS</span>`;
    }

    const tickEl = q('[data-hud="tick"]');
    if (tickEl) tickEl.textContent = `TICK ${region.tick} · ${new Date(region.createdAt ?? Date.now()).toLocaleTimeString()}`;
  };

  const setTick = (tick: number) => {
    const tickEl = q('[data-hud="tick"]');
    if (tickEl) tickEl.textContent = `TICK ${tick}`;
  };

  const dispose = () => { if (el.parentElement) el.parentElement.removeChild(el); };

  return { update, setTick, dispose };
}

function mag(v: { x: number; y: number; z: number }): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}
function dist(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return mag({ x: b.x - a.x, y: b.y - a.y, z: b.z - a.z });
}
function formatDist(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}
function log2(s: string): string {
  return s.length > 14 ? s.slice(0, 14) : s;
}
