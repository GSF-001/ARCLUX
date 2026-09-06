# Blueprint 10 — Planetary Runtime

> Status: **PLAN — FINAL.** Aerospace planetary layer: seamless, persistent, planet-scale exploration with community-built surface facilities. Simulation scope deliberately small — aerospace operations first, not a full civilization simulator. `09` paused at Fase 5.

## 1. Overview

`ARCLUX` already provides a persistent `SPACE` universe (`WorldRegion` 5000 entities `stability.ts:13`, `tick 10/s` `tickScheduler`, `G/Kepler/1/r²/KE` `physics.ts:12`, `Gate` transactional `gate.ts:86`). `10` adds a **planetary layer beneath it** — a planet-scale natural environment that is **thousands of kilometers across**, **streamed by chunks**, and **shares the same persistence and physics** as space.

The planet is **empty by default** — `terrain, ocean, atmosphere, weather` are generated, but `cities, hangars, bases` are built by communities on **empty land**. The runtime makes everything they build **live and destructible** like vessels.

## 2. Objectives / Non-Objectives

**Objectives:**
* Seamless `SPACE → ORBIT → ATMOSPHERE → SURFACE` without loading screens.
* Planet-scale geography that is explored, not teleported.
* Community-built surface facilities that are persistent and have consequences.
* Character that can leave the vessel and operate inside facilities.

**Non-Objectives (deferred to future expansion):**
* Global NPC / fauna / city simulation, terrain deformation, procedural cities, full economy — not in this blueprint.

## 3. Foundation Reuse (No New Laws)

* **Lighting:** `scene3d.ts:249` `DirectionalLight` + `PMREM scene.environment:858` + `MeshStandard` — same sun illuminates planet and clouds.
* **Orbit:** Kepler `environs.ts:49` `r=a(1-e²)/(1+e cosθ)` + lunar phase.
* **Physics:** `physics.ts:12` `G, σ, c, AU` + `g=9.81` + `thermics.ts:34` `L/4πr²` + `collision.ts:92` `KE=½mv²×angle`.
* **Persistence:** `WorldRegion:41` `Map` + `RegionSnapshot:79` `/snapshot` `server.ts:139` + `persistence.ts:120` `RecoveryManager` + `gate.ts:86` + `bridge.ts:75` + `relay/registry.ts:33`.
* **Vessel as Repository:** `universe/connect.ts:74` → `.arclux/` → `buildVesselModel` `stats.ts:183` → `server.ts:216` `spawnPlayerVessel`.

## 4. Planetary Substrate — Natural Environment (Visual-Only)

* **Terrain:** `seed → continental → mountain → biome → river` heightmap, streaming `LOD 16-64` `settings.ts:28`, `vertexColors` topsoil/clay/rock.
* **Ocean:** `SphereGeometry` + Gerstner waves `ω²=g·k` `g=9.81`, depth from heightmap, `71%` coverage.
* **Atmosphere:** `Sphere 1.018` + procedural clouds `makeCloudTexture 512` per-kind (gasGiant banded, ocean swirl, ice wispy, desert dust, volcanic ash) `scene3d.ts` child `depthWrite:false`.
* **Weather:** `mulberry32(tick)` + Perlin `rain, wind, fog`, not fully deterministic.
* **Environment:** per-planet `gravity, temperature, weather, day/night 24h, lighting` — streamed, `g` varies (Earth 9.81, Mars 3.71).

Visual-only: `child sphere 1.018` drift, `metalness 0`, `dispose` `buildPlanetSystem:283` — does not enter `WorldRegion.entities` / `EnvironsState.bodies` / `RegionSnapshot`, does not add `O(V*B)` `simulation.ts:121`.

## 5. Scale & Persistence — Large Planet, Chunked Runtime

A planet is **thousands of kilometers** — `heightmap` + `ocean` + `forest` are geographically large, but the **runtime only activates chunks that are in use**.

```
PLANET (thousands km)
  ┌──────────────────────────┐
  │   REGION A [HANGAR A]    │
  │                 REGION B │
  │      REGION C            │
  └──────────────────────────┘
```

* **Chunking:** `regionId = planetId:chunkX:chunkZ` distributed via `WorldRegion:41` `relay/registry.ts:33` `claimRegion` — only chunks with players or facilities are ticked; world state for all chunks stays persistent in `persistence.ts:120`.
* **Persistent Coordinate:** `position Vec3{x,y,z}` `types.ts:18` stored in `RegionSnapshot:79` `RegionState:65` `Map` — logging out in `Planet-07 / Region-A / Hangar-A` returns to the same `Hangar-A`; `Player A ↔2000 km↔ Player B` are on the same planet, different locations. Coordinates are shareable (`gate.ts:34` `position`) for rendezvous. Spawn is at the chosen facility, not a global `0,0,0`.
* **Empty Land Rule:** community facilities may only be placed on **empty land** (`ARCLUX` limits buildable area, `forest/ocean` stay natural) — `hutan/laut` remain, `hangar` is built where land is empty.

## 6. Time & Compass — Real-World Laws

`SPACE → ORBIT → ATMOSPHERE → SURFACE` is a `lerp` through cloud layers, not a teleport.

* **Time:** `day/night 24h` + `lunar Kepler` `environs.ts:49` + `season` + `physics.ts:12` `G,σ` — `north is night while west is day` because `compass` follows `planet rotation` + `lunar orbit` Newtonian tidal. No `night faster` — time equals real world.

## 7. Aerospace Operations — Seamless Flight

```
ORBIT → ATMOSPHERE (cloud occlusion) → LOW-ALTITUDE FLIGHT → PLANET SURFACE → LANDING PAD → HANGAR → SHIP OPERATIONS
HANGAR → LAUNCH → ATMOSPHERE → ORBIT
```

* `GateLink:34` `spaceport` `activationRadius 800m` `gate.ts:86` + `cloud drift` `scene3d.ts:890` + `simulation.ts:238` `p+=v*dt` — approach can be `safe (auto Gate notifyTarget→ACK)` or `manual (raycast terrain, KE damage on crash)`.
* Low-altitude flight is gameplay: `cloud closes cockpit 2s → terrain LOD fades in → search for facility`.

## 8. Surface Facilities — Built by Community

ARCLUX does not build cities. Community builds on empty land:

`Landing Pad, Hangar, Repair Facility, Refit Facility, Radar, Communication Station, Military Facility, Storage, Manufacturing Facility, Spaceport`

Planet starts empty (`🌲🌲🌲`), community fills it. Each facility is `StationEntity:54` `health 0..100` `component.ts:10` — `code → health` `buildVesselModel` — `combat.ts:39` `DAMAGE_CEILING=12` / `KE=½mv²` → `region.remove` + `wreckage 04` + `Repair=commit 02:257` — hangars have consequences.

## 9. Character — Limited to Facilities

```
Vessel → Dock → Exit → Hangar → Repair/Refit → Return → Launch
```

`FPS capsule 1.8m` `gravity 9.81` `raycast` `clampSpeed 5.5 m/s` `baseline.ts:16` — only inside `hangar/facility` interiors, not full-planet FPS. `CharacterEntity` `mass 80kg` `health blood/stamina` `SystemState:32` persists via `lineage.ts`.

## 10. Strategic Geography — Terrain Creates Opportunity

`heightmap` deterministically (`mulberry32(planetId)` `random.ts`) creates:

* `mountains (slope>0.4) → military`, `plains (slope<0.1) → spaceport`, `desert → remote`, `poles → observatory`, `coastline <2km → coastal facilities`, `valleys → hidden`.

Geography itself creates strategic locations — no hand-placed cities needed.

## 11. Night & Discovery — Planet Feels Inhabited Without NPCs

* **Night:** `StationEntity` `emissive #ffd9a0` `96 windows/ring` + `PointLight` `runway` `amber` — from orbit at night `DirectionalLight` off, facility emissive stays (`PMREM` off) — `orbit sees light → descend → runway → hangar` feels inhabited without one NPC.
* **Discovery:** `Radar` `world.ts:83` `entitiesWithin(pos,50000)` + `distanceBetween:150` + `directory listServers` — `Planet-07: Hangar-A 12 km / Military-B 847 km / Spaceport-C 1,920 km / Unknown 430 km` — thousands of km matter.

## 12. Social Geography — Empty by Default, Shaped by Players

```
Developer:  “Here is the planet.”
Community A: “Here I build a spaceport.”
Community B: “I build a military hangar 800 km away.”
Player:      “I discover their facilities.”
```

Planet slowly acquires social geography organically — no global sim needed. `Don't make the planet more complex — make the same planet feel deeper.`

## 13. Checklist

* [ ] Substrate natural `terrain/ocean/atmosphere/clouds` streaming LOD (visual-only)
* [ ] Scale + chunk + persistent coordinate `Planet/Chunk` `claimRegion` `Vec3` persist — log out `Hangar-A` returns `Hangar-A`, 2000 km same planet, shareable coordinate
* [ ] Time & compass Newtonian `24h + lunar Kepler + G,σ` `north night west day`
* [ ] Aerospace seamless `ORBIT→HANGAR` `GateLink` without loading — hangar on empty land
* [ ] Community facilities `10` types `StationEntity` persistent
* [ ] Character limited to facilities `FPS 5.5`
* [ ] Strategic geography from `heightmap`
* [ ] Night emissive + discovery `Radar` + `Unknown`
* [ ] Empty by default, shaped by players

> `09` Part A Fase 6-7 + Part B 8-12 remain next after `10` — `10` is now final aerospace depth, not SimCity.

---

# 10.X — Cinematic Environmental Interaction Layer

> Status: **PLAN — FINAL (Extension of 10).** Visual authority boundary — effects derived from `EnvironmentalContext`, never becomes gameplay authority. Parent: Planetary Runtime (§3 reuse).

## 10.X.1 Purpose — Coherent Visual System

`AUTHORITATIVE PLANETARY STATE → ENVIRONMENT CONTRACTS → EFFECT RESOLUTION LAYER → (ATMOSPHERE|WEATHER|VESSEL) → WORLD RESPONSE → (TERRAIN|OCEAN|VEGETATION) → FACILITY → CINEMATIC OUTPUT`

Extends `10` across atmosphere, clouds, sunlight, volumetrics, wind, rain, lightning, fog, terrain, ocean, vegetation, particles, vessels, landing zones, day/night, entry, low flight, surface ops — not a pile of isolated VFX.

## 10.X.2 Architectural Boundary

`STATE → CONTRACT → VISUAL RESOLVER → RENDERER` — never `PARTICLE → GAMEPLAY STATE`. Changing quality must not affect physics/health/damage/collision/weather/vessel/facility/planetary/simulation (see `10` §3 `physics.ts:12`).

## 10.X.3 EnvironmentalContext (single source)

`EnvironmentalContext { planetId, planetSeed, simulationTick, worldTime, timeOfDay, sunDirection, sunElevation, sunIntensity, moonState, atmosphereState, temperature, humidity, pressure, visibility, weatherState, windState, cloudState, precipitationState, terrainState, oceanState, localSurfaceState, vesselState, facilityState, localEffectBudget }`

## 10.X.4 Global Wind Field

`WIND FIELD → clouds|rain|fog|dust|smoke|leaves|grass|trees|debris|vessel` — `WindState { direction, speed, gustStrength, turbulence, verticalComponent, altitudeGradient, localVariation }` — smooth transitions, shared visibility.

## 10.X.5–10.X.9 Sun, Cloud–Sun, Cloud Shadows, God Rays, Scattering

Sun `direction/elevation/intensity/color/transmission/timeOfDay` drives terrain/ocean/vegetation/clouds/atmosphere/facilities/vessels. Clouds self-shadow, edge-lit, sunrise/sunset bright. `SUN → CLOUD → MOVING SHADOW → SURFACE` (forest darkens under cloud). **God Rays mandatory** `GodRayContext { sunDirection/elevation/intensity, atmosphericDensity, fogDensity, cloudDensity/coverage, terrain/vegetation occlusion, weather, visibility, cameraPosition }` through mountain gaps/valleys/canopy/cloud gaps — coupled, not static overlay.

Atmospheric scattering `SPACE → ORBIT → ATMOSPHERE → LOW → SURFACE` — limb, haze, cloud layer, no map switch.

## 10.X.10–10.X.12 Volumetric Clouds, Intersection, Weather Stack

Clouds `coverage/density/altitude/thickness/wind/turbulence/weather/sun/shadow/scattering/gaps` — quality scalable ground→orbit. `CLEAR → CLOUD EDGE → LIGHT FOG → INTERIOR → EXIT` continuous. `CLEAR → OVERCAST (cloud+shadow) → RAIN (cloud+rain+wet+puddles+fog) → STORM (+wind+lightning+darkening)` coordinated.

## 10.X.13–10.X.20 Rain, Lightning

`RainState { intensity, direction, wind, droplet density, visibility, precipitation type, storm intensity }` → slant, splash, wet, puddles, runoff, ocean ripples. `LightningEvent { eventId, timestamp, position, direction, intensity, duration, cloudResponse, environmentResponse } → cloud flash + sky/terrain/ocean/facility illumination + reflection` (bolt is only one part). `DARK STORM → ⚡ FLASH → MOUNTAIN REVEALED → DARK`.

## 10.X.21–10.X.26 Fog, Vegetation, Low-Altitude Vessel

Fog `temperature/humidity/weather/altitude/terrain/wind/visibility/timeOfDay` → height/distance/valley/entry haze + god-ray feed. Vegetation wind `grass→small→bush→branch→tree` gust/turbulence phased, rain wetness. `ORBIT → HIGH → MEDIUM (cloud/shadow/haze) → LOW (vegetation/dust/wake) → GROUND` — `VESSEL → LOCAL AIR → VEGETATION` visual only.

## 10.X.27–10.X.29 Dust, Landing, Exhaust

**Landing dust mandatory phases:** `Approach (small particles) → Hover (radial dust) → Touchdown (burst → cloud → wind advection) → Settlement`. `Exhaust → dust/heat/particles → column → wind dispersion` on takeoff. `WindState` decides direction.

## 10.X.30–10.X.37 Ocean, Terrain, Snow, Heat

`OceanState { wave direction/amplitude/frequency, wind relationship, roughness, depth, reflection, foam, disturbance }` + `SUN/OCEAN specular` + `VESSEL → spray/wake/foam`. Terrain wet `darkening/puddles/runoff/reflection` gradual `dry→wet`. Snow/ice where `g`/`temp` allow, dust storms `WIND → particles → haze`, heat haze visual only.

## 10.X.38–10.X.45 Entry, Orbit Weather, Night, Facility Response, Particles, Event Chain

Entry `SPACE → EDGE → UPPER → DENSE → CLOUDS → LOW` (glow, haze, sky transition). Orbit sees storm fronts/gaps/night lights. Night `moon/stars/emissive` + facility nav lights. `FACILITY → rain(wet/puddle) | wind(particles) | fog(visibility) | lightning(flash) | night(emissive)` — visual only. Particles `rain/dust/fog/leaves/spray/snow/ash/steam` derive from `wind+gravity+turbulence+vessel`. Event chain `STORM → cloud density → sunlight reduction → shadow → rain → wet → puddles → reflection → lightning → flash → ocean/facility` coherent.

## 10.X.46–10.X.51 Sunrise/Sunset, Camera, Reflections, Occlusion, Local Volumes

Sunrise `DARK → HORIZON GLOW → SCATTERING → RIM LIGHT → CLOUD → GOD RAYS → SURFACE`; sunset long shadows, cloud color, god rays. Camera `rain/lightning/turbulence/landing` subtle, never physics. Reflections `sun/cloud/rain/wet/ocean/facility/lightning`. Occlusion `terrain/mountain/building/tree/cloud/fog` for god rays/shadows. **Local effect volumes** around player/landing/facility (`rain/vegetation/dust/wake/fog/god rays/particles`), distant = low cost.

## 10.X.52–10.X.55 Quality, Budget, Determinism, Persistence

`FAR (scattering/coverage) → MEDIUM (rain/fog/shadow) → NEAR (dust/spray) → CINEMATIC (volumetrics/high-res god rays)`, graceful degrade. Budget `PLAYER PROXIMITY → VISUAL IMPORTANCE → EFFECT COST` (expensive near player/landing/camera). Determinism `planetSeed/weatherSeed/simulationTick/chunkKey/position` — visual subordinate to authority. Persistent: weather/facility/terrain/vessel/events — transient: particles/god rays/fog/splash/flash (regenerated after handoff/reconnect).

## 10.X.56–10.X.59 Seamless + Composition + Non-Goals + Contract

`SPACE (star field/limb/glow) → ORBIT (cloud systems/shadows/night lights) → ATMOSPHERE (scattering/haze/clouds/fog/god rays) → LOW FLIGHT (vegetation/ocean/wind) → SURFACE (rain/dust/puddles) → LANDING (exhaust/dust) → FACILITY (weather/wetness/lighting)` — no discontinuity. Composition targets: mountain sunrise, forest flight, ocean storm, desert landing, night facility, storm night landing. **Non-goals:** second physics/weather/terrain/vessel/facility, pile of scripts. Contract `PLANETARY RUNTIME → (PLANET|WEATHER|TIME) → ENVIRONMENT CONTEXT → (ATMOSPHERE|SURFACE|VESSEL → CLOUDS/FOG/GOD RAYS | TERRAIN/OCEAN/VEGETATION | EXHAUST/WAKE/DUST) → FACILITY RESPONSE → CINEMATIC FRAME` — *same state propagates consistently*.

## 10.X Checklist (implementation — like other blueprints)

> Each row = PR (or iris), no auto-merge. Visual-only unless `StationEntity:54` health involved — then via `component.ts:10` + `combat.ts:39`/`collision.ts:92` + `persistence.ts:120` (audit trail: authority vs visual).

- [ ] `EnvironmentalContext` + `WindState` contracts (`EnvironmentalContext.ts`, `WindState.ts` — derived from `planetSeed/simulationTick/worldTime/sunDirection`)
- [ ] Sun / day-night lighting (`sunDirection/elevation/intensity` → terrain/ocean/vegetation/clouds)
- [ ] Dynamic cloud–sun + cloud shadows (`CLOUD → MOVING SHADOW → SURFACE`)
- [ ] God rays volumetric (`GodRayContext` — mountain/forest/cloud-gap shafts, not overlay)
- [ ] Atmospheric scattering `SPACE → SURFACE` + volumetric clouds (`coverage/density/altitude/thickness/wind`) + cloud intersection (`CLEAR → EDGE → INTERIOR`)
- [ ] Weather stack `CLEAR/OVERCAST/RAIN/STORM` coordinated
- [ ] Rain + rain–surface/ocean (`wet/puddles/runoff/reflection`, `micro-ripples`)
- [ ] Lightning event chain (`LightningEvent` → cloud flash → terrain/ocean/facility + reflection)
- [ ] Fog (+ fog–sun god-ray feed) + vegetation wind/rain (`grass→tree` phased)
- [ ] Low-altitude vessel → vegetation/dust + landing dust phases + exhaust–ground
- [ ] Ocean system (`OceanState` + vessel spray/wake + sun reflection)
- [ ] Terrain wet/snow/heat + dust storms
- [ ] Entry effects + orbit weather visibility + night emissive
- [ ] Facility–weather (wet/wind/fog/lightning/night) + landing pad cinematic + damage visualization (smoke/debris via authority)
- [ ] Particles derived (`wind+gravity+turbulence`) + environmental event chain
- [ ] Sunrise/sunset cinematic + camera response (exposure/visibility/touchdown) + reflections + occlusion
- [ ] Local effect volumes + quality `FAR→CINEMATIC` + budget `proximity→importance→cost` + determinism seeding + persistence boundary + seamless `SPACE→FACILITY` composition

> **Dependency:** `10` substrate (`terrain/ocean/atmosphere` visual-only) lands first; `10.X` rides on top. `09` Part B 9-12 land before `10.X` needs facilities to illuminate. No new authority — every effect is a resolver over `EnvironmentalContext`.

---

## 14. File Mapping — Where Code Goes (No Guessing, 1 Contract + 1 Folder)

> Biar pas code gak ngarang: `BLUEPRINT 10` numpang ke file yang udah ada, `BLUEPRINT 10.X` cuma tambah 1 kontrak. Hujan gak 1 planet — per chunk, deterministik dari `planetSeed+tick`.

### BLUEPRINT 10 (substrate) → 2 tempat

**1. Server `packages/gameserver/` — otoritas & persistence (reuse, bukan baru):**

- `environs.ts` (udah ada, `SystemBodies` Kepler) → tambah `planetaryEnvirons.ts` — `heightmap` seed, chunk `planetId:chunkX:chunkZ` via `claimRegion` (`world.ts:41` + `relay/registry.ts:33` udah ada). Chunk cuma di-tick kalau ada pemain/facility; `persistence.ts:120` simpan semua.
- `physics.ts:12` (`G, KE`) + `thermics.ts:34` (`1/r²`) → reuse buat `gravity` per planet (Earth 9.81 vs Mars 3.71), `collision.ts:92` `KE=½mv²` buat crash.
- `types.ts:18 Vec3` + `world.ts:41 Map` + `persistence.ts:120` → koordinat persisten `Vec3` udah ada, tinggal `planetId` di `regionId` (`log out Hangar-A → Hangar-A`, 2000 km same planet).
- `cosmicEvent.ts` (udah ada, anomali acak) → **cuaca/anomali numpang di sini**: `weatherSeed = mulberry32(planetSeed + tick)` → `rain/wind/fog` lokal per chunk, bukan global. `Anomali = cosmicEvent` yang sama, visualnya beda. Gak bikin file gede baru.

**File baru (1-2 aja):** `packages/gameserver/planetary/environment.ts` (`EnvironmentalContext` + `WindState`) — kontrak yang dibaca semua sistem. Gak bikin simulasi baru.

**2. Client `apps/game/src/renderer/scene3d/` — visual-only (gak masuk WorldRegion):**

- `scene3d/planets.ts` (udah ada, `buildPlanetSystem` + `makeCloudTexture`) → tambah `scene3d/planetary/` folder:
  ```
  scene3d/planetary/
  ├── terrain.ts    (heightmap LOD 16-64, vertexColors, continental→mountain→biome→river)
  ├── ocean.ts      (Gerstner g=9.81, 71% coverage, depth dari heightmap)
  ├── atmosphere.ts (Sphere 1.018 + clouds 512 per-kind, depthWrite:false)
  ├── weather.ts    (rain/wind/fog dari EnvironmentalContext — per chunk)
  ├── chunks.ts     (streaming LOD, cull jauh, claimRegion)
  ├── facilities.ts (spawn di empty land — hutan/laut tetep natural)
  └── surface.ts    (lerp SPACE→ORBIT→ATMOSPHERE→SURFACE tanpa loading)
  ```
  Semua `child sphere 1.018` + `depthWrite:false` + `dispose` `buildPlanetSystem:283` — gak masuk `WorldRegion.entities` / `EnvironsState.bodies` / `RegionSnapshot`, gak nambah `O(V*B)` `simulation.ts:121`. Hujan di Valley A, Valley B cerah — `weatherState` per chunk.

### BLUEPRINT 10.X (cinematic) → 1 kontrak + numpang

- `EnvironmentalContext.ts` + `WindState.ts` (di `planetary/environment.ts` tadi) — **satu angin dilihat awan+hujan+kabut+daun bareng** (10.X §4). Gak ada `rain` punya angin sendiri.
- Efek lain (`god rays`, `landing dust 4 fase`, `puddles`, `lightning flash`) **gak bikin file otoritas baru** — cuma `visual resolver` baca `EnvironmentalContext → THREE`. `localEffectBudget` per chunk → habitat A hujan deres, B kering.

**Jawab singkat:** Yang baru = 1 kontrak (`EnvironmentalContext`) + 1 folder `planetary/` 7 file visual. Sisanya **numpang** ke file yang udah ada. `weatherSeed per chunk + WindState localVariation` → anomali gak ketebak tapi deterministik `planetSeed+tick`. Pondasi `WorldRegion Map + Vec3 + RecoveryManager` udah beton → langit tinggal tancap.

---

## 15. Addendum — Gaps Closed (Continuous Event & Shoreline) — PLAN FINAL

> Temuan 8 celah setelah review `APA efek ada` vs `GIMANA efek ketemu sepanjang waktu` — ditutup sebagai addendum, bukan arsitektur baru (semua cuma resolver di atas `EnvironmentalContext`, visual-only).

### G1 — Continuous Environmental Event (Priority 1 — wajib)

Bukan `RAIN=true/false` → langsung `CLEAR`. Tapi state machine visual:

`CLEAR (☀️) → PRE-STORM (awan tebal, shadow gerak, angin naik, laut berubah) → STORM (hujan, visibility turun, lightning, spray) → LANDING DURING STORM (pad spray, wet reflection, mist) → POST-STORM (awan pecah, matahari balik, tapi GENANGAN + DAUN BASAH + MIST MASIH ADA) → RECOVERY → NORMAL`

Implementasi: `EnvironmentalEvent { eventId, phase: "clear"|"pre"|"storm"|"landing"|"post"|"recovery", startedAt, weatherState, windState, cloudState }` derived dari `EnvironmentalContext` — visual only, gak ganti authority.

### G2 — Weather Accumulation → Recovery (gabung G1)

`RAIN → WET → DRAINING → DRYING → NORMAL` — `puddle` surut, `runoff` ke titik rendah, `vegetation` tetap basah/reflektif beberapa menit setelah hujan berhenti. Planet persistent jadi terasa: “tadi di sini badai”.

### G3 — Coastal Transition (Priority 2)

Bukan `TERRAIN | garis air | OCEAN`. Tapi zona:

`LAND (dry) → WET SHORE (wet sand/rock, foam, spray) → SHALLOW WATER (≈≈≈) → OPEN OCEAN (wave)`

Storm → `coastal spray↑, foam, wave breaking, shoreline mist, wake`. Checklist: `terrain wet → coastal foam/spray → shallow → ocean wave` gradual.

### G4 — Hydrological Continuity

`MOUNTAIN (snow/rain) → STREAM → RIVER (flow direction, foam, wet banks) → LAKE → COAST → OCEAN` — river dari `heightmap` procedural, visual: `flow direction, waterfalls, foam, wet banks, shallow/deep, river→ocean meeting, rain-fed runoff, mist near waterfall`. Tanpa simulasi hidrologi berat.

### G5 — Terrain Visual Memory (Future — decal only)

`scorch mark, dust residue, disturbed vegetation, debris, snow displacement` — `decal` per `chunkKey` persist via `persistence.ts` (bukan voxel Minecraft). “Pernah landing di sini” — taruh sebagai `FUTURE` biar gak scope creep 10.X.

### G6 — Atmospheric Continuity (Optical)

`Orbit (limb) → High (cloud) → Low (haze) → Surface (fog/rain)` — horizon `haze` + `valley fog` + `mountain contrast` berubah kontinu, bukan trigger `entered atmosphere`.

### G7 — Terrain + Sun Moving Shadows

Sunrise di balik mountain: `valley gelap → shadow line gerak melintasi valley/forest/ocean/facility/pad` — bukan global directional doang. `sunElevation + terrain heightmap → shadow map` gradual.

### Checklist Gaps (PR — no auto-merge)

- [ ] `EnvironmentalEvent` state machine `clear→pre→storm→landing→post→recovery` + `WET→DRAINING→DRYING` (visual timers, gak ganti weather authority)
- [ ] Coastal zone `WET SHORE → SHALLOW → OPEN OCEAN` + foam/spray/shoreline mist (terrain/ocean meet)
- [ ] Hydrological `river flow + foam + wet banks + river→ocean` (dari heightmap)
- [ ] `Terrain Visual Memory` decal per chunk (FUTURE — persist scorch/dust)
- [ ] Atmospheric optical `haze→valley fog→mountain contrast` + moving terrain shadows

> **Catatan file:** G1-G2 di `planetary/weather.ts` + `EnvironmentalContext`; G3-G4 di `planetary/terrain.ts` + `ocean.ts`; G5 di `planetary/surface.ts` decal; G6-G7 di `planetary/atmosphere.ts`. Semua visual resolver, no new authority.

---

## 16. Emergency Landing — ADRIFT → FALLING → CRASHED (PLAN FINAL)

> Kapal habis perang gak langsung `respawn`. Rusak → terombang-ambing → jatuh kayak film → mendarat darurat → butuh `Repair = commit` biar hidup lagi. Sinematik, persistent, dan numpang di pondasi yang udah ada.

### State Machine (visual + authority tipis)

```
BATTLE (SPACE, health 100→12%)
  ↓ engine 0% + reactor bocor (combat.ts:39 DAMAGE_CEILING=12)
ADRIFT (terombang-ambing, velocity drift 8→0, emissive red pulse, HUD ENGINE 0%)
  ↓ gravitasi planet narik (physics.ts:12 G + thermics.ts:34 1/r² beneran, bukan animasi)
FALLING (atmosphere entry → heat haze + cloud intersection + exhaust mati)
  ↓ raycast terrain (planetary/terrain.ts heightmap) + KE=½mv² (collision.ts:92)
EMERGENCY LANDING (empty land? → survive, hutan/laut? → crash)
  ↓
CRASHED (VesselEntity grounded, health 5%, velocity 0, gak bisa takeoff, smoke/debris)
  ↓ Repair = commit (benerin code di repo → buildVesselModel → integrity balik → launch)
```

- **ADRIFT:** `VesselEntity` `health < 10%` → `state="adrift"` + `velocity` drift pelan + `cooldowns` lock + `HUD ENGINE 0%` + `sfxDebris` pelan. Pemain lain lihat `◈ VSL GSF-xxxx 847 km — ADRIFT` (via `world.ts:83 entitiesWithin` + `directory`). Gak bisa thrust — server `validator.ts` reject `move` kalau `health < 10%`.
- **FALLING:** Gravitasi `physics.ts:12` narik ke planet terdekat (bukan jatuh meteor batu, tapi `pitch 70° + velocity 120 m/s + heat haze + cloud gap god rays` kayak film `Interstellar`). `simulation.ts:238 p+=v*dt + drag 0.02` + `clampSpeed` biar drift natural. Visual: `atmospheric entry` (10.X §38) + `cloud intersection` (10.X §11).
- **EMERGENCY LANDING:** `GateLink:34 spaceport 800m` gak kepake — ini manual `raycast terrain` cari `empty land` (planetary `facilities.ts` rule: hutan/laut tetep natural). `Landing dust 4 fase` (10.X §28) `Approach→Hover→Touchdown burst→Settlement + wind advection`. Kalau miring/cepat → `KE crash → wreckage` (`persistence.ts:120` + `04`).
- **CRASHED:** `VesselEntity` `position = terrain height`, `health 5%`, `velocity 0`, `state="crashed"` persist via `RegionSnapshot` + `persistence.ts`. Visual: `smoke/debris + emissive red` (10.X §43). Gak bisa `launch` sampai `integrity` balik.

### Kenapa Gak Butuh File Baru Gede

Numpang semua:

- Damage → `combat.ts:39` + `collision.ts:92` + `thermics.ts:34`
- Jatuh → `physics.ts:12 G + environs.ts:49 Kepler` + `simulation.ts:238`
- Terrain → `planetary/terrain.ts` + `chunks.ts` `planetId:chunkX:chunkZ`
- Visual → `10.X` `atmosphere.ts` + `weather.ts` + `planetary/surface.ts`
- Persist → `persistence.ts:120 RecoveryManager` (restart ≠ reset V6)

**File baru (1 aja):** `packages/gameserver/vesselState.ts` (`VesselState { health, state: "nominal"|"adrift"|"falling"|"crashed" }`) — tipis, cuma enum + transisi, otoritas tetep `world.ts` + `validator.ts`.

### Checklist (PR — no auto-merge)

- [ ] `VesselState` + transisi `adrift→falling→crashed` (server, health <10% → adrift, gravitasi → falling, raycast → crashed)
- [ ] `ADRIFT` drift + HUD `ENGINE 0%` + validator reject thrust
- [ ] `FALLING` heat haze + cloud intersection + pitch sinematik (bukan meteor)
- [ ] `EMERGENCY LANDING` raycast `empty land` + dust 4 fase + KE crash check
- [ ] `CRASHED` persist + smoke/debris + `Repair=commit` → launch lagi
- [ ] Visual only: `WIND FIELD` bawa `dust` settlement, `EnvironmentalContext` bawa `falling` state

> **Catatan:** Bukan `respawn` 3 detik arcade. Ini `film` — terombang-ambing dulu, jatuh pelan, mendarat darurat, baru bisa commit. Planet jadi kuburan + bengkel.

> **Urutan:** `09` Part B 9-12 → `10` substrate → `10.X` cinematic + `15` gaps → `16` emergency landing (numpang semua). Gak lompat.

---

## 17. Implementation Phases — Urutan Eksekusi (KAYAK 09 — TIAP FASE = PR, NO AUTO-MERGE)

> Biar gak lupa besok habis A-B-C dari mana — kayak `09` ada `Fase 1-12`, `10` juga ada fase. Tiap fase punya file + checklist + dependency. No guessing.

### FASE 10.1 — Substrate Contracts (pondasi dulu)

- [ ] `packages/gameserver/planetary/environment.ts` — `EnvironmentalContext` + `WindState` (planetId, planetSeed, tick, worldTime, sunDirection, weatherState, dll) — 1 kontrak, semua baca ini
- [ ] `Verify:` `npx tsc --noEmit` + `node -e "require('./environment.ts')"` — kontrak kebaca semua sistem

### FASE 10.2 — Planetary Substrate Visual (terrain/ocean/atmosphere)

- [ ] `scene3d/planetary/terrain.ts` — heightmap `continental→mountain→biome→river` LOD 16-64, `vertexColors`
- [ ] `scene3d/planetary/ocean.ts` — Gerstner `g=9.81`, 71%, depth dari heightmap
- [ ] `scene3d/planetary/atmosphere.ts` — `Sphere 1.018` + clouds `512` per-kind, `depthWrite:false`
- [ ] `Verify:` `build-game.mjs` OK, `scene.environment` PMREM tetap

### FASE 10.3 — Scale & Chunk + Persistent Coordinate

- [ ] `scene3d/planetary/chunks.ts` — streaming LOD, cull jauh, `planetId:chunkX:chunkZ` via `claimRegion` (`world.ts:41` + `relay/registry.ts:33`)
- [ ] `packages/gameserver/planetaryEnvirons.ts` — chunk tick hanya kalau ada pemain/facility, persist `persistence.ts:120`
- [ ] `types.ts:18 Vec3` — `log out Hangar-A → Hangar-A`, 2000 km same planet, shareable `gate.ts:34`
- [ ] `Verify:` 2 player 2000 km same planet, relog tetap di tempat

### FASE 10.4 — Time & Aerospace Seamless

- [ ] `scene3d/planetary/surface.ts` — `lerp SPACE→ORBIT→ATMOSPHERE→SURFACE` (bukan teleport), cloud occlusion 2s
- [ ] `environs.ts:49` + `physics.ts:12` — `24h + lunar Kepler + G,σ` → `north night west day`
- [ ] `gate.ts:86` `GateLink spaceport 800m` + `simulation.ts:238 p+=v*dt` — `auto ACK` vs `manual raycast crash KE`
- [ ] `Verify:` SPACE→SURFACE tanpa loading, low flight cari facility

### FASE 10.5 — Facilities + Character Limited

- [ ] `scene3d/planetary/facilities.ts` — 10 facility di `empty land` (`Landing Pad, Hangar...Spaceport`) — `StationEntity:54` health
- [ ] `packages/gameserver/world.ts:41` — `FacilityEntity` spawn di empty land rule
- [ ] `Character` FPS 5.5 m/s limited `hangar/facility` only (`clampSpeed 5.5`, `baseline.ts:16`)
- [ ] `Verify:` build di empty land bisa, hutan/laut tetep natural, facility health `combat.ts:39`

### FASE 10.6 — Geography & Night

- [ ] Strategic geography `mountains→military, plains→spaceport, poles→observatory` dari `heightmap` (mulberry32)
- [ ] Night `emissive #ffd9a0` + `PointLight runway` + `Radar entitiesWithin 50000` + `Unknown`
- [ ] `Verify:` orbit malam liat facility nyala, Radar `Hangar-A 12 km / Unknown 430 km`

### FASE 10.X.1 — Sun + Clouds + God Rays (cinematic core)

- [ ] `WindState` shared → `clouds drift`, `rain slant`, `fog flow`
- [ ] Cloud–sun `illuminated tops/darker bases/self-shadow` + `CLOUD→SHADOW→SURFACE`
- [ ] `GodRayContext` — `mountain gap/valley/canopy/cloud gap` shafts, not overlay, coupled `sun+fog+cloud+terrain+camera`
- [ ] `Verify:` cloud lewat → forest darkens → god ray gerak

### FASE 10.X.2 — Weather Stack + Rain + Lightning

- [ ] `WeatherState CLEAR/OVERCAST/RAIN/STORM` coordinated → `RainState` + `wet/puddles/runoff/reflection` + `ocean ripples`
- [ ] `LightningEvent` → `cloud flash + terrain/ocean/facility illumination + reflection` (bolt cuma 1 part)
- [ ] `Verify:` storm `cloud density → sunlight down → rain → puddles → lightning flash → ocean reflection`

### FASE 10.X.3 — Fog + Vegetation + Dust + Ocean

- [ ] Fog `temperature/humidity/weather` → `height/distance/valley/entry haze` + `fog–sun god-ray feed`
- [ ] Vegetation `grass→tree` wind phased + rain wetness
- [ ] Ocean `OceanState` + `spray/wake/foam` + `sun reflection`
- [ ] `Verify:` wind gust → leaves/grass beda fase, rain → leaf wetness

### FASE 10.X.4 — Local Volumes + Quality + Budget

- [ ] `Local effect volumes` (player/landing/facility) + `quality FAR→CINEMATIC` graceful degrade
- [ ] `Budget proximity→importance→cost` + `determinism planetSeed+tick+chunkKey` + `persistence boundary` (transient vs persistent)
- [ ] `Verify:` jauh = low cost, dekat = cinematic, handoff/reconnect regenerate

### FASE 10.G — Gaps Closed (Continuous Event & Shoreline)

- [ ] `EnvironmentalEvent` `clear→pre→storm→landing→post→recovery` + `WET→DRAINING→DRYING` (G1-G2)
- [ ] Coastal `WET SHORE→SHALLOW→OPEN OCEAN` + foam/spray (G3) + Hydrological `river→ocean` (G4)
- [ ] `Verify:` POST-STORM genangan masih ada, coastal gradual, river ketemu ocean

### FASE 10.E — Emergency Landing (film-like)

- [ ] `vesselState.ts` `adrift→falling→crashed` + `ADRIFT drift` + `FALLING heat` + `LANDING dust 4 fase + KE` + `CRASHED persist`
- [ ] `Verify:` health<10% → adrift → falling pitch film → empty land survive / hutan crash → Repair=commit

### FASE 10.C.1 — Cinematic Contracts (pondasi presentasi)

- [ ] `scene3d/cinematic/CinematicContext.ts` + `CinematicEvent.ts` + `CinematicPhase.ts` — `eventId, eventType, phase TRIGGER→EXIT, priority, exposure`
- [ ] `Verify:` `npx tsc --noEmit` + typecheck, no authority

### FASE 10.C.2 — Event Director

- [ ] `CinematicEventDirector.ts` — `trigger/phase/priority/exit` (CRASH 100 > EMERGENCY 90 > ENTRY 70)
- [ ] `Verify:` multiple events, priority resolve

### FASE 10.C.3 — Atmospheric Flight & Turbulence

- [ ] `AtmosphericFlightResolver.ts` + `TurbulenceResolver.ts` — `wind+density+velocity+altitude → turbulence/motion/camera` `NORMAL→BUILDUP→ACTIVE→DECAY`
- [ ] `Verify:` `SPACE → ATMOSPHERE → LOW FLIGHT` turbulence continuity

### FASE 10.C.4 — Heat Response

- [ ] `HeatResponseResolver.ts` — `entry→heating→peak→cooling` (visual, gak ganti physics)
- [ ] `Verify:` heat visual continuity `COLD→PEAK→NORMAL`

### FASE 10.C.5 — Camera Director (bounded)

- [ ] `CinematicCameraDirector.ts` — `entry/landing/crash/docking` `≤2° pitch/roll, exposure ≤+0.3` additive, never forced cutscene
- [ ] `Verify:` player control intact, camera additive

### FASE 10.C.6 — Audio Context

- [ ] `EnvironmentalAudioResolver.ts` — `wind/rain/thunder/engine/atmosphere` sync dari `EnvironmentalContext`
- [ ] `Verify:` audio sync `wind↑ → rain → thunder delay`

### FASE 10.C.7 — Cockpit Response

- [ ] `CockpitResponseResolver.ts` — `rain/lightning/heat/cloud/turbulence` presentation-only, `HUD motion`
- [ ] `Verify:` cockpit gak ubah physics

### FASE 10.C.8 — Impact / Wreck

- [ ] `ImpactPresentation.ts` — `impact→debris→smoke→dust→settling→wreck` (persistent wreck authority, transient flash presentation)
- [ ] `Verify:` `health 0 → wreck` persist, flash transient

### FASE 10.C.9 — Facility Discovery

- [ ] `FacilityDiscovery.ts` + `AtmosphericReveal.ts` — `distant→reveal→approach→hangar` (no cutscene, `FOG→SILHOUETTE→LIGHT→DETAIL`)
- [ ] `Verify:` orbit night liat `tiny emissive → beacon → runway`

### FASE 10.C.10 — Continuity & Budget

- [ ] `CinematicBudget.ts` — `FAR→MEDIUM→NEAR→CINEMATIC` + `proximity→importance→cost` + `SPACE→FACILITY` continuity
- [ ] `Verify:` `SPACE→ORBIT→ATMOSPHERE→CLOUD→SURFACE→FACILITY` no discontinuity, `handoff/reconnect` regenerate

> **Dependency final:** `09 9-12 → 10.1 → 10.2 → 10.3 → 10.4 → 10.5 → 10.6 → 10.X.1 → 10.X.2 → 10.X.3 → 10.X.4 → 10.G → 10.E → 10.C.1 → 10.C.2 → 10.C.3 → 10.C.4 → 10.C.5 → 10.C.6 → 10.C.7 → 10.C.8 → 10.C.9 → 10.C.10` — gak lompat, tiap fase tau file + verify, no guessing, code 1:1 gampang.
