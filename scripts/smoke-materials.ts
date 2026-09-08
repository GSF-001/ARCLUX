// 10.V M1 smoke: kit tekstur prosedural — determinism, anti-flat,
// panel lines, roughness range, normal unit-length, VRAM math, tier.
// Run: ./node_modules/.bin/tsx scripts/smoke-materials.ts (exit 1 = FAIL)

import type * as THREE from "three";
import {
  estimateTextureMB,
  makeHullAlbedo,
  makeNormalMapFromNoise,
  makeRoughnessMap,
  textureBudgetMB,
  textureSizeForPreset,
} from "../apps/game/src/renderer/scene3d/materials";

let fail = 0;
const ok = (c: boolean, s: string): void => {
  console.log(`${c ? "PASS" : "FAIL"} ${s}`);
  if (!c) fail++;
};
const px = (t: THREE.DataTexture): Uint8Array => t.image.data as Uint8Array;

const a1 = px(makeHullAlbedo("#5a6b85", 1234, 64));
const a2 = px(makeHullAlbedo("#5a6b85", 1234, 64));
ok(a1.length === 64 * 64 * 4, "albedo byte length");
ok(Buffer.from(a1).equals(Buffer.from(a2)), "albedo deterministik seed sama");
const a3 = px(makeHullAlbedo("#5a6b85", 9999, 64));
ok(!Buffer.from(a1).equals(Buffer.from(a3)), "seed beda -> tile beda");

let mean = 0;
for (let i = 0; i < a1.length; i += 4) mean += a1[i];
mean /= a1.length / 4;
let va = 0;
for (let i = 0; i < a1.length; i += 4) va += (a1[i] - mean) ** 2;
va /= a1.length / 4;
ok(va > 15, `albedo tidak flat (var R=${va.toFixed(1)})`);

let lineSum = 0;
let lineN = 0;
let fillSum = 0;
let fillN = 0;
for (let y = 0; y < 64; y++) {
  for (let x = 0; x < 64; x++) {
    const v = a1[(y * 64 + x) * 4];
    if (x % 8 < 2) {
      lineSum += v;
      lineN++;
    } else if (x % 8 >= 4) {
      fillSum += v;
      fillN++;
    }
  }
}
ok(lineSum / lineN < (fillSum / fillN) * 0.9, "panel lines lebih gelap dari fill");

const r = px(makeRoughnessMap(77, 0.45, 0.7, 64));
let mn = 1;
let mx = 0;
let gEq = true;
for (let i = 0; i < r.length; i += 4) {
  const v = r[i + 1] / 255;
  if (v < mn) mn = v;
  if (v > mx) mx = v;
  if (r[i] !== r[i + 1] || r[i + 1] !== r[i + 2]) gEq = false;
}
ok(mn >= 0.44 && mx <= 0.71, `roughness dalam [0.45,0.7] (dapat ${mn.toFixed(2)}..${mx.toFixed(2)})`);
ok(gEq, "roughness R=G=B (kanal G valid)");

const n = px(makeNormalMapFromNoise(55, 32, 1.5));
let worst = 0;
for (let i = 0; i < n.length; i += 4) {
  const l = Math.hypot((n[i] / 255) * 2 - 1, (n[i + 1] / 255) * 2 - 1, n[i + 2] / 255);
  worst = Math.max(worst, Math.abs(l - 1));
}
ok(worst < 0.05, `normal unit-length (dev max ${worst.toFixed(3)})`);

ok(Math.abs(estimateTextureMB(512, 1) - 1) < 1e-9, "512²RGBA = 1MB");
ok(
  textureSizeForPreset("LOW") === 128 &&
    textureSizeForPreset("MEDIUM") === 256 &&
    textureSizeForPreset("HIGH") === 512,
  "tier resolusi 128/256/512",
);
ok(
  textureBudgetMB("LOW") === 8 && textureBudgetMB("MEDIUM") === 24 && textureBudgetMB("HIGH") === 48,
  "budget 8/24/48MB",
);
process.exit(fail ? 1 : 0);
