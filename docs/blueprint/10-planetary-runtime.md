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
