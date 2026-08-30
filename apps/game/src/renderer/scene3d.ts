// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// src/renderer/scene3d.ts — 3D vessel render dari RegionState (client-side only).
// Prinsip (blueprint 06 §18, invariant I-1): server tentukan posisi/heading/damage; client cuma render.

import type { RegionState, VesselEntity } from "../../../../packages/gameserver/types";
import * as THREE from "three";

export interface Scene3D {
  renderRegion(region: RegionState): void;
  updateVessel(v: VesselEntity): void;
  dispose(): void;
}

export function initScene3D(container?: HTMLElement): Scene3D {
  const target = container ?? (typeof document !== "undefined" ? document.getElementById("app") : null);
  const width = target?.clientWidth ?? 800;
  const height = target?.clientHeight ?? 600;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0e1a);
  const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 50000);
  camera.position.set(0, 800, 1500);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  if (target) target.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(500, 1000, 500);
  scene.add(dir);
  scene.add(new THREE.GridHelper(4000, 40, 0x334155, 0x1e293b));

  const vessels = new Map<string, THREE.Mesh>();

  const ensureMesh = (v: VesselEntity): THREE.Mesh => {
    let m = vessels.get(v.id);
    if (m) return m;
    const geom = new THREE.ConeGeometry(18, 48, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x38bdf8 });
    m = new THREE.Mesh(geom, mat);
    m.name = v.id;
    scene.add(m);
    vessels.set(v.id, m);
    return m;
  };

  const updateVessel = (v: VesselEntity): void => {
    const m = ensureMesh(v);
    m.position.set(v.position.x, v.position.y, v.position.z);
    m.rotation.set(0, v.heading.yaw, 0);
  };

  const renderRegion = (region: RegionState): void => {
    // Remove vessels that no longer exist
    const live = new Set<string>();
    for (const e of region.entities.values()) {
      if (e.kind !== "vessel") continue;
      live.add(e.id);
      updateVessel(e as VesselEntity);
    }
    for (const [id, mesh] of vessels) {
      if (!live.has(id)) { scene.remove(mesh); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); vessels.delete(id); }
    }
    renderer.render(scene, camera);
  };

  const onResize = () => {
    const w = target?.clientWidth ?? width;
    const h = target?.clientHeight ?? height;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  if (typeof window !== "undefined") window.addEventListener("resize", onResize);

  const dispose = () => {
    if (typeof window !== "undefined") window.removeEventListener("resize", onResize);
    renderer.dispose();
    for (const m of vessels.values()) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    vessels.clear();
    if (target && renderer.domElement.parentElement === target) target.removeChild(renderer.domElement);
  };

  // Initial frame
  renderer.render(scene, camera);

  return { renderRegion, updateVessel, dispose };
}
