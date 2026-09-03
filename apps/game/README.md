# ARCLUX GAME — MMO Client (Electron + Three.js) — EVE-Grade Cinematic

> **Living Universe, Not a Dashboard.** Every repository is a vessel. Every vessel flies in a persistent world where physics is law and code is hull. `D-008` server-authoritative — the client never decides, it only renders.

**One command to host a universe:**
```bash
git clone https://github.com/GSF-001/ARCLUX.git && cd ARCLUX && pnpm install
node scripts/build-cli.mjs && node scripts/build-game.mjs
./apps/cli/dist/arclux.mjs serve --region my-region --client ./apps/game/dist/renderer --vessel ~/my-vessel
# → 🌌 http://127.0.0.1:24001/ — open and play
```

---

## Live Universe — What You See Is What the Server Simulates

| Layer | What It Is | File |
|-------|------------|------|
| **Stars** | 6,160 `InstancedMesh` (6,000 white + 160 hot spectral A/B/C) | `scene3d.ts:148` |
| **Nebula** | 9 additive `Sprite` layers, `CanvasTexture` 128² | `scene3d.ts:187` |
| **Suns** | 1-3 binary/trinary, `SphereGeometry(900,64,64)` + corona `Sprite` + `DirectionalLight` 2.2×, Kepler `θ=2π·tick/p+phase` | `scene3d.ts:216` |
| **Planets** | 9 live `SphereGeometry(radius 320-1800, seg 48)` `MeshStandardMaterial` PBR, each with **cloud layer** `Sphere 1.018×` 512² procedural `CanvasTexture` per-kind (gasGiant banded, ocean swirl, ice wispy, desert dust, volcanic ash) + rim glow `Sprite` + ring `RingGeometry` + 0-3 moons Kepler + lunar phase `emissive` | `scene3d.ts:281` `makeCloudTexture()` |
| **Belt / Backdrops** | 6,000 `InstancedMesh` Dodecahedron belt + 6 `MeshBasicMaterial` backdrop planets 18-40km | `scene3d.ts:367` `392` |
| **Events** | 60 `Line` meteors bursty + 2 aurora `Sprite` pulsing | `scene3d.ts:413` |
| **Ark-Librarieschip** | Stadium megastructure — keel/prow/stern/spire + 4 rings (24 habitat + 12 docking + 4 platform + 96 windows per ring via `InstancedMesh`) + 6 spars + 4 weapon mounts + cargo + antennas + shield generators + observatory — all rotating, pulsing, swaying | `scene3d.ts:779` `buildArkLibrary()` |
| **Vessels** | AAA+ studio — fuselage `Box(18,10,52)` + nose `Cone` + canopy `MeshPhysicalMaterial` transmission 0.82 + delta wings `ExtrudeGeometry` + nacelles `Cylinder` + afterburner `Torus` + weapon mounts — `metalness 0.78` reflects `scene.environment` PMREM | `scene3d.ts:468` `buildVessel()` |
| **Explosions** | 5 burst sprites 0.8s + 12 debris `Box` gravity 2s + 30 spark `Line` 0.3s + shield flash 0.2s | `scene3d.ts:476` `spawnExplosion()` |
| **Landing** | Live CCTV background (`scene3d` canvas) + glass `rgba(12,16,32,0.62)` + thin borders + orange accent `tactical` + HUD `Orbitron/JetBrains Mono` — stats poll `net.fetchSnapshot()` every 4s (PLAYERS/REGIONS/FACTIONS/DESTROYED), all clickable | `landing.ts` |
| **Audio** | 5 SFX synthesized (WebAudio, no asset): `sfxExplosion` lowpass sweep, `sfxWeapon` square 800→200, `sfxShieldHit` triangle bandpass, `sfxDebris` 3× bursts, `sfxAmbientHum` saw 38 Hz continuous + engine hum `setSpeed` + music pad | `audio.ts` |

**PPR:** `EffectComposer` + `RenderPass` + `UnrealBloomPass(1.15,0.45,0.65)` + `OutputPass` `ACESFilmicToneMapping` `scene3d.ts:129`, `PMREMGenerator` `scene.environment` every 10 frames `scene3d.ts:858`, `DPR capped 2`, `fpsCap 30-240`.

## Quickstart (International — English)

See [`QUICKSTART-MMO.md`](../../QUICKSTART-MMO.md) for zero-to-play:

```bash
# 1) Create vessel from YOUR repo (not inside ARCLUX)
mkdir ~/my-vessel && cd ~/my-vessel && git init
../ARCLUX/apps/cli/dist/arclux.mjs connect . --name my-vessel --license open

# 2) Self-host
../ARCLUX/apps/cli/dist/arclux.mjs serve --client ../ARCLUX/apps/game/dist/renderer --vessel ~/my-vessel

# 3) Open http://127.0.0.1:24001/ → landing → PLAY NOW → fly
# Login once: playerId saved to localStorage, next time no URL
```

## Controls

`W/S` thrust · `A/D` strafe · `Q/E` vertical · `Shift` boost 2.2× · `Space` brake · `F/J` or `Click` fire (`sfxWeapon`) · Mouse look pointer-lock · `Escape` menu (GRAPHICS/AUDIO/CONTROLS) · `V` camera free/follow/tactical/cinematic.

## Tech — Why It Feels Heavy-Stable Like EVE

* `packages/gameserver` 31 files — `simulation.ts` 10 tick/s fixed `dt 0.1`, `world.ts` authoritative `Map`, `validator.ts` owner/range/license, `combat.ts` `DAMAGE_CEILING=12` per-subsystem, `collision.ts` `KE=½mv²×angle×penetration`, `thermics.ts` `∝1/r²`, `environs.ts` Kepler `r=a(1-e²)/(1+e cosθ)`, `physics.ts` `G, σ, c, AU`
* `packages/relay` registry + `gate.ts` transactional `notifyTarget→ACK` + `bridge.ts` `identity.move`
* `packages/universe` `connect.ts` → `analyzeRepository` → `buildVesselModel` → `server --vessel` auto-spawn (`apps/cli/serve.ts:36`)
* `three@0.185` + `InstancedMesh` everywhere, `CanvasTexture` only (CSP `default-src 'self'`), `disposeGroup` Set dedup

## Architecture

```
ARCLUX (clone once) ──► pnpm install ──► build-cli + build-game
        │
        ├─► arclux connect ~/my-vessel  ──► .arclux/arclux.json (your repo, source of truth)
        │
        └─► arclux serve --client dist/renderer --vessel ~/my-vessel
                │
                └─► packages/gameserver (authoritative, D-008)
                        │
                        └─► apps/game (Electron) ──► landing live CCTV ──► scene3d + net + input + audio
```

**Source of truth for what is built:** `docs/blueprint/progres/MMO-IMPLEMENTATION.md` §2-3 (not this README). New commits (`physics.ts`/`component.ts`) don't need README edits.

## Links

* Blueprints `docs/blueprint/01-spatial-ux.md` §2/§22, `03-combat.md`, `05-vessel-design-dashboard.md`, `09-client-polish.md` (Fase 1-5 done, clouds AAA, pause at 5)
* `QUICKSTART-MMO.md` — English quickstart from zero
* `LICENSE-MMO` (game) + `LICENSE-ENGINE` (Apache 2.0 for `apps/web`, `packages/engine` etc.)
