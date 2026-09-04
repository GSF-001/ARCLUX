// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
//
// scene3d/belt.ts — asteroid belt COLLIDABLE visual §2.1/§2.2 (instanced,
// statis — tidak di-tick). Moved verbatim dari scene3d.ts.

import * as THREE from "three";
import { colors, threeColor } from "../../ui/tokens";
import type { SceneContext } from "./bootstrap";

/** (Re)build belt — Dodecahedron instanced, dispose aman tiap rebuild. */
export function buildBelt(ctx: SceneContext, count: number): void {
  const { scene, rand } = ctx;
  const beltDummy = new THREE.Object3D();
  const beltGeom = new THREE.DodecahedronGeometry(14, 0);
  const beltMat = new THREE.MeshStandardMaterial({ color: threeColor(colors.belt), roughness: 1, metalness: 0.12 });
  if (ctx.belt) { scene.remove(ctx.belt); (ctx.belt.material as THREE.Material).dispose(); }
  const belt = new THREE.InstancedMesh(beltGeom, beltMat, count);
  for (let i = 0; i < count; i++) {
    const r = 26000 + rand() * 8000;
    const angle = rand() * Math.PI * 2;
    beltDummy.position.set(r * Math.cos(angle), (rand() - 0.5) * 1600, r * Math.sin(angle));
    const s = 4 + rand() * 20;
    beltDummy.scale.set(s, s, s);
    beltDummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    beltDummy.updateMatrix();
    belt.setMatrixAt(i, beltDummy.matrix);
  }
  belt.instanceMatrix.needsUpdate = true;
  belt.rotation.x = 1.1;
  scene.add(belt);
  ctx.belt = belt;
}
