# Blueprint 10 — Planetary Runtime (Final — Simplified Aerospace)

> Status: **PLAN — FINAL (company-grade).** Simplified aerospace: planet luas ribuan mil + seamless + persistent, tapi simulation scope kecil — aerospace ops dulu, bukan SimCity. Pause `09` di Fase 5, `10` dulu. File ini **perfect blueprint** dari ide abstrak — bukan tempel mentah, tapi diurai jadi komponen & kebutuhan.

## 1. Abstract

`ARCLUX` punya `SPACE` persistent yang heavy-stable (`WorldRegion` 5000 entities `stability.ts:13`, `tick 10/s` `tickScheduler`, `G`/`Kepler`/`1/r²`/`KE`). `10` menambah **planet sebagai dunia kedua** di bawahnya — **bukan map 4×4**, tapi **planet beneran skala ribuan mil** dengan **runtime yang cuma aktifkan chunk yang dipakai** + **persistent coordinate** + **waktu Newtonian sama kayak dunia asli**. ARCLUX cuma sediain **substrate natural kosong** `+` **hukum alam** — **civilization diisi komunitas** di `lahan kosong`, `hutan/laut` tetap natural.

## 2. Problem Statement (Final)

* Bukan `bisa bikin planet?` (`Sphere 1.018 + clouds AAA` EZZ).
* Tapi `bisa gak bikin runtime tempat civilization yang TIDAK kita buat bisa hidup di planet kosong yang kita sediakan, dengan skala ribuan mil, coordinate persistent, spawn beda, dan waktu/kompas real?` — `runtime` harus handle `ribuan fasilitas tersebar` tanpa `load full planet 24/7`.

## 3. Goals / Non-Goals

**Goals:**
* Planet visual besar & realistis `terrain/ocean/atmosphere/clouds` streaming `LOD 16-64` `settings.ts:28`, tapi `runtime` kecil: cuma `aerospace` `ORBIT→ATMOSPHERE→LANDING PAD→HANGAR` seamless.
* Planet luas beribu mil, `region/chunk` distributed `WorldRegion:41` `claimRegion` `relay/registry.ts:33`, `position Vec3` `types.ts:18` persist `RegionSnapshot:79` `persistence.ts:120` — log out di `Hangar-A` balik `Hangar-A`, `Player A ↔2000 km↔ Player B` 1 planet.
* Masuk planet `SPACE→ATMOSPHERE→SURFACE` `lerp` awan kayak film, `waktu/jam/kompas` `day/night 24h` + `Bulan Kepler` `environs.ts:49` `physics.ts:12` `G,σ` — `utara malam barat siang` beda, `waktu = dunia asli`.
* Community bangun `Landing Pad/Hangar/Repair/Refit/Radar/Comms/Military/Storage/Manufacturing/Spaceport` di `lahan kosong` — `StationEntity` persistent.

**Non-Goals (tahan untuk future `11`):**
* NPC population, fauna/dino, tree chopping, excavator deform, procedural cities, full economy — gak di hari 1. `Gak perlu simcity lagi.` Cukup `hangar di lahan kosong`.

## 4. Pondasi yang Dipakai (gak bikin dari 0)

* **Cahaya:** `scene3d.ts:249` `DirectionalLight` + `PMREM scene.environment:858` + `MeshStandard` — nyorot planet & awan.
* **Orbit:** Kepler `environs.ts:49` `r=a(1-e²)/(1+e cosθ)` + fase lunar `mdir.dot(sdir):904`.
* **Fisika:** `physics.ts:12` `G, σ, c, AU` + `g=9.81` + `thermics.ts:34` `L/4πr²` + `collision.ts:92` `KE=½mv²×angle` + `baseline.ts` imun D-019.
* **Persistent world:** `WorldRegion:41` `Map` + `RegionSnapshot:79` `/snapshot` `server.ts:139` + `persistence.ts:120` + `gate.ts:86` `notifyTarget→ACK` + `bridge.ts:75` + `relay`.
* **Vessel=repo:** `universe/connect.ts:74` → `.arclux/` → `buildVesselModel` `stats.ts:183` → `server.ts:216` `spawnPlayerVessel`.

## 5. Architecture — Substrate vs Runtime

```
Substrate (visual-only, gak masuk WorldRegion)          Runtime (authoritative, di Map)
planet sphere + heightmap streaming + ocean Gerstner  →  WorldRegion Map 5000 (chunk)
clouds AAA per-kind 512 + atmosphere 1.018             →  Character FPS 5.5 m/s + health
weather mulberry32 + Perlin + day/night 24h            →  StationEntity facility health
                                                       →  GateLink spaceport ORBIT↔PLANET
```
* Substrate `gak nambah O(V*B)` `simulation.ts:121` — cuma `scene3d.ts` `Mesh` child `1.018` drift.
* Runtime `tick 10/s` `simulation.ts:85` `p+=v*dt` — `SPACE + PLANET = SAME UNIVERSE / SAME PERSISTENCE`.

## 6. Components — Diurai dari Ide Abstrak

| # | Komponen | Apa yang Dibikin | File Baru / Ubah | Kunci |
|---|----------|------------------|------------------|-------|
| 1 | **Planetary Substrate** | `heightmap` `seed→continental→mountain→biome→river` + `ocean 71% Gerstner ω²=gk` + `forest Instanced` + `atmosphere 1.018` + `clouds AAA` + `weather/day-night` | `scene3d.ts:281` `buildPlanetSystem` + `makeCloudTexture` + `settings.ts:28` LOD | `child sphere 1.018` `depthWrite:false` `metalness 0` `dispose` `buildPlanetSystem:283` |
| 2 | **Scale & Chunk** | Planet `ribuan km` → `PlanetId / ChunkId` `regionId = planet:chunkX:chunkZ` distributed `claimRegion` — aktif cuma chunk ada player/fasilitas | `world.ts:41` `WorldRegion` `regionId` + `relay/registry.ts:33` `claimRegion` + `environs.ts` `SystemBody` `planetId` | `stability.ts:13` 5000 cap |
| 3 | **Persistent Coordinate** | `Planet-07/Region-A/Hangar-A/position Vec3` `types.ts:18` persist `RegionSnapshot:79` `persistence.ts:120` — log out `Hangar-A` balik `Hangar-A`, spawn gak sama, bisa kirim `coordinate` `Vec3` `gate.ts:34` rendez-vous | `types.ts:18` `Vec3` + `world.ts:96` `spawnVessel(pos)` + `server.ts:216` | `2000 km` 1 planet |
| 4 | **Time & Compass** | `day/night 24h` + `Bulan Kepler` `environs.ts:49` + `season` + `physics.ts:12` `G,σ` → `utara malam barat siang` beda, `waktu = dunia asli` (gak ada malam cepat), `compass` ikut `planet rotation` | `environs.ts:49` + `physics.ts:12` + `scene3d.ts:249` Directional | `lerp` lapisan awan `SPACE→ATMOSPHERE` |
| 5 | **Aerospace Seamless** | `ORBIT→ATMOSPHERE(awan drift)→LOW-FLIGHT→SURFACE→LANDING PAD→HANGAR` dan `LAUNCH→ORBIT` `GateLink:34` spaceport, tanpa loading | `scene3d.ts:890` `speedMap` + `gate.ts:86` + `bridge.ts:75` | `lerp` |
| 6 | **Facilities** | Community bangun di `lahan kosong` (ARCLUX batasin biar gak cape, `hutan/laut` natural): `Landing Pad, Hangar, Repair, Refit, Radar, Comms, Military, Storage, Manufacturing, Spaceport` | `world.ts:115` `spawnStation` `StationEntity:54` `health` + `component.ts:10` | `code→health` |
| 7 | **Character Terbatas** | `Vessel→Dock→keluar→Hangar→Repair→Launch` `FPS capsule 1.8m` `gravity 9.81` `raycast` `clampSpeed 5.5` `baseline.ts:16` — cuma di fasilitas, bukan full planet FPS | `input.ts` + `world.ts:96` `CharacterEntity` future | `Map` |
| 8 | **Persistent Infra** | `Community→Structure→Components→Health→Damage→Destruction→Persistence` `StationEntity health` `DAMAGE_CEILING 12` `KE` → `region.remove` + `wreckage 04` + `Repair=commit 02:257` | `component.ts:10` `combat.ts:39` `collision.ts:92` | `consequence` |

## 7. Data Model & Persistence

* `PlanetaryRegion { planetId: string, chunkId: string, regionId: string, bounds: { min: Vec3, max: Vec3 } }` — `WorldRegion.regionId` reuse `planet:chunk`.
* `Position Vec3` `types.ts:18` `x,y,z` meter — `RegionSnapshot.entities[]` `position` + `RegionState Map` — `persistence.ts:120` `RecoveryManager` per-chunk.
* `GateLink:34` `position` `activationRadius` `allowedCommunityIds` — `spaceport runway` `ORBIT↔PLANET`.

## 8. Scaling & Security

* Chunk `claimRegion` `relay/registry.ts:33` — yang aktif cuma `entitiesWithin` `world.ts:83` chunk, gak load full planet `💀`.
* Validasi `content schema 11` `community: structures/components/capabilities` → `universe/schema.ts` + `license.ts` `validator.ts:53` — `valid?` (bukan bebas kode), 5 packages stub tetap.
* `rateLimiter.ts 20/s` + `stability.ts` `5000 entities` + `tickScheduler 10/s` — `fauna di-tahan` biar gak jebol `O(V*B)`.

## 9. Checklist (Final — Simplified)

* [ ] Substrate natural `terrain/ocean/atmosphere/clouds` streaming LOD (visual-only, gak masuk `WorldRegion`)
* [ ] **Skala ribuan mil + chunk distributed + persistent coordinate** `Planet/Chunk` `claimRegion` `position Vec3` persist — log out `Hangar-A` balik `Hangar-A`, 2000 km 1 planet, spawn beda, bisa kirim coordinate
* [ ] **Waktu & kompas Newtonian** `24h + Bulan Kepler + G,σ` `utara malam barat siang` `waktu = dunia asli` `SPACE→ATMOSPHERE` lerp
* [ ] Aerospace seamless `ORBIT→HANGAR` `GateLink` tanpa loading — hangar di lahan kosong (ARCLUX batasin)
* [ ] Community facilities `10` jenis `StationEntity health` `code→health`
* [ ] Character terbatas di fasilitas `FPS 5.5` (bukan full planet)
* [ ] Space ↔ Planet satu universe `Planetary Region` via `GateLink`

> `09` Fase 6-7 + `Part B` 8-12 tetap next setelah `10` simplified — `10` sekarang final aerospace, bukan simcity. Future `fauna/tree chopping/city` jadi `11` kalau perlu.
