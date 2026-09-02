// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// src/renderer/audio.ts — WebAudio engine room. Self-contained (CSP default-src
// 'self': no asset, semua synthesized). Konsumen settings (master/sfx/music,
// muted). §28 soundscape kinetik, bukan dashboard beep.

import { loadSettings } from "./settings";

export interface AudioHandle {
  /** Kunci user gesture (autoplay policy) — panggil setelah klik. */
  unlock(): void;
  /** Update engine hum pitch ∝ vessel speed (0..1). */
  setSpeed(r: number): void;
  /** Sfx HUD/combat singkat. */
  ui(kind: "hover" | "click" | "alert" | "boost"): void;
  setEnabled(muted: boolean, masterVolume: number): void;
  dispose(): void;
}

/** Generate noise buffer (satu-satu, gak pernah blocking). */
function makeNoiseBuffer(ctx: AudioContext, seconds = 1): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export function initAudio(): AudioHandle {
  const s0 = loadSettings();
  let muted = s0.muted;
  let master = s0.masterVolume;
  let ctx: AudioContext | null = null;
  let engineOsc: OscillatorNode | null = null;
  let engineGain: GainNode | null = null;
  let noiseGain: GainNode | null = null;
  let noiseSrc: AudioBufferSourceNode | null = null;
  let sfxGain: GainNode | null = null;
  let musicGain: GainNode | null = null;
  let musicTimer: ReturnType<typeof setInterval> | null = null;

  const ensure = (): AudioContext | null => {
    if (ctx) return ctx;
    if (typeof window === "undefined" || typeof AudioContext === "undefined") return null;
    ctx = new AudioContext();
    // Master bus → destination (mute/set master via satu gain di sini).
    const masterBus = ctx.createGain();
    masterBus.gain.value = muted ? 0 : master;
    masterBus.connect(ctx.destination);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.7;
    sfxGain.connect(masterBus);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.35;
    musicGain.connect(masterBus);

    // Engine hum: osc + filtered noise, pitch ∝ speed.
    engineOsc = ctx.createOscillator();
    engineOsc.type = "sawtooth";
    engineOsc.frequency.value = 40;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0001;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 240;
    engineOsc.connect(lp);
    lp.connect(engineGain);
    engineGain.connect(masterBus);

    noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = makeNoiseBuffer(ctx, 2);
    noiseSrc.loop = true;
    noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.001;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 800;
    noiseSrc.connect(hp);
    hp.connect(noiseGain);
    noiseGain.connect(masterBus);
    noiseSrc.start();
    engineOsc.start();
    return ctx;
  };

  // Noise/Music diredam sesuai muted & master — kita simpan gain terakhir.
  const ramp = (node: AudioNode | GainNode | null, target: number, t: number): void => {
    if (node && "gain" in node) (node as GainNode).gain.setTargetAtTime(target, t, 0.1);
  };

  const scheduleMusic = (): void => {
    const c = ctx;
    if (!c || !musicGain || muted) return;
    const now = c.currentTime;
    const notes = [220, 277.18, 329.63, 440, 329.63, 277.18, 220, 246.94];
    const base = (s0.musicVolume || 0.5) * 0.06;
    for (let i = 0; i < 4; i++) {
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.value = notes[(stepIdx + i) % notes.length] * (0.97 + 0.03 * ((s0.musicVolume || 0.5) % 1));
      const og = c.createGain();
      og.gain.setValueAtTime(muted ? 0 : base, now + i * 2.5);
      og.gain.exponentialRampToValueAtTime(muted ? 0.0001 : base, now + i * 2.5 + 1.4);
      og.gain.exponentialRampToValueAtTime(muted ? 0.0001 : 0.0003, now + i * 2.5 + 2.4);
      o.connect(og);
      og.connect(musicGain);
      o.start(now + i * 2.5);
      o.stop(now + i * 2.5 + 2.5);
    }
    stepIdx += 1;
  };

  return {
    unlock() {
      ensure();
      if (ctx && ctx.state === "suspended") { void ctx.resume(); }
      if (!musicTimer) {
        scheduleMusic();
        musicTimer = setInterval(scheduleMusic, 10000);
      }
    },
    setSpeed(r) {
      const rr = Math.max(0, Math.min(1, r));
      if (!engineOsc || !engineGain) return;
      engineOsc.frequency.value = 38 + rr * 46;
      ramp(engineGain, muted ? 0 : 0.05 + rr * 0.12, ctx?.currentTime ?? 0);
      ramp(noiseGain, muted ? 0 : 0.004 + rr * 0.05, ctx?.currentTime ?? 0);
    },
    ui(kind) {
      const c = ensure();
      if (!c || !sfxGain) return;
      const osc = c.createOscillator();
      const g = c.createGain();
      const f = kind === "hover" ? 660 : kind === "click" ? 880 : kind === "alert" ? 220 : 990;
      osc.type = kind === "alert" ? "square" : "sine";
      osc.frequency.value = f;
      const vol = (muted ? 0 : 0.12) * (s0.sfxVolume || 0.7);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), c.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.18);
      osc.connect(g);
      g.connect(sfxGain);
      osc.start();
      osc.stop(c.currentTime + 0.2);
    },
    setEnabled(m, v) {
      muted = m; master = v;
      if (ctx) {
        // Master bus = destination path; dorong ulang gain pada semua bus.
        ramp(musicGain, muted ? 0 : 0.35 * (v * 0.7), ctx.currentTime);
      }
    },
    dispose() {
      if (musicTimer) clearInterval(musicTimer);
      musicTimer = null;
      try {
        engineOsc?.stop(); noiseSrc?.stop();
        if (ctx) void ctx.close();
      } catch {}
      ctx = null; engineOsc = null; engineGain = null; noiseSrc = null; noiseGain = null; sfxGain = null; musicGain = null;
    },
  };
}

let stepIdx = 0;