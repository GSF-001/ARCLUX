// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// src/renderer/npe.ts — 10.V U10 new player experience.
// 5-step overlay: WASD → Mouse → F-Dock → J-Shoot → Next Region.
// State-driven, skippable (Esc/X), persisted via localStorage key "npe_done".

import { colors, typography, glow, spacing } from "../ui/tokens";

const NPE_KEY = "arclux_npe_done";

export interface NpeHandle {
  /** Returns true if NPE already completed or skipped. */
  isDone(): boolean;
  /** Force start (even if done). */
  start(): void;
  /** Skip/close NPE. */
  skip(): void;
  dispose(): void;
}

interface NpeStep {
  id: number;
  title: string;
  body: string;
  keyHint: string;
  position: "top" | "center";
}

const STEPS: NpeStep[] = [
  {
    id: 1,
    title: "MOVEMENT",
    body: "W A S D — navigate your vessel through the system",
    keyHint: "W A S D",
    position: "top",
  },
  {
    id: 2,
    title: "CAMERA",
    body: "Mouse look — orbit around your vessel",
    keyHint: "MOUSE",
    position: "top",
  },
  {
    id: 3,
    title: "DOCK",
    body: "F — dock with nearby station",
    keyHint: "F",
    position: "center",
  },
  {
    id: 4,
    title: "FIRE",
    body: "J — fire weapon at locked target",
    keyHint: "J",
    position: "center",
  },
  {
    id: 5,
    title: "NAVIGATE",
    body: "Approach a jump gate — press E to warp to next region",
    keyHint: "E",
    position: "top",
  },
];

const OVERLAY_STYLE = `
  position:fixed;inset:0;z-index:95;
  background:rgba(2,3,10,0.4);
  backdrop-filter:blur(1px);
  display:flex;align-items:center;justify-content:center;
  pointer-events:auto;
  transition:opacity 0.3s ease;
`;

const CARD_STYLE = `
  position:relative;
  width:420px;
  border:1px solid ${colors.tactical};
  background:linear-gradient(135deg,rgba(10,16,28,0.95),rgba(6,9,18,0.98));
  font-family:${typography.mono};
  color:${colors.foreground};
  letter-spacing:${typography.letterspacing};
  padding:28px 32px;
  box-shadow:0 0 40px rgba(0,0,0,0.7),0 0 20px rgba(204,136,0,0.15);
  transition:transform 0.25s ease,opacity 0.25s ease;
`;

export function initNpe(): NpeHandle {
  const root = typeof document !== "undefined" ? document.body : null;
  if (!root) {
    return { isDone: () => true, start: () => {}, skip: () => {}, dispose: () => {} };
  }

  let done = localStorage.getItem(NPE_KEY) === "1";
  let overlay: HTMLDivElement | null = null;
  let card: HTMLDivElement | null = null;
  let currentStep = 0;
  let disposed = false;
  let onKeyHandler: ((e: KeyboardEvent) => void) | null = null;

  const esc = (s: string): string =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
     .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  function render(step: NpeStep): void {
    if (!card) return;
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
        <div style="font-family:${typography.display};font-size:${typography.sizes.title};font-weight:700;color:${colors.tactical};letter-spacing:${typography.displaySpacing}">
          STEP ${step.id}/5
        </div>
        <div style="font-size:${typography.sizes.micro};color:${colors.muted}">
          ${esc(step.title)}
        </div>
      </div>
      <div style="font-size:${typography.sizes.label};color:${colors.body};line-height:1.7;margin-bottom:20px">
        ${esc(step.body)}
      </div>
      <div style="text-align:center;margin:16px 0 20px">
        <span style="display:inline-block;padding:8px 24px;border:2px solid ${colors.tactical};color:${colors.tactical};font-family:${typography.display};font-size:${typography.sizes.data};letter-spacing:2px;text-shadow:${glow.textTactical}">
          ${esc(step.keyHint)}
        </span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid ${colors.edge};padding-top:14px;margin-top:8px">
        <div style="display:flex;gap:6px">
          ${STEPS.map((_, i) => `
            <div style="width:8px;height:3px;background:${i < currentStep ? colors.tactical : i === currentStep ? colors.warn : colors.edge}"></div>
          `).join("")}
        </div>
        <div style="display:flex;gap:12px">
          <button id="npe-skip" style="background:none;border:1px solid ${colors.edge};color:${colors.muted};font-family:${typography.mono};font-size:${typography.sizes.micro};padding:4px 12px;cursor:pointer;letter-spacing:1px;transition:border-color 0.2s">ESC SKIP</button>
          <button id="npe-next" style="background:none;border:1px solid ${colors.tactical};color:${colors.tactical};font-family:${typography.mono};font-size:${typography.sizes.micro};padding:4px 12px;cursor:pointer;letter-spacing:1px;transition:border-color 0.2s">
            ${step.id === 5 ? "START PLAYING" : "NEXT →"}
          </button>
        </div>
      </div>
    `;
    // wire buttons
    card.querySelector("#npe-skip")?.addEventListener("click", () => closeNpe(true));
    card.querySelector("#npe-next")?.addEventListener("click", () => {
      if (currentStep < STEPS.length - 1) {
        currentStep++;
        render(STEPS[currentStep]);
      } else {
        closeNpe(true);
      }
    });
  }

  function openNpe(): void {
    if (disposed || overlay) return;
    currentStep = 0;

    overlay = document.createElement("div");
    overlay.style.cssText = OVERLAY_STYLE;
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeNpe(true);
    });

    card = document.createElement("div");
    card.style.cssText = CARD_STYLE;
    overlay.appendChild(card);

    // corner brackets
    const bc = `position:absolute;width:14px;height:14px;border-color:${colors.tactical};border-style:solid;border-width:0`;
    for (const [t, l, bt, bl, br, bb] of [
      ["-1px", "-1px", "2px", "2px", "0", "0"],
      ["-1px", "auto", "2px", "0", "2px", "0"],
      ["auto", "-1px", "0", "2px", "0", "2px"],
      ["auto", "auto", "0", "0", "2px", "2px"],
    ] as const) {
      const c = document.createElement("div");
      c.style.cssText = `${bc};top:${t};left:${l};border-top-width:${bt};border-left-width:${bl};border-right-width:${br};border-bottom-width:${bb}`;
      card.appendChild(c);
    }

    render(STEPS[0]);
    root!.appendChild(overlay);

    // Keyboard nav
    onKeyHandler = (e: KeyboardEvent): void => {
      if (e.key === "Escape" || e.key === "x" || e.key === "X") closeNpe(true);
      else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (currentStep < STEPS.length - 1) {
          currentStep++;
          render(STEPS[currentStep]);
        } else {
          closeNpe(true);
        }
      }
    };
    document.addEventListener("keydown", onKeyHandler);
  }

  function closeNpe(persist: boolean): void {
    if (persist) {
      done = true;
      try { localStorage.setItem(NPE_KEY, "1"); } catch {}
    }
    if (overlay) {
      overlay.style.opacity = "0";
      const ref = overlay;
      const kh = onKeyHandler;
      setTimeout(() => {
        if (kh) document.removeEventListener("keydown", kh);
        if (ref.parentElement) ref.parentElement.removeChild(ref);
      }, 300);
      overlay = null;
      card = null;
      onKeyHandler = null;
    }
  }

  return {
    isDone: () => done,
    start: () => { done = false; try { localStorage.removeItem(NPE_KEY); } catch {} openNpe(); },
    skip: () => closeNpe(true),
    dispose: () => { disposed = true; closeNpe(false); },
  };
}
