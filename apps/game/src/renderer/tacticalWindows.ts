// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// src/renderer/tacticalWindows.ts — 10.V U7 tactical windows kit.
// 4 windows: target-info, fleet, directory/scan, combat-log.
// Each = corner bracket + header + scan-in animation (120ms opacity+slide).
// Reads existing state (read-only). Zero-placeholder rule (U12).

import { colors, typography, glow } from "../ui/tokens";

export type TacticalWindowKind = "target" | "fleet" | "directory" | "combatlog";

interface TacticalWindow {
  el: HTMLElement;
  content: HTMLElement;
  kind: TacticalWindowKind;
  visible: boolean;
}

const WINDOW_TITLES: Record<TacticalWindowKind, string> = {
  target: "TARGET // INFO",
  fleet: "FLEET // CONTACTS",
  directory: "DIRECTORY // SCAN",
  combatlog: "COMBAT // LOG",
};

const WINDOW_WIDTHS: Record<TacticalWindowKind, string> = {
  target: "280px",
  fleet: "320px",
  directory: "300px",
  combatlog: "340px",
};

// Corner bracket styling (EVE-style tactical frame)
const BRACKET = `
  position:relative;
  border:1px solid ${colors.edge};
  background:linear-gradient(135deg,rgba(10,16,28,0.88),rgba(6,9,18,0.94));
  font-family:${typography.mono};
  color:${colors.foreground};
  letter-spacing:${typography.letterspacing};
  box-shadow:0 0 12px rgba(0,0,0,0.6),inset 0 0 20px rgba(10,16,28,0.4);
`;
const BRACKET_CORNER = `
  position:absolute;width:12px;height:12px;
  border-color:${colors.tactical};border-style:solid;border-width:0;
`;
const HEADER_STYLE = `
  font-size:${typography.sizes.micro};
  color:${colors.tactical};
  text-transform:uppercase;
  font-weight:700;
  padding:8px 10px 6px;
  border-bottom:1px solid ${colors.edge};
  letter-spacing:1.5px;
`;
const CONTENT_STYLE = `
  padding:8px 10px;
  font-size:${typography.sizes.data};
  color:${colors.body};
  line-height:1.7;
  max-height:260px;
  overflow-y:auto;
`;

function createBracketCorners(el: HTMLElement): void {
  // Top-left
  const tl = document.createElement("div");
  tl.style.cssText = `${BRACKET_CORNER};top:-1px;left:-1px;border-top-width:2px;border-left-width:2px`;
  el.appendChild(tl);
  // Top-right
  const tr = document.createElement("div");
  tr.style.cssText = `${BRACKET_CORNER};top:-1px;right:-1px;border-top-width:2px;border-right-width:2px`;
  el.appendChild(tr);
  // Bottom-left
  const bl = document.createElement("div");
  bl.style.cssText = `${BRACKET_CORNER};bottom:-1px;left:-1px;border-bottom-width:2px;border-left-width:2px`;
  el.appendChild(bl);
  // Bottom-right
  const br = document.createElement("div");
  br.style.cssText = `${BRACKET_CORNER};bottom:-1px;right:-1px;border-bottom-width:2px;border-right-width:2px`;
  el.appendChild(br);
}

/**
 * U7 — Create a tactical window. Returns handle for show/hide/update.
 * scan-in: opacity 0→1 + translateY(-8px→0) in 120ms (token U6 motion).
 */
export function createTacticalWindow(
  kind: TacticalWindowKind,
  parent: HTMLElement,
  position: { top?: string; left?: string; right?: string; bottom?: string } = {},
): TacticalWindow {
  const el = document.createElement("div");
  el.style.cssText = `${BRACKET}
    position:fixed;
    width:${WINDOW_WIDTHS[kind]};
    z-index:50;
    opacity:0;
    transform:translateY(-8px);
    transition:opacity 0.12s ease,transform 0.12s ease;
    pointer-events:auto;
    ${position.top ? `top:${position.top}` : ""};
    ${position.left ? `left:${position.left}` : ""};
    ${position.right ? `right:${position.right}` : ""};
    ${position.bottom ? `bottom:${position.bottom}` : ""};
  `;
  el.style.display = "none";

  createBracketCorners(el);

  const header = document.createElement("div");
  header.style.cssText = HEADER_STYLE;
  header.textContent = WINDOW_TITLES[kind];
  el.appendChild(header);

  const content = document.createElement("div");
  content.style.cssText = CONTENT_STYLE;
  content.innerHTML = `<span style="color:${colors.empty}">SCANNING...</span>`;
  el.appendChild(content);

  parent.appendChild(el);

  return { el, content, kind, visible: false };
}

/** Show window with scan-in animation. */
export function showTacticalWindow(win: TacticalWindow): void {
  if (win.visible) return;
  win.visible = true;
  win.el.style.display = "block";
  // Force reflow for transition
  void win.el.offsetHeight;
  win.el.style.opacity = "1";
  win.el.style.transform = "translateY(0)";
}

/** Hide window with scan-out animation. */
export function hideTacticalWindow(win: TacticalWindow): void {
  if (!win.visible) return;
  win.visible = false;
  win.el.style.opacity = "0";
  win.el.style.transform = "translateY(-8px)";
  setTimeout(() => { if (!win.visible) win.el.style.display = "none"; }, 120);
}

/** Toggle window visibility. */
export function toggleTacticalWindow(win: TacticalWindow): void {
  if (win.visible) hideTacticalWindow(win);
  else showTacticalWindow(win);
}

/** Update window content (innerHTML). Applies fadeOnChange pattern. */
export function updateTacticalWindowContent(win: TacticalWindow, html: string): void {
  if (win.content.innerHTML === html) return;
  win.content.style.opacity = "0.35";
  requestAnimationFrame(() => {
    win.content.innerHTML = html;
    requestAnimationFrame(() => { win.content.style.opacity = "1"; });
  });
}

/** Empty-state text per window kind (U12 zero-placeholder). */
export function emptyState(kind: TacticalWindowKind): string {
  switch (kind) {
    case "target": return `<span style="color:${colors.empty}">NO TARGETS IN RANGE — widen scan</span>`;
    case "fleet": return `<span style="color:${colors.empty}">NO FLEET CONTACTS</span>`;
    case "directory": return `<span style="color:${colors.empty}">NO ENTRIES — scan wider radius</span>`;
    case "combatlog": return `<span style="color:${colors.empty}">NO COMBAT EVENTS</span>`;
  }
}

/** Dispose window + remove from DOM. */
export function disposeTacticalWindow(win: TacticalWindow): void {
  if (win.el.parentElement) win.el.parentElement.removeChild(win.el);
}
