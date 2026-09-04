// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/stars.ts — starfield FAR §22 (instanced, statis) + bintang panas
// spectral (depth). Moved verbatim dari scene3d.ts — tidak kenal vessel.

import * as THREE from "three";
import { colors, threeColor } from "../../ui/tokens";
import type { SceneContext } from "./bootstrap";

/** 6000 bintang + 160 hot spectral — konsumsi rand sesuai urutan lama. */
export function buildStars(ctx: SceneContext): void {
  const { scene, rand } = ctx;
  const starDummy = new THREE.Object3D();
  const starGeom = new THREE.SphereGeometry(1, 4, 4);
  const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const makeStars = (count: number): THREE.InstancedMesh => {
    const mesh = new THREE.InstancedMesh(starGeom, starMat, count);
    for (let i = 0; i < count; i++) {
      const r = 20000 + rand() * 120000;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      starDummy.position.set(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
      starDummy.scale.set(1 + rand() * 3, 1 + rand() * 3, 1 + rand() * 3);
      starDummy.updateMatrix();
      mesh.setMatrixAt(i, starDummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
    return mesh;
  };
  makeStars(6000);

  // Bintang panas spectral (depth)
  const hotGeom = new THREE.SphereGeometry(1, 6, 6);
  const hotColorList = [colors.hotStarA, colors.hotStarB, colors.hotStarC];
  const hotMesh = new THREE.InstancedMesh(hotGeom, new THREE.MeshBasicMaterial({ color: 0xffffff }), 160);
  for (let i = 0; i < 160; i++) {
    const r = 30000 + rand() * 150000;
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    starDummy.position.set(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
    starDummy.scale.set(3 + rand() * 10, 3 + rand() * 10, 3 + rand() * 10);
    hotMesh.setColorAt(i, new THREE.Color(threeColor(hotColorList[i % 3])));
    starDummy.updateMatrix();
    hotMesh.setMatrixAt(i, starDummy.matrix);
  }
  hotMesh.instanceMatrix.needsUpdate = true;
  if (hotMesh.instanceColor) hotMesh.instanceColor.needsUpdate = true;
  scene.add(hotMesh);
}
