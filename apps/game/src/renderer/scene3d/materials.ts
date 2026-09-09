// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/materials.ts — kit tekstur prosedural anti-plastik (10.V fase M1).
// DataTexture murni (TANPA canvas/DOM) → bisa di-smoke-test di node.
// RNG seeded (rng.ts) → tile stabil antar load. Dibuat SEKALI saat build,
// disimpan di userData.mats — jangan bikin tekstur per frame (itu leak).
// Recipe anti-plastik (§9): albedo tidak pernah flat (noise ±8% + panel
// lines + edge wear), roughness SELALU bervariasi antar panel, normal micro
// dari noise, emissive hanya aksen.

import * as THREE from "three";
import { mulberry32 } from "./rng";
import type { QualityPreset } from "../settings";

/** Resolusi tile per tier (M1.5). */
export function textureSizeForPreset(preset: QualityPreset): number {
  if (preset === "LOW") return 128;
  if (preset === "MEDIUM") return 256;
  return 512;
}

/** Anggaran VRAM TEKSTUR per tier, MB (M1.5). */
export function textureBudgetMB(preset: QualityPreset): number {
  if (preset === "LOW") return 8;
  if (preset === "MEDIUM") return 24;
  return 48;
}

/** Estimasi MB: n tile size² RGBA. 512² RGBA = 1MB. */
export function estimateTextureMB(size: number, count: number): number {
  return (size * size * 4 * count) / 1048576;
}

function parseBase(base: THREE.ColorRepresentation): [number, number, number] {
  const c = new THREE.Color(base);
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
}

/** Value-noise grid + bilinear smootherstep, tileable (wrap indeks grid). */
function makeNoise2D(seed: number, cells: number): (u: number, v: number) => number {
  const rand = mulberry32(seed);
  const grid: number[] = [];
  for (let i = 0; i < cells * cells; i++) grid.push(rand());
  const at = (x: number, y: number): number =>
    grid[(((y % cells) + cells) % cells) * cells + (((x % cells) + cells) % cells)];
  const sm = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
  return (u: number, v: number): number => {
    const x = u * cells;
    const y = v * cells;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    const u2 = sm(xf);
    const v2 = sm(yf);
    return a + (b - a) * u2 + (c - a) * v2 + (a - b - c + d) * u2 * v2;
  };
}

/**
 * Albedo hull: base + noise ±8% + panel lines grid + edge wear.
 * Panel tiap size/8 px, garis 2px digelapkan 35%, piksel sebelahnya
 * dicerahkan tipis (aus tepi).
 */
export function makeHullAlbedo(
  base: THREE.ColorRepresentation,
  seed: number,
  size = 256,
): THREE.DataTexture {
  const [br, bg, bb] = parseBase(base);
  const noise = makeNoise2D(seed, 24);
  const fine = makeNoise2D(seed ^ 0x9e37, 96);
  const data = new Uint8Array(size * size * 4);
  const cell = Math.max(8, Math.floor(size / 8));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n = (noise(u, v) - 0.5) * 0.16 + (fine(u, v) - 0.5) * 0.05;
      const onLineX = x % cell < 2;
      const onLineY = y % cell < 2;
      const nearLineX = x % cell < 4;
      const nearLineY = y % cell < 4;
      let mul = 1 + n;
      if (onLineX || onLineY) mul *= 0.65;
      else if (nearLineX || nearLineY) mul *= 1.06;
      const i = (y * size + x) * 4;
      data[i] = Math.max(0, Math.min(255, Math.round(br * mul)));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(bg * mul)));
      data[i + 2] = Math.max(0, Math.min(255, Math.round(bb * mul)));
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Roughness map: noise kasar di [lo, hi], ditulis ke kanal G
 * (three.js membaca roughness dari kanal HIJAU) + R/B sama.
 */
export function makeRoughnessMap(
  seed: number,
  lo: number,
  hi: number,
  size = 256,
): THREE.DataTexture {
  const noise = makeNoise2D(seed, 10);
  const fine = makeNoise2D(seed ^ 0x51f7, 48);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = lo + (hi - lo) * (noise(x / size, y / size) * 0.7 + fine(x / size, y / size) * 0.3);
      const byte = Math.max(0, Math.min(255, Math.round(v * 255)));
      const i = (y * size + x) * 4;
      data[i] = byte;
      data[i + 1] = byte;
      data[i + 2] = byte;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Normal micro dari noise via Sobel — bunuh "permukaan licin sempurna". */
export function makeNormalMapFromNoise(
  seed: number,
  size = 256,
  strength = 1.5,
): THREE.DataTexture {
  const height = makeNoise2D(seed, 32);
  const h = (x: number, y: number): number =>
    height(((x % size) + size) % size / size, ((y % size) + size) % size / size);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * size + x) * 4;
      data[i] = Math.round((-dx * inv * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round(inv * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}
