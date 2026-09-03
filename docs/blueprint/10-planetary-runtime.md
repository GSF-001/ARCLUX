# Blueprint 10 — Planetary Layer (Simplified Aerospace)

> Status: **PLAN — belum diimplementasikan.** Simplified: planet seamless + persistent, tapi simulation scope kecil — aerospace operations dulu, bukan full civilization simulator. Pause 09 di Fase 5, gas 10 simplified.

## Problem Statement

Bukan:
> “Bisa bikin planet?” — Sphere 1.018 + clouds AAA EZZ

Melainkan:
> **“Bisa gak kita bikin planet yang seamless & persistent, di mana `aerospace operations` hidup, tanpa harus langsung sim full Earth-scale civilization?”**

ARCLUX cuma sediain planet natural + fasilitas aerospace — civilization komplet jadi future expansion, bukan hari 1.

---

## Pondasi yang Udah Ada (gak bikin dari 0)

* **Matahari/cahaya:** `scene3d.ts:249` `DirectionalLight` + `PMREM` + `MeshStandard` — nyorot planet & awan.
* **Orbit:** Kepler `environs.ts:49` `r=a(1-e²)/(1+e cosθ)` + fase lunar.
* **Fisika:** `physics.ts:12` `G` + `g=9.81` + `thermics.ts:34` `∝1/r²` + `collision.ts:92` `KE=½mv²`.
* **Dunia persistent:** `WorldRegion:41` `Map` + `persistence.ts:120` + `gate.ts:86` transactional + `bridge.ts:75` + `relay/registry.ts:33`.
* **Vessel = repo:** `universe/connect.ts:74` → `.arclux/` → `buildVesselModel` → `server.ts:216` `spawnPlayerVessel`.

---

## 1. Planet sebagai Natural Environment

ARCLUX sediakan:
* procedural terrain, mountains/valleys/desert/ocean, atmosphere 1.018, clouds AAA per-kind 512 `makeCloudTexture`, gravity per-planet, temperature, weather `mulberry32`, day/night 24h, planetary lighting, terrain streaming LOD 16-64 `settings.ts:28`.

Planet tidak perlu langsung punya simulasi kehidupan lengkap — cuma natural environment yang streaming.

### Skala & Persistent Coordinate (Planet Luas Beribu Mil, Bukan Map 4×4)

Planet **harus luas beribu mil** secara geografis — `terrain heightmap` + `ocean 71% Gerstner` + `forest` + `desert` + `mountains` serealistis mungkin (medan per-planet beda, `heightmap` `seed` + `LOD` `settings.ts:28`). Tapi **runtime gak load full planet 24/7** `💀`:

```
PLANET (ribuan km)
        ┌──────────────────────────┐
        │   REGION A               │
        │     [HANGAR A]           │
        │                 REGION B │
        │      REGION C            │
        └──────────────────────────┘
```

* Planet dibagi `region/chunk` `WorldRegion:41` `regionId = planetId:chunkX:chunkZ` (distributed, `relay/registry.ts:33` `claimRegion`) — yang aktif cuma chunk yang ada player/fasilitas, `world state` tetap persistent di `persistence.ts:120`.
* **Persistent coordinate/state, bukan `player di planet X`**: `Planet-07 / Region-A / Hangar-A / position = Vec3{x,y,z}` `types.ts:18` `Vec3` disimpan `RegionSnapshot:79` + `RegionState:65` `Map` — kalau player log out di `Hangar-A`, besok login balik ke `Hangar-A` yang sama, bukan spawn point planet `😭`. `Player A Planet-07/Region-A ↔ 2000 km ↔ Player B Planet-07/Region-B` tetap 1 planet yang sama, beda lokasi — community bisa kirim `coordinate` `Vec3` yang udah kita bikin (`gate.ts:34` `position`) buat rendez-vous. **Spawn gak di tempat sama walau planet sama** — `spawnPlayerVessel` `server.ts:216` pakai `position` dari `VesselModel` / `Hangar` yang dipilih, bukan `0,0,0` global.
* **Isi planet tetap luas + realistik alam** `hutan lebat, lautan ombak, badai hujan, malam lihat bintang/bulan` — `hangar` komunitas bangun di **lahan kosong** yang mereka tentukan (empty land), `ARCLUX batasin` biar gak cape: yang bisa dipakai `engineer` cuma `lahan kosong`, `isi planet (hutan/laut)` tetap natural, gak perlu `tebang pohon` / `excavator` di tahap awal — kalau ada lahan kosong ya di situ bangun `hangar` `wwk`.

### Waktu, Kompas & Hukum Fisika Sama Kayak Dunia Asli

Masuk planet `SPACE → ORBIT → ATMOSPHERE (awan drift) → SURFACE` kayak film — **realistis** `lerp` lapisan awan, bukan teleport. `Waktu/jam di planet pakai hukum yang udah kita bikin` — `physics.ts:12` `G, σ`, `environs.ts:49` Kepler `Bulan` `r=a(1-e²)/(1+e cosθ)` + `day/night 24h` + `season` — `utara malam, barat siang` beda `waktu & kompas` ikut `rotasi planet` + `orbit bulan` Newtonian `tidal`, **gak ada malam lebih cepat / siang lebih lambat** `perputaran bulan` tetap sama kayak dunia asli. User `explore hutan` & `bedain waktu utara-barat` bisa, tapi itu `future expansion` — sekarang `substrate` dulu.

---

## 2. Planet sebagai Aerospace Operations Layer

Fokus utama: `spacecraft` seamless tanpa loading.

```
ORBIT
  ↓
ATMOSPHERE (awan procedural drift)
  ↓
LOW-ALTITUDE FLIGHT
  ↓
PLANET SURFACE
  ↓
LANDING PAD → HANGAR → SHIP OPERATIONS
```

Balik:
```
HANGAR → LAUNCH → ATMOSPHERE → ORBIT
```

Pakai `scene3d.ts:890` cloud drift + `environs.ts` Kepler + `GateLink:34` `spaceport` — lerp lapisan awan, bukan `planet → loading screen`.

---

## 3. Civilization Tidak Dibuat Oleh ARCLUX

ARCLUX gak bikin kota/NPC/fauna global. Community yang bangun:

* Landing Pad, Hangar, Repair Facility, Refit Facility, Radar, Communication Station, Military Facility, Storage, Manufacturing Facility, Spaceport

Planet mulai kosong (`🌲🌲🌲`), community isi fasilitas sesuai kebutuhan.

---

## 4. Character Tetap Berguna (Scope Dibatasi)

Player tetap bisa keluar vessel & jalan, tapi cuma di fasilitas.

```
Vessel → Dock → Player keluar → Hangar → Repair/Refit → kembali → Launch
```

FPS `capsule 1.8m` + `gravity 9.81` + `raycast` + `clampSpeed 5.5` `baseline.ts:16` — hanya di `hangar/facility`, bukan full planet FPS MMORPG.

---

## 5. Tidak Perlu Full Planet Civilization Simulation (Di-tahan)

Tahap awal **gak perlu**:
* NPC population simulation, fauna ecosystem, animals/dinosaurs, tree chopping, excavator terrain deformation, real-time mountain destruction, civilian vehicle ecosystem, procedural cities, full planetary economy, global human-life simulation.

Semua itu future expansion kalau diperlukan — bukan hari 1.

---

## 6. Infrastructure Tetap Persistent

Fasilitas community tetap pakai konsep existing:

```
Community → Structure → Components → Health → Damage → Destruction → Persistence
```

`StationEntity:54` `health 0..100` `component.ts:10` + `combat.ts:39` `DAMAGE_CEILING=12` / `KE=½mv²` → `region.remove` + `wreckage 04` + `Repair=commit 02:257` — hangar/military tetap punya konsekuensi.

---

## 7. Space dan Planet Tetap Satu Universe

Planet bukan game terpisah — extension dari space universe.

```
Space Region → Planetary Region → Spaceport → Hangar/Facility
```

`GateLink` / `region transition` sebagai boundary logical. Yang penting:

```
SPACE → ATMOSPHERE → PLANET  terasa satu perjalanan seamless
```

---

## 8. Tujuan Proposal

Bukan bikin planet lebih sederhana secara visual — planet tetap besar & realistis. Tapi **lebih sederhana secara simulation scope**.

Dengan ini ARCLUX dapat:
* explorable planets, seamless space-to-planet transition, low-altitude flight, player landing, hangars, community infrastructure, FPS character interaction, persistent planetary facilities

tanpa langsung bangun full Earth-scale civilization simulator. Blueprint 10 civilization komplet tetap bisa jadi future expansion, tapi gak perlu di hari 1.

---

## Checklist (simplified + zoom detail)

* [ ] Substrate natural: terrain + ocean 71% Gerstner + forest + atmosphere 1.018 + clouds AAA per-kind + gravity/temperature/weather/day-night (visual-only, streaming LOD)
* [ ] **Skala luas beribu mil + persistent coordinate:** planet dibagi `Region/Chunk` `WorldRegion:41` `claimRegion` — yang aktif cuma chunk yang dipakai, `position Vec3` `RegionSnapshot:79` persist `persistence.ts:120` — log out di `Hangar-A` balik ke `Hangar-A`, Player A ↔ 2000 km ↔ Player B tetap 1 planet, spawn gak sama, bisa kirim `coordinate` `gate.ts:34`
* [ ] **Waktu & kompas Newtonian:** `day/night 24h` + `Bulan Kepler` `environs.ts:49` + `physics.ts:12` `G, σ` — `utara malam barat siang` beda, `waktu = dunia asli` (gak ada malam cepat), `compass` ikut rotasi planet — masuk `SPACE→ATMOSPHERE→SURFACE` lerp awan kayak film
* [ ] Aerospace seamless: ORBIT → ATMOSPHERE → LOW-FLIGHT → LANDING PAD → HANGAR (GateLink spaceport, tanpa loading) — `hangar` di `lahan kosong` yang komunitas tentukan, `ARCLUX batasin` biar gak cape, `hutan/laut` tetap natural
* [ ] Community facilities: Landing Pad/Hangar/Repair/Refit/Radar/Comms/Military/Storage/Manufacturing/Spaceport (StationEntity health, code→health)
* [ ] Character terbatas di fasilitas: Vessel→Dock→keluar→Hangar→Launch (FPS 5.5 m/s, bukan full planet)
* [ ] Space ↔ Planet satu universe: Planetary Region via GateLink

> 09 Part A Fase 6-7 + Part B 8-12 tetap next setelah 10 simplified — tapi 10 sekarang aerospace dulu, bukan simcity.
