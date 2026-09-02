// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// src/renderer/menu.ts — Escape/Settings menu (01 §28 command-interface).
// Sidebar tabs: GRAPHICS · AUDIO · CONTROLS. Persist ke localStorage via
// settings engine (settings.ts). Visual berubah live by renderer via callbacks
// (scene.applyQuality, audio.setEnabled). XSS-safe: hanya static innerHTML /
// literal; SEMUA nilai dinamis lewat textContent/value, tidak ada concat HTML.

import { colors, typography, glow } from "../ui/tokens";
import {
  loadSettings, saveSettings, applyPreset, updateSettings,
  type GameSettings, type QualityPreset, type FpsCap, type BloomQuality,
} from "./settings";

export type MenuCameraMode = "free" | "follow" | "tactical" | "cinematic";

export interface MenuHandle {
  toggle(): void;
  open(): void;
  close(): void;
  readonly isOpen: boolean;
  dispose(): void;
}

export interface MenuCallbacks {
  onQuality(s: GameSettings): void;
  onAudio(s: GameSettings): void;
  onCameraMode(mode: MenuCameraMode): void;
  onSfx?(kind: "hover" | "click"): void;
}

const PRESET_OPTS: QualityPreset[] = ["LOW", "MEDIUM", "HIGH", "ULTRA", "CINEMATIC"];
const FPS_OPTS: FpsCap[] = [30, 60, 90, 120, 240, 0];
const BLOOM_OPTS: BloomQuality[] = ["off", "low", "high"];

export function initMenu(callbacks: MenuCallbacks): MenuHandle {
  const root = typeof document !== "undefined" ? document.body : null;
  if (!root) {
    return { toggle: () => {}, open: () => {}, close: () => {}, isOpen: false, dispose: () => {} };
  }

  let isOpen = false;
  const els = new Map<string, HTMLElement>();

  const wrap = document.createElement("div");
  wrap.id = "arclux-menu";
  wrap.style.cssText = [
    "position:fixed", "inset:0", "z-index:80",
    "background:rgba(2,3,10,0.55)", "backdrop-filter:blur(2px)",
    "display:none", "align-items:center", "justify-content:flex-end",
  ].join(";");
  root.appendChild(wrap);

  const panel = document.createElement("div");
  panel.style.cssText = [
    `width:380px`, "height:100%",
    "background:linear-gradient(180deg,rgba(10,16,28,0.92),rgba(6,9,18,0.96))",
    `border-left:1px solid ${colors.edge}`,
    `font-family:${typography.mono}`, `color:${colors.foreground}`,
    "padding:22px", "box-sizing:border-box", "overflow-y:auto",
    `letter-spacing:${typography.letterspacing}`,
  ].join(";");
  wrap.appendChild(panel);

  // Header
  const head = document.createElement("div");
  head.style.cssText = `display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid ${colors.edge};padding-bottom:12px;margin-bottom:14px`;
  panel.appendChild(head);
  const title = document.createElement("div");
  title.style.cssText = `font-family:${typography.display};letter-spacing:${typography.displaySpacing};font-weight:700`;
  title.textContent = "SYSTEM SETTINGS";
  head.appendChild(title);
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "ESC ×";
  closeBtn.style.cssText = `background:${glow.panelBg};border:1px solid ${colors.edge};color:${colors.tactical};padding:4px 10px;cursor:pointer;font-family:inherit`;
  head.appendChild(closeBtn);

  // Tabs
  const tabs = document.createElement("div");
  tabs.style.cssText = "display:flex;gap:8px;margin-bottom:18px";
  panel.appendChild(tabs);
  const tabIds = ["GRAPHICS", "AUDIO", "CONTROLS"] as const;
  const tabBtns = new Map<string, HTMLButtonElement>();
  const sections = new Map<string, HTMLElement>();
  for (const id of tabIds) {
    const b = document.createElement("button");
    b.textContent = id;
    b.style.cssText = `padding:6px 14px;border:1px solid ${colors.edge};background:${glow.panelBg};color:${colors.muted};cursor:pointer;font-family:inherit;font-size:11px`;
    tabs.appendChild(b);
    tabBtns.set(id, b);
    const sec = document.createElement("div");
    sec.style.display = "none";
    panel.appendChild(sec);
    sections.set(id, sec);
  }

  const activate = (id: string): void => {
    for (const [k, b] of tabBtns) {
      const on = k === id;
      b.style.color = on ? colors.tech : colors.muted;
      b.style.borderColor = on ? colors.tech : colors.edge;
      b.style.textShadow = on ? glow.textTech : "none";
      sections.get(k)!.style.display = k === id ? "block" : "none";
    }
  };
  for (const [id, b] of tabBtns) {
    b.addEventListener("click", () => { activate(id); callbacks.onSfx?.("click"); });
  }

  // Builder
  const row = (labelText: string): HTMLElement => {
    const r = document.createElement("div");
    r.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px dashed rgba(90,110,146,0.25);margin-bottom:6px";
    const lb = document.createElement("span");
    lb.style.cssText = "font-size:11px;color:" + colors.body;
    lb.textContent = labelText;
    r.appendChild(lb);
    return r;
  };
  const paintList = (container: HTMLElement, current: string): void => {
    for (const b of Array.from(container.querySelectorAll("button"))) {
      const bt = b as HTMLButtonElement;
      const on = bt.getAttribute("aria-checked") === current;
      bt.style.color = on ? colors.tech : colors.muted;
      bt.style.borderColor = on ? colors.tech : colors.edge;
      bt.style.textShadow = on ? glow.textTech : "none";
    }
  };
  const optsRow = (sec: HTMLElement, labelText: string, values: readonly string[], current: string, onPick: (v: string) => void): void => {
    const r = row(labelText);
    const list = document.createElement("span");
    list.style.cssText = "display:flex;gap:6px;flex-wrap:wrap";
    for (const v of values) {
      const b = document.createElement("button");
      b.textContent = v;
      b.setAttribute("aria-checked", v);
      const vv = v;
      b.style.cssText = `padding:3px 8px;border:1px solid ${colors.edge};background:${glow.panelBg};color:${colors.muted};cursor:pointer;font-family:inherit;font-size:10px`;
      b.addEventListener("click", () => {
        callbacks.onSfx?.("click");
        onPick(vv);
      });
      b.addEventListener("mouseenter", () => callbacks.onSfx?.("hover"));
      list.appendChild(b);
    }
    r.appendChild(list);
    sec.appendChild(r);
    els.set(labelText, list);
    paintList(list, current);
  };

  // ===================== GRAPHICS =====================
  const g = sections.get("GRAPHICS")!;
  let cached = loadSettings();
  const commit = (patch: Partial<GameSettings> | ((s: GameSettings) => GameSettings)): GameSettings => {
    const next = typeof patch === "function" ? (patch as (s: GameSettings) => GameSettings)(cached) : { ...cached, ...patch };
    saveSettings(next);
    cached = next;
    callbacks.onQuality(next);
    return next;
  };

  const pickPreset = (v: string): void => {
    const next = applyPreset(v as QualityPreset);
    saveSettings(next);
    cached = next;
    callbacks.onQuality(next);
    refreshControls();
    refreshAudio();
  };
  function refreshControls(): void {
    const s = loadSettings();
    for (const meta of ctrlMeta) {
      const btn = els.get("K:" + meta.key) as HTMLButtonElement | undefined;
      if (btn) btn.textContent = prettyKey(s[meta.key]);
    }
  }
  function refreshAudio(): void {
    const s = loadSettings();
    mutedCache = s.muted;
    sensCache = s.lookSensitivity;
  }

  optsRow(g, "PRESET", PRESET_OPTS, cached.preset, pickPreset);
  optsRow(g, "FPS CAP", FPS_OPTS.map(String), String(cached.fpsCap), (v) => commit({ fpsCap: Number(v) as FpsCap }));
  optsRow(g, "BLOOM", BLOOM_OPTS, cached.bloom, (v) => commit({ bloom: v as BloomQuality }));

  const sliderRow = (sec: HTMLElement, labelText: string, get: (s: GameSettings) => number, set: (s: GameSettings, v: number) => GameSettings): void => {
    const r = row(labelText);
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0"; input.max = "1"; input.step = "0.05";
    input.value = String(get(cached));
    input.style.cssText = "width:120px;accent-color:" + colors.tactical;
    input.addEventListener("input", () => {
      commit(() => set(cached, Number(input.value)));
      callbacks.onSfx?.("click");
    });
    r.appendChild(input);
    sec.appendChild(r);
  };

  sliderRow(g, "NEBULA", (s) => s.nebulaDensity / 12, (s, v) => ({ ...s, nebulaDensity: Math.round(v * 12) }));
  sliderRow(g, "BELT", (s) => s.beltDensity / 10000, (s, v) => ({ ...s, beltDensity: Math.round(v * 10000) }));
  sliderRow(g, "STARS", (s) => s.starBodies / 3, (s, v) => ({ ...s, starBodies: Math.round(v * 3) }));

  // ===================== AUDIO =====================
  const a = sections.get("AUDIO")!;
  let mutedCache = cached.muted;
  const vol = (sec: HTMLElement, labelText: string, key: "masterVolume" | "sfxVolume" | "musicVolume"): void => {
    const r = row(labelText);
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0"; input.max = "1"; input.step = "0.05";
    input.value = String(cached[key]);
    input.style.cssText = "width:120px;accent-color:" + colors.tactical;
    input.addEventListener("input", () => {
      const s = commit({ [key]: Number(input.value) });
      callbacks.onAudio(s);
    });
    r.appendChild(input);
    sec.appendChild(r);
  };
  vol(a, "MASTER", "masterVolume");
  vol(a, "SFX", "sfxVolume");
  vol(a, "MUSIC", "musicVolume");

  const mRow = row("MUTE");
  const mBtn = document.createElement("button");
  mBtn.style.cssText = `padding:3px 10px;border:1px solid ${colors.edge};background:${glow.panelBg};color:${colors.tactical};cursor:pointer;font-family:inherit;font-size:10px`;
  const paintMute = (): void => {
    mBtn.textContent = mutedCache ? "MUTED" : "LIVE";
  };
  paintMute();
  mBtn.addEventListener("click", () => {
    const s = commit({ muted: !mutedCache });
    mutedCache = s.muted;
    paintMute();
    callbacks.onAudio(s);
  });
  mRow.appendChild(mBtn);
  a.appendChild(mRow);

  // ===================== CONTROLS =====================
  const c = sections.get("CONTROLS")!;
  let sensCache = cached.lookSensitivity;
  let capturing: string | null = null;
  const ctrlMeta: { label: string; key: "keyForward" | "keyReverse" | "keyStrafeLeft" | "keyStrafeRight" | "keyUp" | "keyDown" | "keyBoost" | "keyBrake" }[] = [
    { label: "FORWARD", key: "keyForward" },
    { label: "REVERSE", key: "keyReverse" },
    { label: "STRAFE L", key: "keyStrafeLeft" },
    { label: "STRAFE R", key: "keyStrafeRight" },
    { label: "VERTICAL ↑", key: "keyUp" },
    { label: "VERTICAL ↓", key: "keyDown" },
    { label: "BOOST", key: "keyBoost" },
    { label: "BRAKE", key: "keyBrake" },
  ];

  const bindRow = (sec: HTMLElement, meta: { label: string; key: string }): void => {
    const r = row(meta.label);
    const btn = document.createElement("button");
    btn.textContent = prettyKey(cached[meta.key as keyof GameSettings] as string);
    btn.style.cssText = `padding:3px 10px;border:1px solid ${colors.edge};background:${glow.panelBg};color:${colors.tech};cursor:pointer;font-family:inherit;font-size:10px`;
    btn.addEventListener("click", () => {
      callbacks.onSfx?.("click");
      const target = meta.key as keyof GameSettings;
      capturing = target;
      btn.textContent = "PRESS...";
      const grab = (e: KeyboardEvent): void => {
        e.preventDefault();
        e.stopPropagation();
        const code = e.code || (e.key === " " ? "Space" : "");
        if (!code) return;
        capturing = null;
        const s = commit({ [target]: code });
        btn.textContent = prettyKey(s[target] as string);
        window.removeEventListener("keydown", grab);
      };
      window.addEventListener("keydown", grab);
    });
    r.appendChild(btn);
    sec.appendChild(r);
    els.set("K:" + meta.key, btn);
  };
  for (const meta of ctrlMeta) bindRow(c, meta);

  const sensRow = row("SENSITIVITY");
  const sensIn = document.createElement("input");
  sensIn.type = "range"; sensIn.min = "0.1"; sensIn.max = "2"; sensIn.step = "0.1"; sensIn.value = String(sensCache);
  sensIn.style.cssText = "width:120px;accent-color:" + colors.tactical;
  sensIn.addEventListener("input", () => {
    const s = commit({ lookSensitivity: Number(sensIn.value) });
    sensCache = s.lookSensitivity;
  });
  sensRow.appendChild(sensIn);
  c.appendChild(sensRow);

  const invRow = row("INVERT LOOK Y");
  const invBtn = document.createElement("button");
  invBtn.style.cssText = `padding:3px 10px;border:1px solid ${colors.edge};background:${glow.panelBg};color:${colors.tech};cursor:pointer;font-family:inherit;font-size:10px`;
  const paintInv = (): void => { invBtn.textContent = cached.invertLookY ? "ON" : "OFF"; };
  paintInv();
  invBtn.addEventListener("click", () => {
    const s = commit({ invertLookY: !cached.invertLookY });
    cached = s;
    paintInv();
    callbacks.onSfx?.("click");
  });
  invRow.appendChild(invBtn);
  c.appendChild(invRow);

  const camRow = row("CAMERA MODE");
  const camSel = document.createElement("select");
  const cams: MenuCameraMode[] = ["follow", "tactical", "cinematic", "free"];
  for (const m of cams) {
    const o = document.createElement("option");
    o.value = m; o.textContent = m.toUpperCase();
    camSel.appendChild(o);
  }
  camSel.value = "follow";
  camSel.style.cssText = `background:${glow.panelBg};color:${colors.tech};border:1px solid ${colors.edge};font-family:inherit`;
  camSel.addEventListener("change", () => { callbacks.onCameraMode(camSel.value as MenuCameraMode); callbacks.onSfx?.("click"); });
  camRow.appendChild(camSel);
  c.appendChild(camRow);

  // ===================== Open/Close =====================
  const open = (): void => { isOpen = true; wrap.style.display = "flex"; };
  const close = (): void => { isOpen = false; wrap.style.display = "none"; };
  const toggle = (): void => { if (isOpen) close(); else open(); };

  activate("GRAPHICS");
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  closeBtn.addEventListener("click", close);
  const dispose = (): void => { wrap.remove(); };

  return { toggle, open, close, isOpen, dispose };
}

function prettyKey(code: string): string {
  const map: Record<string, string> = {
    KeyW: "W", KeyS: "S", KeyA: "A", KeyD: "D", KeyQ: "Q", KeyE: "E",
    ShiftLeft: "SHIFT", Space: "SPACE", ControlLeft: "CTRL", ControlRight: "CTRL",
    ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
  };
  return map[code] ?? code.replace("Key", "").toUpperCase();
}