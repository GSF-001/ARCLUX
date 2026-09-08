// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/finalTouchPass.ts — SATU pass gabungan (10.V P1.2): vignette +
// grain halus (hash-based, timeSec — BUKAN Date.now) + chromatic aberration
// radial tipis (tepi saja <1.5px @1080p, zona tengah STERIL agar teks TAC
// tidak beleber). PALING AKHIR sebelum Output (cacat lensa + film, bukan
// cahaya dunia). 3 pass terpisah = boros bandwidth, ditolak.

import * as THREE from "three";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

export const FinalTouchShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uAspect: { value: 16 / 9 },
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
    uniform float uTime;
    uniform float uAspect;
    varying vec2 vUv;
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7)) + uTime * 13.0) * 43758.5453);
    }
    void main() {
      vec2 d = vUv - 0.5;
      d.x *= uAspect;
      float r = length(d);
      // CA tepi saja: mask nol di tengah (r<0.45), penuh di sudut.
      float caMask = smoothstep(0.45, 1.05, r);
      vec2 caOff = normalize(d + 1e-5) * (0.0011 * caMask);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + caOff).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - caOff).b;
      // Vignette lembut.
      col *= 1.0 - smoothstep(0.55, 1.25, r) * 0.32;
      // Grain halus (tidak merusak teks: amplitudo 3%).
      col += (hash(vUv * 913.0) - 0.5) * 0.03;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createFinalTouchPass(): ShaderPass {
  return new ShaderPass(FinalTouchShader);
}

export function updateFinalTouchPass(pass: ShaderPass, timeSec: number, aspect: number): void {
  pass.uniforms["uTime"].value = timeSec;
  pass.uniforms["uAspect"].value = aspect;
}
