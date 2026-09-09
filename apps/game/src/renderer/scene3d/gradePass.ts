// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/gradePass.ts — SATU ShaderPass mood grade (10.V P1.1 + P1.4).
// Ruang linear HDR SEBELUM Output (tone-map butuh gambar yang sudah
// di-mood). Uniform dibaca dari EnvironmentalContext — murni derivasi,
// otoritas nol. Night grade numpang pass ini (BUKAN pass baru, P1.4).

import * as THREE from "three";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import type { EnvironmentalContext } from "../../../../../packages/gameserver/planetary/environment";

/** Mood 0..1: warm (dusk), storm, night. Murni fungsi (testable). */
export interface GradeMood {
  warm: number;
  storm: number;
  night: number;
}

export function deriveGradeMood(env: EnvironmentalContext): GradeMood {
  const elev = env.sun.elevation;
  // Warm memuncak saat elevasi rendah tapi di atas horizon (dawn/dusk).
  const warm = Math.max(0, 1 - Math.abs(elev - 0.12) / 0.35) * (elev > -0.05 ? 1 : 0);
  const storm = env.weather.kind === "storm" ? 1 : env.weather.kind === "rain" ? 0.35 : 0;
  const night = env.timeOfDay === "night" ? 1 : 0;
  const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
  return { warm: clamp01(warm), storm: clamp01(storm), night: clamp01(night) };
}

export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uWarm: { value: 0 },
    uStorm: { value: 0 },
    uNight: { value: 0 },
    uMoon: { value: 0.5 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uWarm;
    uniform float uStorm;
    uniform float uNight;
    uniform float uMoon;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 g = c.rgb;
      // Dusk warmth: angkat merah-kuning midtone.
      g = mix(g, g * vec3(1.12, 0.98, 0.86) + vec3(0.03, 0.008, 0.0), uWarm * 0.7);
      // Storm: turunkan exposure + desaturasi + dingin tipis.
      float lum = dot(g, vec3(0.299, 0.587, 0.114));
      g = mix(g, vec3(lum) * vec3(0.92, 0.97, 1.05), uStorm * 0.55);
      g *= 1.0 - uStorm * 0.22;
      // Night grade: exposure turun + blue lift ikut cahaya bulan.
      g *= 1.0 - uNight * 0.35;
      g += vec3(0.015, 0.03, 0.06) * uNight * (0.4 + uMoon * 0.6);
      gl_FragColor = vec4(g, c.a);
    }
  `,
};

export function createGradePass(): ShaderPass {
  return new ShaderPass(GradeShader);
}

/** Umpan satu-satunya: wireC tiap frame (pola U4). */
export function updateGradePass(pass: ShaderPass, env: EnvironmentalContext): void {
  const m = deriveGradeMood(env);
  pass.uniforms["uWarm"].value = m.warm;
  pass.uniforms["uStorm"].value = m.storm;
  pass.uniforms["uNight"].value = m.night;
  pass.uniforms["uMoon"].value = env.moonState.illumination;
}
