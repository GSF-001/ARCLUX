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
