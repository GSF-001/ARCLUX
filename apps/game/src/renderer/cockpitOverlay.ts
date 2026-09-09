// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// renderer/cockpitOverlay.ts — lapisan droplet kaca kokpit (10.V U4).
// Canvas 2D DI BAWAH HUD (z-index 5, HUD 10): stamp droplet + streak murah
// 0.5x resolusi. Refraksi transmission = overkill (deferred, putusan audit).
// Posisi = fungsi timeSec (deterministik, 0 state authority).
// Lifecycle aman: create (tanpa document = handle nol) / tick / dispose.
// Update hanya saat basah (>0.02) — kering = nol cost.

import { mulberry32 } from "./scene3d/rng";

export interface CockpitOverlayTick {
  dropletOpacity: number;
  flashIntensity: number;
}

export interface CockpitOverlayOpts {
  /** Pass shader aktif? Mati (LOW) = fallback flash DOM di kanvas ini. */
  gradePassActive: boolean;
  /** LOW = kokpit kering (degradasi sah, kontrak panduan render). */
  dropletsEnabled: boolean;
}

export interface CockpitOverlay {
  canvas: HTMLCanvasElement | null;
  tick(state: CockpitOverlayTick, timeSec: number, opts: CockpitOverlayOpts): void;
  dispose(): void;
}

const DROPS = 90;

interface Drop {
  x: number;
  y: number;
  r: number;
  speed: number;
  wobble: number;
  phase: number;
}

function buildDrops(): Drop[] {
  const rand = mulberry32(0xC0C4);
  const drops: Drop[] = [];
  for (let i = 0; i < DROPS; i++) {
    drops.push({
      x: rand(),
      y: rand(),
      r: 1 + rand() * 2.2,
      speed: 0.008 + rand() * 0.03,
      wobble: 0.004 + rand() * 0.012,
      phase: rand() * Math.PI * 2,
    });
  }
  return drops;
}

/** z-index 5: di atas canvas WebGL, di bawah HUD (10). */
export function createCockpitOverlay(parent?: HTMLElement | null): CockpitOverlay {
  if (typeof document === "undefined") return { canvas: null, tick: () => {}, dispose: () => {} };
  const host = parent ?? document.body;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("data-arclux", "cockpit-overlay");
  canvas.style.cssText = [
    "position:fixed", "inset:0", "width:100%", "height:100%",
    "pointer-events:none", "z-index:5",
  ].join(";");
  host.appendChild(canvas);
  const drops = buildDrops();

  const fit = (): CanvasRenderingContext2D | null => {
    const w = Math.max(2, Math.floor((host.clientWidth || 800) * 0.5));
    const h = Math.max(2, Math.floor((host.clientHeight || 600) * 0.5));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return canvas.getContext("2d");
  };

  return {
    canvas,
    tick(state, timeSec, opts) {
      const ctx2d = fit();
      if (!ctx2d) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);
      // Fallback LOW: kilat digambar di sini (putih flat — sah untuk LOW,
      // grade shader mati). HIGH+: flash dikerjakan pass, bukan kanvas.
      if (!opts.gradePassActive && state.flashIntensity > 0.01) {
        ctx2d.fillStyle = `rgba(235,242,255,${(state.flashIntensity * 0.45).toFixed(3)})`;
        ctx2d.fillRect(0, 0, w, h);
      }
      // Kering = nol cost (clear doang).
      if (!opts.dropletsEnabled || state.dropletOpacity <= 0.02) return;
      const alpha = Math.min(1, state.dropletOpacity);
      const visible = Math.floor(DROPS * Math.min(1, 0.25 + alpha));
      for (let i = 0; i < visible; i++) {
        const d = drops[i];
        const y = ((d.y + timeSec * d.speed) % 1) * h;
        const x = (d.x + Math.sin(timeSec * 0.7 + d.phase) * d.wobble) * w;
        // Streak 1/3 tetes (hujan jalan turun), sisanya dot statis.
        if (i % 3 === 0) {
          const len = d.r * (2 + alpha * 6);
          const grad = ctx2d.createLinearGradient(x, y - len, x, y);
          grad.addColorStop(0, "rgba(180,210,235,0)");
          grad.addColorStop(1, `rgba(180,210,235,${(0.55 * alpha).toFixed(3)})`);
          ctx2d.strokeStyle = grad;
          ctx2d.lineWidth = Math.max(1, d.r * 0.5);
          ctx2d.beginPath();
          ctx2d.moveTo(x, y - len);
          ctx2d.lineTo(x, y);
          ctx2d.stroke();
        }
        ctx2d.fillStyle = `rgba(200,225,245,${(0.5 * alpha).toFixed(3)})`;
        ctx2d.beginPath();
        ctx2d.arc(x, y, d.r, 0, Math.PI * 2);
        ctx2d.fill();
      }
    },
    dispose() {
      canvas.remove();
    },
  };
}
