// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// src/renderer/hud.ts — Cockpit ARCLUX (01 §20/§28). Operasional console,
// data-dense industri, BUKAN dashboard-card. Blueprint:
//   §20.4 universal cockpit slots · §20.8 identitas sosial callsign/faksi ·
//   §7 tactical target grid · §11 subsystem visualization · §28 command-interface.
// Visual hanya representasi client; data authoritative dari server (D-008).
// Mengkonsumsi tokens (src/ui/tokens.ts) sebagai satu sumber — FIGMA nanti
// re-skin tokens, bukan reverse-engineer komponen.

import type { RegionState, VesselEntity, StationEntity } from "../../../../packages/gameserver/types";
import { colors, typography, spacing, glow } from "../ui/tokens";

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
    `font-family:${typography.mono}`, `color:${colors.foreground}`,
    `text-shadow:${glow.textTech}`,
    `letter-spacing:${typography.letterspacing}`, "z-index:10",
  ].join(";");

  // Gaya dasar elemen HUD (dipakai berulang)
  // Fase 7: hierarchy — label 700, data 400; panel fade 0.2s (di-set inline
  // per panel, dipicu via fadeOnChange di update() saat konten berubah).
  const label = `style="font-size:${typography.sizes.micro};color:${colors.muted};text-transform:uppercase;font-weight:700"`;
  const panelFade = "transition:opacity 0.2s ease";
  const panelEdgeL = `background:linear-gradient(90deg,${glow.panelBg},transparent);border-left:2px solid ${colors.edge};padding-left:10px`;
  const panelEdgeR = `background:linear-gradient(-90deg,${glow.panelBg},transparent);border-right:2px solid ${colors.edge};padding-right:10px`;
  const esc = (s: unknown): string =>
    String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  el.innerHTML = `
    <div data-hud="scanline" style="position:absolute;top:0;left:0;right:0;height:100%;background:repeating-linear-gradient(0deg,${glow.scanline} 0px,${glow.scanline} 2px,transparent 3px,transparent 8px);opacity:0.35"></div>

    <div data-hud="top" style="position:absolute;top:${spacing.inset};left:50%;transform:translateX(-50%);text-align:center">
      <div data-hud="region" style="font-family:${typography.display};${typography.displaySpacing && `letter-spacing:${typography.displaySpacing}`};font-size:${typography.sizes.display};font-weight:700;color:${colors.foreground};text-transform:uppercase">—</div>
      <div data-hud="sysmeta" style="font-size:${typography.sizes.micro};color:${colors.muted};margin-top:4px;text-transform:uppercase;font-weight:400">SYSTEM ONLINE</div>
    </div>

    <div data-hud="left" style="position:absolute;left:${spacing.inset};top:50%;transform:translateY(-50%);width:${spacing.panelWidthLeft};${panelFade};${panelEdgeL}">
      <div ${label}>TAC // TARGET</div>
      <div data-hud="target" style="font-size:${typography.sizes.data};line-height:1.8;color:${colors.body};font-weight:400;transition:text-shadow 0.2s ease"></div>
    </div>

    <div data-hud="right" style="position:absolute;right:${spacing.inset};top:50%;transform:translateY(-50%);width:${spacing.panelWidthRight};text-align:right;${panelFade};${panelEdgeR}">
      <div ${label}>VESSEL // STATE</div>
      <div data-hud="vessel" style="font-size:${typography.sizes.data};line-height:1.75;color:${colors.body};font-weight:400"></div>
      <div ${label} style="margin-top:12px">SUBSYSTEMS</div>
      <div data-hud="subsystems" style="margin-top:4px"></div>
    </div>

    <div data-hud="bottom" style="position:absolute;bottom:${spacing.inset};left:50%;transform:translateX(-50%);text-align:center">
      <div ${label}>COCKPIT // UNIVERSAL</div>
      <div data-hud="slots" style="display:flex;gap:${spacing.gapSlot};justify-content:center;margin-top:6px">
        ${["MOVE", "TARGET", "SCAN", "DOCK", "ACTIVATE"].map((s, i) => `
          <div style="border:1px solid ${colors.edge};padding:${spacing.slotPad};font-size:${typography.sizes.data};color:${colors.tech};background:${glow.panelBg};text-shadow:${glow.textTech}">
            <span style="color:${colors.muted}">${i + 1}</span> ${s}
          </div>`).join("")}
      </div>
      <div data-hud="tick" style="font-size:${typography.sizes.micro};color:${colors.muted};margin-top:9px;text-transform:uppercase">TICK —</div>
    </div>

    <div data-hud="frame" style="position:absolute;top:${spacing.inset};left:${spacing.inset};background:linear-gradient(135deg,${glow.frameGradient},transparent);width:110px;height:66px;border:1px solid ${colors.edge};border-right:none;border-top:none;opacity:0.7"></div>
    <div data-hud="frame2" style="position:absolute;top:${spacing.inset};right:${spacing.inset};background:linear-gradient(-135deg,${glow.frameGradient},transparent);width:110px;height:66px;border:1px solid ${colors.edge};border-left:none;border-top:none;opacity:0.7"></div>
  `;
  root.appendChild(el);

  const q = (sel: string): HTMLElement | null => el.querySelector(sel);

  // Fase 7: fade panel 0.2s hanya saat konten benar-benar berubah (hash guard
  // biar update 10Hz tidak bikin panel kedip terus-menerus).
  const lastHash = new Map<string, string>();
  const fadeOnChange = (key: string, panel: HTMLElement | null, content: string): void => {
    if (!panel || lastHash.get(key) === content) return;
    lastHash.set(key, content);
    panel.style.opacity = "0.35";
    requestAnimationFrame(() => { requestAnimationFrame(() => { panel.style.opacity = "1"; }); });
  };

  const update = (region: RegionState): void => {
    const regionEl = q('[data-hud="region"]');
    if (regionEl) regionEl.textContent = region.name || region.regionId;

    // Fase 7: scanline drift halus mengikuti tick (refine speed/opacity).
    const scan = q('[data-hud="scanline"]');
    if (scan) scan.style.backgroundPositionY = `${(region.tick * 2) % 8}px`;

    let player: VesselEntity | undefined;
    let station: StationEntity | undefined;
    for (const e of region.entities.values()) {
      if (e.kind === "vessel" && !player) player = e as VesselEntity;
      else if (e.kind === "station" && !station) station = e as StationEntity;
      if (player && station) break;
    }

    if (player) {
      const model = player.vessel;
      const v = q('[data-hud="vessel"]');
      if (v) {
        const faction = player.faction ?? "NEUTRAL";
        const factionColor = factionColorFor(faction);
        const html = [
          `<div style="font-family:${typography.display};font-size:${typography.sizes.title};font-weight:700;letter-spacing:${typography.displaySpacing};color:${colors.foreground};text-transform:uppercase">${esc(model?.name ?? "VESSEL")} <span style="font-family:${typography.mono};color:${colors.muted};font-size:${typography.sizes.micro};font-weight:400">${esc(log2(player.id))}</span></div>`,
          `<div style="font-size:${typography.sizes.data};font-weight:400;color:${factionColor};text-shadow:${glow.textTactical};margin-top:2px">${esc(faction.toUpperCase())} // PILOT</div>`,
          `INTEGRITY <span style="color:${colors.tech}">${model?.integrity != null ? Math.round(model.integrity) : "—"}</span>`,
          `DEFENSE  <span style='color:${colors.tech}'>${model?.defense != null ? Math.round(model.defense) : "—"}</span>`,
          `WEAPONS  <span style='color:${colors.tech}'>${model?.weapons != null ? Math.round(model.weapons) : "—"}</span>`,
          `SPEED  <span style='color:${colors.body}'>${Math.round(mag(player.velocity) ?? 0)} m/s</span>`,
          `HASH  <span style='color:${colors.muted}'>${esc(player.stateHash?.slice(0, 10) ?? "—")}</span>`,
        ].join("<br>");
        fadeOnChange("vessel", q('[data-hud="right"]'), html);
        v.innerHTML = html;
      }

      const subs = q('[data-hud="subsystems"]');
      if (subs && model?.systems) {
        const html = model.systems.slice(0, 6).map((s: { label?: string; health?: number }) => {
          const lvl = s.health != null ? Math.max(0, Math.min(100, Math.round((s.health as number) * 100))) : 0;
          const barColor = lvl > 60 ? colors.ok : lvl > 30 ? colors.warn : colors.danger;
          return `<div style="display:flex;justify-content:space-between;gap:8px;font-size:${typography.sizes.micro};font-weight:400;line-height:1.9">
            <span style="color:${colors.muted};text-transform:uppercase">${esc(logLabel(s.label))}</span>
            <span style="display:inline-block;width:74px;height:7px;background:${colors.struct};border:1px solid ${colors.edge}">
              <span data-subbar style="display:block;height:100%;width:${lvl}%;background:${barColor};box-shadow:0 0 8px ${barColor}"></span>
            </span>
          </div>`;
        }).join("");
        fadeOnChange("subsystems", q('[data-hud="right"]'), html);
        subs.innerHTML = html;
      }
    }

    const tgt = q('[data-hud="target"]');
    if (tgt) {
      const vacuum: string[] = [];
      for (const e of region.entities.values()) {
        if (!player || e.id === player.id) continue;
        const d = player ? dist(player.position, e.position) : 0;
        const tag = e.kind === "vessel" ? `▸ VSL ${esc(log2(e.id))}` : `◈ STN ${esc((e as StationEntity).name ?? log2(e.id))}`;
        const dcol = e.kind === "station" ? colors.ok : colors.tactical;
        vacuum.push(`${tag} <span style="color:${dcol}">${formatDist(d)}</span>`);
      }
      const html = vacuum.length ? vacuum.join("<br>") : `<span style="color:${colors.empty}">NO CONTACTS</span>`;
      fadeOnChange("target", q('[data-hud="left"]'), html);
      tgt.innerHTML = html;
      // Fase 7: target panel glow — text-shadow pulse saat ada kontak aktif.
      if (vacuum.length) {
        const pulse = 0.55 + 0.45 * Math.sin(Date.now() / 380);
        const blur = (6 + 6 * pulse).toFixed(1);
        const alpha = (0.35 + 0.3 * pulse).toFixed(2);
        tgt.style.textShadow = `0 0 ${blur}px rgba(255,179,107,${alpha})`;
      } else {
        tgt.style.textShadow = "none";
      }
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

function factionColorFor(faction: string): string {
  const f = faction.toUpperCase();
  if (f.includes("A") || f.includes("KV") || f.includes("VLT")) return colors.factionA;
  if (f.includes("B") || f.includes("AB") || f.includes("ORA")) return colors.factionB;
  return colors.neutral;
}
function logLabel(s?: string): string {
  if (!s) return "—";
  return s.length > 10 ? s.replace(/([A-Z])/g, " $1").trim().slice(0, 14) : s.toUpperCase();
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