# Blueprint 10 — Planetary Runtime (Civilization Can Live)

> Status: **PLAN — belum diimplementasikan.** Pause 09 di Fase 5, gas planetary. File ini blueprint `planet kosong + runtime hidup` — `ARCLUX cuma sediain planet kosong + atmosfer + hukum alam, komunitas yang bangun civilization` (infrastruktur, mobil, jalan, hangar, karakter — urusan mereka, kita sediain runtime biar semua bisa hidup & hancur kayak vessel).

## Problem Statement (yang bener)

Bukan:
> “Bisa bikin planet?” — `Sphere 1.018 + clouds AAA` `scene3d.ts` EZZ

Melainkan:
> **“Bisa gak kita bikin sebuah `runtime` tempat `civilization yang TIDAK kita buat sendiri` dapat hidup di `planet kosong` yang kita sediakan?”**

`Planet` = substrate. `Runtime` = `WorldRegion` + `Simulation` + `Validator` + `Persistence` + `Gate` yang bikin `BASE → CITY → ROVER → HANGAR` bukan mesh mati.

---

## Pondasi yang Udah Ada (gak bikin dari 0)

* **Matahari/cahaya:** `scene3d.ts:249` `DirectionalLight(sunCore 2.2)` + `PMREM scene.environment:858` + `MeshStandardMaterial` — sinar yang sama nyorot planet & awan `makeCloudTexture` + `Sphere 1.018` drift.
* **Bulan/orbit:** `Sphere(radius*0.18)` `scene3d.ts:333` Kepler `environs.ts:49` `r=a(1-e²)/(1+e cosθ)` + fase lunar `mdir.dot(sdir):904` — fisik asli.
* **Hukum alam:** `physics.ts:12` `G, σ, c, AU` + `g=9.81` + `thermics.ts:34` `L/4πr²` `∝1/r²` `>1200K` + `collision.ts:92` `KE=½mv²×angle×penetration` + `baseline.ts` imun D-019 `WorldRegion:41` `Map` 5000 entities `stability.ts:13` `tickScheduler 10/s`.
* **Dunia persistent:** `WorldRegion:41` `Map` + `RegionSnapshot:79` `/snapshot` `server.ts:139` + `persistence.ts:120` `RecoveryManager` + `gate.ts:86` transactional `notifyTarget→ACK` + `bridge.ts:75` `identity.move` + `relay/registry.ts:33`.
* **Vessel = repo:** `universe/connect.ts:74` `connectRepository` → `.arclux/` + `buildVesselModel` `stats.ts:183` → `server.ts:216` `spawnPlayerVessel` (`VesselEntity.owner` `types.ts:32` `validator.ts:53`).

---

## Planetary Substrate (ARCLUX sediain — kosong, bukan kota)

```
PLANET KOSONG
├── terrain heightmap (seed → continental → mountain → biome → river, streaming chunks LOD 16-64 settings.ts:28)
├── ocean 71% (Sphere + Gerstner waves ω²=g·k, depth dari heightmap, evaporation thermics.ts)
├── forest 6000 InstancedMesh Dodecahedron 14 like belt:373 + soil layers vertexColors
├── atmosphere Sphere 1.018 + clouds AAA per-kind 512 CanvasTexture (gasGiant banded, ocean swirl, ice wispy, desert dust, volcanic ash) + drift rotation.y
├── weather mulberry32(tick) + Perlin (rain/wind, gak 100% deterministic)
├── gravity per-planet Earth 9.81 / Mars lower / extreme toxic
└── day/night 24h + temperature variable
```

Visual-only: `child sphere 1.018` drift `scene3d.ts:890` `speedMap[kind]`, `depthWrite:false`, `metalness 0`, `dispose` `buildPlanetSystem:283`, gak masuk `WorldRegion.entities`/`EnvironsState.bodies`/`RegionSnapshot` — gak nambah `O(V*B)` `simulation.ts:121`.

---

## Runtime — Biar Semua yang Dibangun Bisa Hidup

### 1. Jalan di Planet Kayak di Bumi (WTF #1)
* `FPS capsule 1.8m` + `gravity 9.81` + `raycast terrain` + `navmesh` streaming + `clampLocal 1/1` (bukan `1/90000` space `scene3d.ts:472`) + `clampSpeed 5.5 m/s` (kapal 250 `baseline.ts:16`) + `drag 0.12` — `simulation.ts:238` `p+=v*dt` yang sama, tick 10/s.

### 2. Karakter Punya Darah/Kehidupan (WTF #2)
* `CharacterEntity = VesselEntity mini` `mass 80kg` + `SystemState:32` `health blood/stamina/hunger 0..100` + `thermics/combat/collision → health-2` + `lineage.ts:22` provenance — `tebang pohon / jatuh / lapar` → `health--` persist `persistence.ts`, bukan `respawn`.

### 3. Infrastruktur Bisa Hidup & Hancur (WTF #3 — kayak vessel)
* Tiap `BASE/hangar/jalan` = `StationEntity:54` `health 0..100` `component.ts:10` `health/usageCount` + `code → health` `buildVesselModel` — `combat.ts:39` `DAMAGE_CEILING=12` / `KE=½mv²` → `destroyed = damage>=integrity(80)` → `region.remove` + `wreckage 04` `RECOVERY` + `Repair=commit 02:257` — `🏕️→🏭→🏢→💥→🏚️` persistent.

### 4. Mobil/Jalan/Hangar Kapal di Planet
* `ROVER = VesselEntity mass 2000kg thrust 4e3 N` (kapal `5e6 kg 2e7 N` `simulation.ts:267`), `ROAD = StationEntity safeZone governance.ts:31`, `HANGAR = StationEntity + 32 InstancedMesh slots` `interior.ts:480` — semua `Map` 5000, `GateLink:34` `spaceport runway` → `SPACE ↔ PLANET` `Gate` `SPACE ↔ ATMOSPHERE ↔ LANDING ↔ PLANET`.

### 5. Penebangan & Tanah Berlapis
* `forest InstancedMesh` + `heightmap vertexColors` + `🌲 = StationEntity mini health` → `🪓 collision → health-- → stump` — `persistence`.

### 6. Lautan Dalam + Ombak + Cuaca
* `Ocean Sphere + Gerstner Shader pos+=amp·sin(k·pos-ωt) ω=√(gk)` + `depth` heightmap + `evaporation → rain` `thermics 1/r²` + `weather` `mulberry32(tick*regionId)` `cosmicEvent 0.2%`.

### 7. Semua Built by Community Bisa Hidup — Kita Mikirin Engine-nya
* Kita sediain `simulation D-008 authoritative + validator owner/license + gate transactional + directory` — user isi `content schema 11` `community-base: structures/components/capabilities` → `runtime` cek `valid?` (bukan `bebas jalanin kode`). Jadi `code mereka → health → hidup/hancur` di `WorldRegion` `SPACE + PLANET = SAME UNIVERSE / SAME PERSISTENCE / SAME COMMUNITIES`.

---

## Space ↔ Planet — Satu Universe

```
ARCLUX
   ├─ 🌌 SPACE (kapal/station/combat/gates)  ✅ udah ada — WorldRegion + Environs
   └─ 🌍 PLANET (terrain/ocean/city/base)    🆕 substrate + runtime di atas
            └─ SPACEPORT GateLink:34 — kapal orbit LANDING ke planet, LAUNCH ke orbit tanpa loading screen, lerp lapisan awan
```

`SPACEPORT` jadi `Gate` — `SPACE → ORBIT → ATMOSPHERE (awan procedural) → SURFACE` kayak film, bukan `planet → loading screen`.

---

## Checklist (pause 09 di Fase 5)

* [ ] Substrate: terrain heightmap streaming + ocean Gerstner + forest Instanced + atmosphere 1.018 + clouds AAA (visual-only)
* [ ] Runtime FPS walk 9.81 + raycast + navmesh (capsule, 5.5 m/s)
* [ ] Character health blood/stamina + lineage
* [ ] Building health (StationEntity, code → health, damage, wreckage, repair=commit)
* [ ] Vehicle VesselEntity (ROVER 2000kg, ROAD safeZone, HANGAR 32 slots)
* [ ] Penebangan + soil layers
* [ ] Lautan depth + ombak + cuaca
* [ ] Content schema validation (safe, bukan bebas kode)
* [ ] Space ↔ Planet Gate (spaceport runway)

> `09 Part A` Fase 6 custom music + Fase 7 UI + `Part B` 8-12 interior FPS tetap next setelah planetary substrate — tapi planetary runtime ini pondasi biar semua yang mereka bangun bisa hidup.
