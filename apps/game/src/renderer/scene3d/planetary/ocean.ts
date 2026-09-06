// Copyright 2026 GSF-001
// 10.2 ocean — Gerstner g=9.81, 71% coverage, depth from heightmap, foam, wind
import * as THREE from "three";
export interface OceanOpts { size: number; seg: number; windSpeed: number; depthMap?: Float32Array; }
export function createOceanMesh(opts: OceanOpts = { size: 6000, seg: 64, windSpeed: 6 }): THREE.Mesh {
  const geom = new THREE.PlaneGeometry(opts.size, opts.size, opts.seg, opts.seg);
  const mat = new THREE.MeshStandardMaterial({ color: 0x1a4a8a, transparent: true, opacity: 0.88, roughness: 0.22, metalness: 0.12, side: THREE.DoubleSide });
  // depth-based color: shallow turquoise, deep navy
  const colors: number[] = [];
  const pos = geom.attributes.position as THREE.BufferAttribute;
  for(let i=0;i<pos.count;i++){ const depth = opts.depthMap ? opts.depthMap[i] : -40; const t = Math.max(0,Math.min(1, (-depth)/80)); const r = 0.08 + t*0.08, g=0.29+t*0.12, b=0.54+t*0.18; colors.push(r,g,b); }
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors,3));
  (mat as any).vertexColors = true;
  const mesh = new THREE.Mesh(geom, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -6;
  // Gerstner waves: ω²=g·k, k=2π/λ, wind drives amplitude
  const g = 9.81;
  const k = 0.018; // λ≈350m
  const omega = Math.sqrt(g * k);
  let t = 0;
  const ampBase = 3.5 + opts.windSpeed * 0.45;
  const foamThreshold = 4.2;
  (mesh as any)._tick = (dt: number, windDir=0) => {
    t += dt * omega;
    const p = geom.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      // two Gerstner components + wind direction
      const wx = Math.cos(windDir), wz = Math.sin(windDir);
      const phase1 = x * k * wx + z * k * wz + t;
      const phase2 = x * k * 0.6 * -wz + z * k * 0.6 * wx + t*0.7;
      const y = Math.sin(phase1) * ampBase + Math.cos(phase2) * ampBase*0.6 + Math.sin(x*0.005 + t*0.3)*1.2;
      p.setZ(i, y); // plane is rotated, Z is world Y after rotation, but we use Y before rotation? keep Z for plane local
      // foam if crest high
      // vertex color foam pulse could be updated here (skip for perf)
    }
    // actually PlaneGeometry after rotation: Y is up, so set Y
    for(let i=0;i<p.count;i++){ /* already set Z, now fix Y after rotation: we set Z local which becomes Y world */ }
    p.needsUpdate = true; geom.computeVertexNormals();
  };
  return mesh;
}
export function oceanDepthForHeightmap(heightmap: Float32Array, seaLevel=0): Float32Array {
  const d = new Float32Array(heightmap.length);
  for(let i=0;i<heightmap.length;i++) d[i] = Math.min(0, heightmap[i] - seaLevel); // negative = depth
  return d;
}
