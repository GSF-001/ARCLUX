// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/cockpitGradePass.ts — SATU ShaderPass kokpit (10.V U4, FINAL).
// Uniform flash + heat + dim, disisipkan Bloom -> CockpitGrade -> Output.
// Flash di ruang linear HDR: filmic rolloff + bloom = terbaca CAHAYA
// (versi DOM = putih flat, ditolak audit render-path). BUKAN ShaderMaterial
// full-custom scene — ini pass post (aturan §4 membolehkan, pola post.ts).

import * as THREE from "three";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import type { CockpitState } from "./cinematic/CockpitResponseResolver";

export const CockpitGradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uFlash: { value: 0 },
    uHeat: { value: 0 },
    uDim: { value: 0 },
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
    uniform float uFlash;
    uniform float uHeat;
    uniform float uDim;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // Cloud dim: multiply + desaturasi tipis (ikut grading scene).
      float dimF = 1.0 - uDim * 0.45;
      float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      vec3 graded = mix(c.rgb, vec3(lum), uDim * 0.25) * dimF;
      // Heat vignette: mask radial + lift tengah (glare mesin).
      vec2 d = vUv - 0.5;
      float r = length(d) * 1.4142;
      float vig = smoothstep(0.45, 1.0, r);
      vec3 heated = graded + vec3(1.0, 0.45, 0.15) * (vig * uHeat * 0.55);
      heated += vec3(1.0, 0.6, 0.3) * ((1.0 - smoothstep(0.0, 0.5, r)) * uHeat * 0.12);
      // Lightning flash: aditif putih-biru pucat (kena bloom + filmic).
      vec3 outc = heated + vec3(0.75, 0.85, 1.0) * uFlash;
      gl_FragColor = vec4(outc, c.a);
    }
  `,
};

/** Buat pass kokpit (enabled default true; gating di quality.ts). */
export function createCockpitGradePass(): ShaderPass {
  return new ShaderPass(CockpitGradeShader);
}

/** Umpan satu-satunya: wireC tiap frame dari CockpitState hidup. */
export function updateCockpitGradePass(pass: ShaderPass, s: CockpitState): void {
  pass.uniforms["uFlash"].value = s.flashIntensity;
  pass.uniforms["uHeat"].value = s.heatVignette;
  pass.uniforms["uDim"].value = s.cloudDim;
}
