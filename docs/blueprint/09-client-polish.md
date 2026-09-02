# Blueprint 09 — ARCLUX CLIENT POLISH (Gameplay Immersion)

> Status: **PLAN — belum diimplementasikan.** File ini adalah satu-satunya
> referensi untuk semua fitur polish client game ARCLUX. Update setelah tiap
> fase selesai (beri tanda ✅ pada item yang selesai). JANGAN dihapus.
>
> Branch target: `feat/mmo-blueprint-full` (base `origin/ARCLUX.main`)
> Env: Termux (gak ada `/tmp`, pakai `~`). Package manager: pnpm.
> Build: `node scripts/build-game.mjs`. Tipe check: `npx tsc --noEmit -p apps/game/tsconfig.json`
> ThreatCrush: `grep -rn "innerHTML.*+" apps/game/src/renderer/` (harus 0 match)
>
> ⚠️ JANGAN PERNAH commit: `packages/environment/ArcluxEnvironment.ts` dan file stray `ARCLUX`.

---

## TUJUAN UTAMA

Filosofi: **"GUI yang liat game-nya adalah pemain (engineer ARCLUX) yang
mainkan kapalnya sendiri"** — bukan sekadar dashboard. Semua fitur di bawah
adalah untuk bikin pemain MERASA jadi pilot kapal utama ARCLUX.

Konteks dari pemilik (GSF-001):
- Kapal ARCLUX (Ark-Librarieschip) adalah kapal ENGINEER yang dipiloti
  langsung — BUKAN background object.
- "Stadion luar angkasa" = ring sections yang mengelilingi hull, tampak
  seperti arena/stadion raksasa saat dilihat dari luar.
- Pemilik adalah pembuat game sekaligus pemain — kapal harus ada, detail,
  beranimasi, dan bisa dirasakan.
- Musik: user sendiri yang upload file (gak mau tersangkut pihak ketiga /
  lisensi). Support MP3/OGG/WAV/FLAC.
- Efek suara (api, ledakan, pesawat) harus ada — disintesis via WebAudio,
  gak perlu file eksternal.

---

## FILE YANG DIUBAH

| File | Perkiraan Baris Tambah | Isi |
|------|------------------------|-----|
| `apps/game/src/renderer/scene3d.ts` | +675 | Part A: Env map, model kapal player, Ark detail, explosions |
| `apps/game/src/renderer/interior.ts` | +480 | **Part B NEW:** FPS interior walkable, promenade, hangar bay, corridor (lazy-load pas docking) |
| `apps/game/src/renderer/renderer.ts` | +60 | Part B: switch exterior↔interior, DockingState, wiring CharacterEntity |
| `apps/game/src/renderer/input.ts` | +80 | Part B: mode FPS_INTERIOR (WASD+Shift+pointer-lock), collision Box3 |
| `apps/game/src/renderer/audio.ts` | +250 | 5 SFX + custom music playback (Part A) + interior ambient/hangar sfx |
| `apps/game/src/renderer/menu.ts` | +200 | Part A upload musik + Part B bazaar/character/marketplace overlay |
| `apps/game/src/renderer/hud.ts` | +40 | Part A polish + Part B interior HUD (deck, slot, lapak) |

---

# FASE 1 — ENVIRONMENT MAP REFLECTION (PMREMGenerator)

## Status: ✅ Selesai (commit implementasi Fase 1 — scene3d.ts pmrem)

## Tujuan
Ships jadi memantulkan cahaya dari celestial bodies (suns, planets, nebula)
secara realistis. Material sudah `MeshStandardMaterial` (PBR), tinggal
kasi environment map.

## Approach
- **Option B (FULL):** `THREE.PMREMGenerator` generate cubemap dari scene,
  di-set ke `scene.environment` biar semua `MeshStandardMaterial` otomatis
  reflect tiap frame.
- Regenerate tiap 10 frame (PMREM mahal, jangan tiap frame).

## Detail implementasi
```typescript
// Di init, setelah renderer dibuat:
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangular();          // compile shader dulu
let envMap: THREE.Texture | null = null;

// Di dalam frame loop:
if (frameCount % 10 === 0) {
  envMap = pmrem.fromScene(scene, 0, 0.1, 100).texture;
  scene.environment = envMap;            // auto-apply ke semua material
}
```

## Acceptance
- [x] Ship hull memantulkan warna sun/planet saat berputar (`scene.environment` PMREM)
- [x] Metalness 0.7 + envMap tetap performa (regenerate tiap 10 frame, dispose target lama)
- [x] Gak ngerusak bloom composer (`EffectComposer` tetap)

---

# FASE 2 — MODEL KAPAL PEMAIN UPGRADE

## Status: ⬜ Belum mulai

## Tujuan
Kapal player yang sekarang (ConeGeometry fighter sederhana) diganti model
detail: hull, cockpit transparan, engine nacelles, weapon mounts.

## Komponen buildVessel() baru
- **Main hull:** tapered box/cylinder (kurang lebih 50x12x80)
- **Cockpit canopy:** `SphereGeometry` di depan-atas, `MeshPhysicalMaterial`
  (transmission 0.8), transparan
- **Wings:** swept-back delta shape
- **Engine nacelles:** 2 cylinder di belakang + glow sprite
- **Weapon mounts:** 2 box kecil di wing tips

## Material
- Hull: metalness 0.75, roughness 0.3 (shiny, pantul env map)
- Cockpit: metalness 0.1, roughness 0.1, transmission 0.8
- Engines: emissive + cylinder
- Weapons: metalness 0.8, roughness 0.2

## Acceptance
- [ ] Kapal player terlihat detail dari dekat
- [ ] Cockpit transparan (kaca)
- [ ] Engine ada glow
- [ ] Refleksi (Fase 1) kelihatan di hull

---

# FASE 3 — ARK-LIBRARIESCHIP DETAIL (Kapal Utama ARCLUX)

## Status: ⬜ Belum mulai

## PENTING (dari pemilik)
Ark-Librarieschip **BUKAN background**. Ini **kapal utama ARCLUX, kapal
engineer, yang dipiloti langsung**. "Stadion luar angkasa" = ring sections
yang mengelilingi hull, terlihat seperti stadium/arena raksasa dari luar.

## Saat ini (yang ada di buildArkLibrary → scene3d.ts:760-807)
- Keel: `CylinderGeometry(320, 380, 4200, 48)` — spine utama
- Prow: `ConeGeometry(200, 1100, 40)` — depan
- Stern: `SphereGeometry(360, 40, 40)` — belakang
- Spire: `CylinderGeometry(90, 220, 1100, 36)` + `ConeGeometry(120, 260)` cap
- 4 Rings: `TorusGeometry(640-760, 26, 16, 72)` + glow sprite
- 6 Spars: `BoxGeometry(140, 30, 1200)`

## Komponen detail yang HARUS ditambah

### 1. KEEL (hull spine) — detail panel
- 12 hull panel lines (box tipis, raised sedikit, emissive tech)
- 8 window strips (rectangles emissive kecil di sepanjang hull)

### 2. PROW (depan) + COCKPIT DOME
- Cockpit dome: `SphereGeometry(40, 24, 24)` depan-atas, `MeshPhysicalMaterial`
  (transmission 0.8)
- Sensor array: 3 cylinder kecil di depan cone

### 3. STERN (belakang) + ENGINE HOUSING
- Engine housing: 4 x `CylinderGeometry(60, 80, 200, 24)`
- Engine glow: 4 sprite (additive, orange-red `#ff6a00`)
- Exhaust ports: 8 cone kecil di permukaan sphere

### 4. SPIRE (command tower) + OBSERVATION
- Observation deck: `TorusGeometry(160, 20, 12, 36)` di tengah spire
- Antenna array: 4 cylinder tipis (height 200-400)
- Comms dish: `SphereGeometry(30, 16, 16)` di salah satu antenna
- Light strip: cylinder tipis sepanjang spire, emissive amber

### 5. RINGS (4x — "STADIUM MEGASTRUCTURE") + DETAIL (FULL)

> **KONSEP (dari pemilik — prompt desain):**
> "A colossal engineer flagship... gigantic orbital stadium-shaped megastructure.
> Four massive rotating industrial rings surround a central armored spine hull.
> The rings contain docking bays, habitat modules, maintenance platforms and
> glowing windows — NOT a sports arena. Heavy sci-fi engineering, EVE Online
> scale, Star Citizen capital ship, realistic hard-surface spacecraft."

Jadi ring = **megastructure stadion orbital** (EVE/Star Citizen scale),
mengelilingi spine hull, berisi fungsi industri (bukan arena olahraga).

Tiap ring (4x total), **semua pakai `InstancedMesh` biar performa**:
- **Main torus** (existing `TorusGeometry(640-760, 26, 16, 72)`)
- **8 support struts** (box tipis connecting ring ke hull)
- **Ring glow sprite** existing + **1 ambient light per ring**

Plus **≥FULL detail interior** (baru — ini yang bikin ring jadi megastructure):

#### 5a. HABITAT MODULES (baru, **24/ring**)
- `BoxGeometry(30, 18, 26)` kecil, menempel di **permukaan dalam** ring
- 24 instance per ring, tersebar merata (setiap 15°)
- Material: steel + sedikit emissive amber (jalur hidup)
- Pakai `InstancedMesh` (24×4 ring = 96 mesh, tapi 1 draw call)

#### 5b. DOCKING BAY PORTS (baru, **12/ring**)
- Opening gelap di tepi luar ring (arch-shaped, `TorusGeometry` kecil atau
  `BoxGeometry` hollow dengan interior hitam)
- 12 instance per ring
- Amber frame + marker light di tiap port
- Bay door: 2 panel box tipis yang bisa "buka" (animasi scale saat docking)

#### 5c. MAINTENANCE PLATFORMS (baru, **4/ring**)
- Flat deck (`BoxGeometry(80, 3, 40)`) menempel horizontal di beberapa ring
- "Walkable" walkway, sedikit protruding dari permukaan
- 4 platform per ring, sudut 90° terpisah
- Detail: guard rail (2 box tipis) + hazard stripe (emissive amber strip)

#### 5d. GLOWING WINDOWS (baru, banyak — pakai instancing)
- Rectangle kecil emissive warm (`#ffd9a0`) tersebar di seluruh permukaan ring
- **96 windows per ring** via `InstancedMesh` (single draw call)
- Ditambah window clusters di habitat modules (tiap module 2-3 jendela)
- Windows jadi sumber cahaya "life" di ring — terlihat dari jauh

#### 5e. ANIMASI ROTASI (4 ring, arah beda)
  - Ring 1: rotation.z += 0.001/frame (clockwise)
  - Ring 2: rotation.z -= 0.0015/frame (counter)
  - Ring 3: rotation.z += 0.002/frame (clockwise)
  - Ring 4: rotation.z -= 0.0008/frame (counter)

#### WINDOW/INSTANCE MATERIAL NOTES
- Semua `InstancedMesh` di-animate via `instanceMatrix.setMatrixAt(i, m)`,
  `instanceMatrix.needsUpdate = true` — di-update bersamaan rotasi ring.
- Material windows pakai emissive (tidak butuh light), jadi murah.
- Windows warm (`#ffd9a0`) vs habitat amber (`#ffb36b`) vs hull tech cyan
  (`#52c8ff`) — contrast warna biar ring terlihat hidup dari jauh.

#### Ring section total per ring: ~156 instance + torus + struts + glow
- 24 habitat + 12 docking + 4 platform + 96 windows + 8 struts = 144 instance
- Semua dalam 1 `InstancedMesh` class / beberapa group — minim draw call.
- Implementasi: helper `buildRingSection(radius, opts)` dipanggil 4x (bedah
  radius 640-760 + kecepatan rotasi). ~120 baris.

### 6. SPARS (6x) + DETAIL
- Light strips: cylinder tipis di setiap spar (emissive)
- Cross-bracing: 2 box tipis per spar (X pattern)

### 7. WEAPON MOUNTS (NEW — 4x)
- `BoxGeometry(15, 8, 40)` kiri/kanan hull (2 atas, 2 bawah)
- Material: steelHigh + amber accent
- Barrel: `CylinderGeometry(3, 3, 60, 8)`

### 8. DOCKING BAY (NEW)
- `BoxGeometry(120, 80, 200)` — opening di hull tengah
- Interior gelap + amber frame
- Bay door lines (box tipis di tepi opening)

### 9. CARGO PODS (NEW — 4x)
- `BoxGeometry(50, 40, 80)` — di bawah hull
- Material: steel
- Attachment struts (cylinder tipis connecting ke hull)

### 10. ANTENNA ARRAYS (NEW — 6x)
- `CylinderGeometry(2, 2, 200-400, 6)` — di atas spire + hull
- Material: steelHigh
- Comms dish di 2 antenna

### 11. SHIELD GENERATORS (NEW — 6x)
- `SphereGeometry(15, 12, 12)` — perimeter hull (3 kiri, 3 kanan)
- Material: tech (emissive cyan glow) + glow sprite per generator
- **ANIMASI:** opacity pulse 0.4-0.8, `sin(time * 2 + i)`

### 12. OBSERVATORY DOME (NEW)
- `SphereGeometry(50, 24, 24)` — atas hull tengah
- `MeshPhysicalMaterial` (transmission 0.7, metalness 0.1)
- Rotating internal structure (box kecil di dalam, terlihat via kaca)

## Material reference
| Material | Color | Metalness | Roughness | Emissive | Use |
|----------|-------|-----------|-----------|----------|-----|
| steel | #1a2436 | 0.75 | 0.3 | #0a1424 (0.35) | Hull, keel, spars |
| steelHigh | #2c3a55 | 0.75 | 0.3 | — | Accents, rings, struts |
| amber | #ffb36b | — | — | #ffb36b (1.4) | Weapons, spire cap |
| tech | #52c8ff | — | — | #52c8ff (1.2) | Shield generators |
| cockpit | — | 0.1 | 0.1 | — | MeshPhysicalMaterial, trans 0.8 |
| engineGlow | #ff6a00 | — | — | #ff6a00 (2.0) | Engine nacelle glow |
| windowWarm | #ffd9a0 | — | — | #ffd9a0 (1.8) | Ring glowing windows (warm light) |
| habitatAmber | #ffb36b | — | — | #ffb36b (0.8) | Habitat module accent |

## Animasi keseluruhan
| Komponen | Animasi | Speed |
|----------|---------|-------|
| Ring 1 | rotation.z += | 0.001 |
| Ring 2 | rotation.z -= | 0.0015 |
| Ring 3 | rotation.z += | 0.002 |
| Ring 4 | rotation.z -= | 0.0008 |
| Engine glow | opacity pulse 0.6-1.0 | sin(time*3) |
| Shield generators | opacity pulse 0.4-0.8 | sin(time*2+i) |
| Antenna | subtle sway | sin(time*0.5)*0.02 |

## Integrasi (PENTING)
- Ark position di-set ke **anchor (position player)**, BUKAN `(-32000, -2000, 3000)`
- Camera mode "follow" = player vessel depan, Ark terlihat di belakang (radius 3000)
- `buildArkLibrary()` return: `{ group, rings: Mesh[], engines: Sprite[], shields: Sprite[], ringInstances: { group, habitats: InstancedMesh, windows: InstancedMesh }[] }`
  buat keperluan animasi per-frame (rotasi ring + update instanceMatrix windows).

## Acceptance
- [ ] Ark jadi kapal utama player, bukan background
- [ ] Detail parah (12 komponen): cockpit, engine, weapons, docking, cargo,
      antenna, shield gens, observatory, dll
- [ ] Ring jadi **stadium megastructure**: 24 habitat + 12 docking port +
      4 maintenance platform + 96 glowing windows per ring (via InstancedMesh)
- [ ] Ring berputar (animasi stadium/arena) + windows ikut berputar
- [ ] Tambah ~475 baris di scene3d.ts (naik dari 355 karena ring detail penuh)

---

# FASE 4 — EKSPLOSION VISUAL (Full Particle System)

## Status: ⬜ Belum mulai

## Tujuan
Kapal yang lenyap dari snapshot → ledakan: sprite burst + debris fragments
+ shield flash + sparks.

## Components (ketika vessel dihapus dari scene)
1. **Main Burst** — 5 sprite additive (orange #ff6a00 → red #ff2a00 → dark
   #3a0a00), scale 20→200→0, opacity 1.0→0.0, durasi 0.8s
2. **Debris Fragments** — 12 `BoxGeometry` (2x2x2 s/d 5x5x5), random velocity
   keluar dari pusat, gravity tarik turun, fade + dispose setelah 2s
3. **Sparks** — 30 `Line` (`BufferGeometry` 2 point), random direction,
   high velocity, fade 0.3s
4. **Shield Flash** — 1 sprite putih additive, scale 50→150→0, 0.2s,
   hanya kalau shield > 0

## Trigger
- Dalam `renderRegion()`, deteksi vessel ada di `prev` tapi hilang di `cur`
  → panggil `spawnExplosion(position)`.

## Detail
```typescript
function spawnExplosion(pos: THREE.Vector3) {
  // 5 sprites burst
  // 12 debris meshes
  // 30 spark lines
  // shield flash (jika ada)
}
```

## Acceptance
- [ ] Ledakan terlihat (burst + debris + sparks)
- [ ] Shield flash muncul pas shield kena
- [ ] Setelah 2s semua mesh disposen (gak bocor memory)

---

# FASE 5 — SOUND EFFECTS (SEMUA 5, full)

## Status: ⬜ Belum mulai

## Tujuan
Semua efek suara disintesis via WebAudio (gak perlu file eksternal).
Volume dikontrol `sfxVolume` setting.

## 5 sound effects

### 1. EXPLOSION (ledakan)
- Noise burst + lowpass sweep (2000→100Hz) + exponential decay, 0.8s
```typescript
sfxExplosion() {
  const c = ensure();
  const noise = c.createBufferSource();
  noise.buffer = makeNoiseBuffer(c, 1);
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2000, c.currentTime);
  filter.frequency.exponentialRampToValueAtTime(100, c.currentTime + 0.8);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.5, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.8);
  noise.connect(filter).connect(gain).connect(sfxGain);
  noise.start(); noise.stop(c.currentTime + 0.8);
}
```

### 2. WEAPON FIRE
- Square wave (800→200Hz) + highpass + fast decay, 0.15s
```typescript
sfxWeapon() {
  const c = ensure();
  const osc = c.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(800, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.15);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.3, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
  osc.connect(gain).connect(sfxGain);
  osc.start(); osc.stop(c.currentTime + 0.15);
}
```

### 3. SHIELD HIT
- Triangle wave (440Hz) + bandpass + medium decay, 0.3s
```typescript
sfxShieldHit() {
  const c = ensure();
  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = 440;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 600;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.4, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
  osc.connect(filter).connect(gain).connect(sfxGain);
  osc.start(); osc.stop(c.currentTime + 0.3);
}
```

### 4. AMBIENT SHIP HUM (low rumble, continuous)
- Sawtooth 38Hz + lowpass + gain kecil 0.08, terus jalan
```typescript
sfxAmbientHum() {
  const c = ensure();
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = 38;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 120;
  const gain = c.createGain();
  gain.gain.value = 0.08;
  osc.connect(filter).connect(gain).connect(musicGain);
  osc.start();
  return { osc, gain };
}
```

### 5. DEBRIS/COLLISION
- 3 short noise bursts (0.05s tiap) + random pitch (200-800Hz), 0.2s
```typescript
sfxDebris() {
  const c = ensure();
  for (let i = 0; i < 3; i++) {
    const noise = c.createBufferSource();
    noise.buffer = makeNoiseBuffer(c, 0.1);
    const gain = c.createGain();
    const t = c.currentTime + i * 0.05;
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    noise.connect(gain).connect(sfxGain);
    noise.start(t); noise.stop(t + 0.1);
  }
}
```

## Integrasi (trigger dari mana)
| SFX | Dipanggil saat |
|-----|----------------|
| sfxExplosion | vessel dihapus dari renderRegion (ledakan) |
| sfxWeapon | input attack intent |
| sfxShieldHit | shield damage received |
| sfxAmbientHum | speed > 0, continuous (renderer.ts) |
| sfxDebris | collision event |

## Acceptance
- [ ] Kelima suara ada & berfungsi
- [ ] Volume dikontrol sfxVolume
- [ ] Music volume terpisah (musicGain), sfx volume terpisah (sfxGain)

---

# FASE 6 — CUSTOM MUSIC UPLOAD

## Status: ⬜ Belum mulai

## Tujuan
User upload file musik sendiri — gan perlu urusan pihak ketiga/lisensi.
Support MP3/OGG/WAV/FLAC. Playback via musik bus.

## Implementation
- `<input type="file" accept=".mp3,.ogg,.wav,.flac,audio/*" multiple>`
  (CSP-safe, gak ada external URL)
- `file.arrayBuffer()` → `ctx.decodeAudioData(buffer)` → `AudioBuffer`
- Store dalam `Map<string, AudioBuffer>` (playlist)
- Playback `AudioBufferSourceNode` → connect `musicGain` bus
- Controls: play/pause/stop/next
- Volume dari `musicVolume` slider
- Queue: ketika track selesai, lanjut ke track berikutnya

## Menu UI (di tab AUDIO)
```
┌─────────────────────────────────┐
│ CUSTOM MUSIC                    │
│ [Choose File] No file chosen    │
│ Accept: .mp3 .ogg .wav .flac    │
│ Now Playing: —                  │
│ [▶ Play] [⏸ Pause] [⏹ Stop]   │
│ Volume: ████████░░ 80%          │
│                                 │
│ PLAYLIST:                       │
│ 1. my_song.mp3    [×]          │
│ 2. ambient.ogg    [×]          │
└─────────────────────────────────┘
```

## ThreatCrush IMPORTANT
- Semua pakai DOM API + textContent. GAK BOLEH dynamic innerHTML.
- File name ditampilkan via textContent bukan innerHTML (XSS-safe).

## Acceptance
- [ ] Upload .mp3/.ogg/.wav/.flac berfungsi
- [ ] Play/pause/stop/next jalan
- [ ] Volume dikontrol musicVolume
- [ ] Gak ada innerHTML (ThreatCrush safe)

---

# FASE 7 — UI EFFECTS POLISH

## Status: ⬜ Belum mulai

## HUD polish (hud.ts)
- Panel opacity transition (data berubah → fade in 0.2s)
- Active target panel glow (text-shadow pulse)
- Scanline animation refine (tweak speed/opacity)
- Typography hierarchy (font-weight 700 titles, 400 data)
- Panel borders: gradient edges (subtle industrial)

## Menu polish (menu.ts)
- Tab transitions (smooth color fade on switch)
- Slider glow on hover (accent-color pulse)
- Button hover effects (border color transition)
- Panel slide-in animation (dari kanan, 0.3s)

## Contoh CSS-like transitions (JS)
```typescript
// Panel fade
panel.style.transition = "opacity 0.2s ease";
panel.style.opacity = "0";
requestAnimationFrame(() => { panel.style.opacity = "1"; });

// Button hover glow
btn.addEventListener("mouseenter", () => {
  btn.style.boxShadow = `0 0 8px ${colors.tech}`;
  btn.style.transition = "box-shadow 0.15s ease";
});
btn.addEventListener("mouseleave", () => {
  btn.style.boxShadow = "none";
});
```

## Acceptance
- [ ] HUD panel fade on data change
- [ ] Target panel glow
- [ ] Menu tab/slider/button hover effects jalan

---

---

# PART B — STADIUM INTERIOR WORLD (FULL AAA MMORPG, wire ke gameserver)

> **PRINSIP Part B:** Stadium/kapal luar angkasa **BUKAN background**. Tiap stadium
> = `StationEntity`/`VesselEntity` hidup di `packages/gameserver/types.ts:29` (D-008
> server-authoritative). `1 repo = 1 vessel` (`06 §18.1:842`, `decisions-mmo.md:87`
> D-007) — **repo = repo user sendiri** (`VesselModel.source.org/repo`
> `packages/universe/types.ts:75`), `owner = VesselEntity.owner` `types.ts:32`
> di-set `WorldRegion.spawnVessel({owner:playerId})` `world.ts:96` /
> `server.ts:218` `spawnPlayerVessel`. Damage kapal = code kapal di repo ikut
> rusak — itu udah ada di `gameserver` (`component.ts`, `collision.ts:92`
> `KE=½mv²×angle×penetration`, `thermics.ts:28` `∝1/r²→>1200K→health-2/tick`,
> `combat.ts:39` `DAMAGE_CEILING=12` per-subsystem), Part B cuma polish UI
> biar selevel engine gila yang udah lu bikin — **FULL FPS AAA, gak ada versi
> murah, tinggal wire**.

> **Repo siapa?** Jawab jebakan: **repo user sendiri** — user bikin repo baru
> di akun dia (`github.com/dia/my-stadium` isinya `arclux.stadium.json` +
> `vessel.json` universe), game kirim `repoUrl` → `gameserver` `world.ts:96`
> spawn jadi `StationEntity`/`VesselEntity`/`CharacterEntity`. Validasi
> `validator.ts:53` `entity.owner===playerId` + 3-tier license
> `universe/license.ts:10` `open/shared/private`. `engine/pipeline.ts:1`
> **TIDAK** dipakai game — itu buat analisis codebase workspace.

---

# FASE 8 — FPS WALKABLE INTERIOR WORLD (Genshin-like, FULL)

## Status: ⬜ Belum mulai

## Tujuan
Di dalam Ark/stadium bisa **jalan FPS beneran**, ada kehidupan, bisa ketemu
player lain — kayak Genshin/MMORPG, bukan click-to-move murah. Skala tetap
EVE/Star Citizen kayak exterior stadium megastructure.

## Konsep
Exterior = `scene3d.ts:760` `buildArkLibrary()` (sudah). Interior = scene
terpisah `buildArkInterior()` di file baru, **lazy-load cuma pas docking**
biar gak berat di orbit. Dua scene gak dirender bareng — `renderer.ts`
switch `exterior ↔ interior` via `DockingState`.

## File
- **NEW** `apps/game/src/renderer/interior.ts` ~480 baris — `buildArkInterior()`,
  promenade, plaza, corridor, hangar bay geometry
- `apps/game/src/renderer/renderer.ts` +60 — `DockingState` + switch scene
- `apps/game/src/renderer/input.ts` +80 — mode `FPS_INTERIOR`
- `apps/game/src/renderer/scene3d.ts` — reuse `tokens.ts` D-025 palette

## Detail implementasi

### 8a. FPS Controller (FULL, bukan click)
```typescript
// interior.ts — FPS interior, pointer-lock kayak game AAA
type InteriorMode = "EXTERIOR" | "FPS_INTERIOR";
let mode: InteriorMode = "EXTERIOR";
let yaw = 0, pitch = 0, vel = new THREE.Vector3();

// input.ts — extend, bukan ganti
// WASD + Shift sprint + Space jump + Ctrl crouch + mouse look
// pointer-lock: canvas.requestPointerLock() → mousemove → yaw/pitch
// collision: THREE.Box3 per corridor/promenade + raycast lantai
// clamp pitch ±85°, sprint 1.6×, jump impulse 4m/s, gravity 9.8
```

### 8b. Interior Geometry (FULL detail, bukan placeholder)
- **Corridor spine** — `BoxGeometry(4200, 80, 80)` sepanjang keel, panel lines +
  emissive strip kayak exterior 12 hull panel (`Fase 3.1`), 8 window strips
- **Promenade 4 ring** — walkway melingkar di tiap ring (reuse radius
  640-760 `Fase 3.5`), guard rail + hazard stripe, `96 windows` warm
  `#ffd9a0` tetap kelihatan dari dalam
- **Plaza central** — `CylinderGeometry(400, 400, 20, 48)` di tengah hull,
  tempat kumpul, `StationEntity.safeZoneRadius:58` = `1000m`
- **Habitat deck** — 24 habitat `Box(30,18,26)` per ring jadi ruangan beneran
  (bisa masuk), bukan cuma `InstancedMesh` luar
- **Lighting** — `AmbientLight` + `PointLight` per deck + emissive window,
  `PMREMGenerator` reuse Fase 1 (scene.environment tetap)

### 8c. Wire ke gameserver (authoritative D-008)
```typescript
// packages/gameserver/types.ts — tambah (server authoritative)
export interface CharacterEntity extends GameEntity {
  kind: "character"; // baru, selain "vessel"|"station" types.ts:26
  vesselId: string;  // vessel induk yang dimiliki
  deck: "hangar"|"promenade"|"plaza"|"habitat";
}
// RegionSnapshot:79 tambah entities: (WorldEntity|CharacterEntity)[]
// WorldRegion: world.ts:96 spawnCharacter(opts) mirip spawnVessel
// Simulation: simulation.ts:85 step() sync CharacterEntity 25Hz bareng VesselEntity
// Persistence: persistence.ts:120 saveRegion/loadRegion ikut simpan CharacterEntity
```

### 8d. Multiplayer
- `WorldRegion:65` `entities: Map<string, WorldEntity|CharacterEntity>` —
  semua karakter sync kayak vessel
- `governance.ts:31` `isInSafeZone` — di dalam stadium = safe zone, `combat.ts`
  gak bisa hit
- `observability.ts` + `intel.ts` — presence `CharacterEntity` kelihatan di
  overlay `[KOMUNITAS A] [GSF-xxxx] [username]` `01:806`

## Performance
- Lazy-load: `buildArkInterior()` cuma dipanggil pas `DockingState.entering`
- `InstancedMesh` habitat/windows tetap 1 draw call
- Exterior scene `visible=false` pas di dalam

## Acceptance
- [ ] FPS beneran (WASD+Shift+Space+mouse look, pointer-lock) — bukan click
- [ ] Collision jalan gak tembus dinding/lantai
- [ ] Interior detail full (corridor+promenade+plaza+habitat) — bukan kotak kosong
- [ ] Karakter player lain kelihatan & sync (2+ player di plaza)
- [ ] Lazy-load — orbit tetap 60fps, interior load pas docking aja
- [ ] `buildArkInterior()` ~480 baris, `input.ts` +80, `renderer.ts` +60

---

# FASE 9 — KARAKTER ENGINEER (bikin kayak bikin kapal di repo)

## Status: ⬜ Belum mulai

## Tujuan
Tiap orang bisa **bikin karakter sendiri kayak bikin kapal di repo** — vessel
langsung ada karakter. Pilot = karakter persisten `D-025` `repository→distrik,
community→fraksi, pilot→karakter` `decisions-mmo.md:297`.

## Konsep — Repo = Karakter
- **Kapal** → repo dengan `VesselModel` (`packages/universe/types.ts:75`
  `source.org/repo`) → `world.ts:96` `spawnVessel({owner:playerId})`
- **Stadium** → repo dengan `arclux.stadium.json` + `VesselModel` →
  `world.ts:115` `spawnStation({owner, communityId})`
- **Karakter** → repo karakter (repo kecil isinya `character.json`:
  `body, armorColor, emblemRepo`) → `world.ts:96` `spawnCharacter` /
  `spawnVessel` mini `owner=playerId` → `CharacterEntity` di dalam stadium
- Semua **repo user sendiri** (`github.com/dia/my-character`), game kirim
  `repoUrl` → `gameserver` clone/validasi → spawn. Bukan repo ARCLUX pusat.

## File
- `apps/game/src/renderer/menu.ts` +80 — `CharacterCustom` UI
- `packages/gameserver/types.ts` +15 — `CharacterEntity`
- `packages/gameserver/world.ts` +25 — `spawnCharacter()`
- `packages/gameserver/persistence.ts` +10 — simpan karakter
- `packages/gameserver/lineage.ts:22` `recordCreation` — provenance karakter

## Detail implementasi

### 9a. CharacterCustom UI (pertama masuk stadium)
```
┌─────────────────────────────────┐
│ CREATE CHARACTER (repo = karakter)│
│ Body: [A] [B] [C] [D] preset    │
│ Armor: [██] color picker         │
│ Emblem: repo GSF-001/my-emblem   │
│ Nama: GSF-xxxx (prefix user)    │
│ [Spawn di Plaza]                │
└─────────────────────────────────┘
```
- DOM `textContent` ThreatCrush-safe (kayak `hud.ts` `esc()`)
- Pilih 4 body preset dulu (box+capsule, bukan skeletal — AAA feel awal)
- `emblemRepo` = repo yang jadi emblem (bisa repo vessel dia sendiri)
- Simpan: `PlayerIntent { type:"spawn_character", payload:{characterJson} }`
  → `simulation.ts:167` `applyIntent` → `validator.ts:45` cek `playerId` →
  `world.ts` spawn

### 9b. Karakter di world
- `CharacterEntity: types.ts` `id = char:${playerId}`, `kind="character"`,
  `vesselId = vessel.id` (kapal miliknya), `deck="plaza"` awal
- `server.ts:218` `spawnPlayerVessel` sudah idempotent — karakter reuse pola
  itu
- `lineage.ts:22` `recordCreation(characterId, vesselId, owner, tick)` —
  provenance karakter tetap walau ganti baju

### 9c. Animasi
- `THREE.AnimationMixer` idle/walk/run/sprint (box rig simpel, bukan skeletal
  dulu — tetap AAA feel karena FPS + interior detail)
- Third-person follow cam + first-person toggle (`V` key)

## Wire ke gameserver
- `validator.ts:45` `playerId===ctx.playerId` + `53` `owner check`
- `persistence.ts:120` `saveRegion`/`loadRegion` ikut karakter (restart ≠ reset
  V6 `08:6`)
- `bridge.ts:102` `token = v:${vesselId}:${owner}:${target}` — karakter ikut
  pindah shard bareng vessel

## Acceptance
- [ ] Bikin karakter kayak bikin kapal (repo → spawn) — bukan form doang
- [ ] 4 preset + armor color + emblem repo
- [ ] Karakter spawn di plaza stadium, bisa jalan FPS
- [ ] `CharacterEntity` sync antar player & persist restart

---

# FASE 10 — HANGAR GARASI + ANIMASI DOCKING SINEMATIK FILM (FULL)

## Status: ⬜ Belum mulai

## Tujuan
Parkir kapal **luar & dalam kayak film**, ada garasi semua orang parkir kapal
nya di situ, animasi masuk stadium keren 💀.

## Konsep
- Garasi = bagian dari stadium `StationEntity` `safeZoneRadius:58` `1000m`
- 12 docking port di tiap ring (48 total, dari Fase 3.5b) → tiap port = gate
  ke hangar
- Hangar = `BoxGeometry(400x200x600)` di hull, 32 slot `InstancedMesh`

## File
- `apps/game/src/renderer/interior.ts` +120 — hangar bay geometry + 32 slot
- `apps/game/src/renderer/scene3d.ts` +40 — bay door anim di ring
- `apps/game/src/renderer/renderer.ts` +40 — `DockingState`
- `apps/game/src/renderer/audio.ts` +20 — docking siren + clamp sfx
- `packages/gameserver/gate.ts:34` `GateLink` — sudah ada, tinggal pakai
- `packages/gameserver/bridge.ts:75` `createGameBridge` — sudah transactional

## Detail implementasi

### 10a. Hangar Bay Geometry
```typescript
// interior.ts — hangar di hull tengah
const hangar = new THREE.Mesh(new THREE.BoxGeometry(400, 200, 600),
  new THREE.MeshStandardMaterial({ color: threeColor(colors.struct), metalness:0.7 }));
// 32 slot InstancedMesh — tiap slot Box(60,20,80) + marker light amber
// Vessel yang parkir = InstancedMesh instance, pos = slotPos[i]
// Exterior kapal tetap visible di slot (scale 0.6 biar muat)
```

### 10b. Animasi Docking Film 3 Detik (FULL, controllable)
```
APPROACH (<800m dari port, tekan F)
  → validate: validator.ts:45 + gate.ts:151 dist < activationRadius
  → request: gate.ts:185 log gate.transit.start + persistence.ts:146 savePendingHandoff (BEFORE remove)
  → anim exterior: kapal lerp dari approach vector → port (1s)
  → bay door: 2 panel Box scale 1→0 (0.5s) + light sweep PointLight 0→1.4
  → kamera: lerp lewat koridor (1s), BISA lihat kanan-kiri (controllable, bukan lock total)
  → commit: bridge.ts:134 coordinator.requestHandoff → await ACK
  → phase2: gate.ts:242 region.remove(vesselId) di source, interior.ts switch ke FPS
  → auto-clamp: kapal lerp ke slot kosong, gear down, clamp FX Sprite
  → persist: gate.ts:245 deletePendingHandoff
  → log gate.transit.complete
```
- Total 3 detik, `THREE.AnimationMixer` + `lerp`, bukan cutscene lock total
- Kalau `ack.ok===false` → `gate.ts:224` rollback `deletePendingHandoff`, tetap di orbit
- Crash mid-transit → `gate.ts:264` `recoverPendingHandoffs()` re-deliver (crash-safe `persistence.ts:120`)

### 10c. Parkir Luar vs Dalam
- **Luar:** vessel tetap `VesselEntity` di `WorldRegion` orbit, `position` dekat port
- **Dalam:** `CharacterEntity` di interior + vessel `InstancedMesh` di slot (visual), `VesselEntity` tetap di `RegionState` tapi `position = hangarSlotPos` + `velocity=0`
- Semua kapal kelihatan di garasi (32 slot, `InstancedMesh` 1 draw call)

### 10d. Audio
- `audio.ts` `sfxDocking()` — low hum + siren sweep, `sfxClamp()` — metal clamp
- `setSpeed(0)` pas docking biar engine hum pelan

## Wire ke gameserver (udah ada, tinggal pakai)
- `gate.ts:127` `createGateRouter` — `transit(req)` sudah 2-phase commit + federation check `directory.getServer`
- `bridge.ts:92` `deliver` — `target.region.spawnVessel` dari `vesselModels` Map (token anti-clone, bukan kirim source code)
- `simulation.ts:201` `dock` intent — `position=station.position`, zero velocity

## Acceptance
- [ ] 32 slot garasi kelihatan di hangar (InstancedMesh)
- [ ] Parkir luar & dalam bisa
- [ ] Animasi masuk 3 detik kayak film, controllable, door buka + light sweep
- [ ] Crash-safe (pending handoff survive restart)
- [ ] Semua kapal di garasi kelihatan (32)

---

# FASE 11 — BAZAAR KOMPONEN (jual SOURCE code vessel beneran, FULL)

## Status: ⬜ Belum mulai

## Tujuan
Di dalam stadium ada **lapak, orang bisa jalan, jual/beli komponen kapal** —
tiap komponen = code vessel beneran, kayak Genshin lapak + MMORPG trade.

## Konsep — Komponen = Code Vessel
- Tiap `VesselModel` di `packages/universe/types.ts:75` + `packages/gameserver/component.ts:10`
  punya `ComponentCondition { componentId, vesselId, health 0..100, usageCount, maxUsage, depleted }`
- 16 lapak di promenade ring (4 per ring), tiap lapak = stall `BoxGeometry(40,30,40)` + signage
- Listing = komponen beneran dari `WorldRegion` snapshot, **bukan** `ModuleInfo` engine

## File
- `apps/game/src/renderer/interior.ts` +80 — 16 stall geometry di promenade
- `apps/game/src/renderer/menu.ts` +120 — marketplace overlay (filter, preview, trade)
- `packages/gameserver/component.ts:30` `useComponent` — sudah ada
- `packages/gameserver/validator.ts:169` `checkComponent` — sudah ada
- `packages/gameserver/simulation.ts:167` `applyIntent` — sudah ada

## Detail implementasi

### 11a. Stall Geometry
```typescript
// interior.ts — 16 stall di promenade (4 per ring × 4 ring)
for (let r=0; r<4; r++) for (let s=0; s<4; s++) {
  const stall = new THREE.Mesh(new THREE.BoxGeometry(40,30,40),
    new THREE.MeshStandardMaterial({ color: threeColor(colors.structHigh), emissive: threeColor(colors.tactical) }));
  stall.position.set(promenadePos(r,s));
  // signage: Sprite textContent "LAPAK 1" (DOM overlay, bukan innerHTML)
  // proximity trigger: distance(player, stall) < 30 → show [E] Interact
}
```

### 11b. Marketplace Overlay (FULL)
```
┌──────────────────────────────────────────┐
│ BAZAAR — LAPAK 7 (Promenade Ring 2)     │
│ Filter: [All][Engine][Shield][Weapon]   │
│ ┌─────────────────────────────────────┐ │
│ │ Component: Thruster Mk3             │ │
│ │ Vessel: GSF-001/my-vessel           │ │
│ │ Health: 87%  Usage: 3/10            │ │
│ │ Price: 500 cr  Seller: GSF-002      │ │
│ │ [Preview Stats] [Graph] [Beli]      │ │
│ └─────────────────────────────────────┘ │
│ Preview: VesselModel.systems[engine]=87%│
│ Graph: mini GraphCanvas kapal seller   │
└──────────────────────────────────────────┘
```
- `menu.ts` DOM `textContent` + `esc()` kayak `hud.ts` (ThreatCrush-safe, `innerHTML` 0)
- Filter by `componentId` (engine/shield/weapon/reactor), search by `vesselId`
- Preview: `VesselModel.systems` health + `lineage.ts:44` `getLineage` provenance
- Trade button cuma aktif kalau `component.ts:30` `useComponent` `!depleted` + `validator.ts:169` `checkComponent` pass

### 11c. Trade Flow (authoritative D-008)
```typescript
// client: PlayerIntent { playerId, entityId: characterId, type:"trade_component", payload:{ listingId, componentId }, seq }
// server: simulation.ts:167 applyIntent → validator.ts:45 playerId check → component.ts:30 useComponent → lineage.ts:37 transferOwnership → log GameEvent type:"trade"
// result: RegionState.entities update, buyer vessel dapat component, seller vessel kehilangan
// damage check: kalau komponen rusak (health 0) → component.ts:30 return depleted → validator reject
```

### 11d. Damage → Code Mapping (bener — gameserver, bukan engine)
- `combat.ts:39` `applyCombatIntent` → `SystemState.health -= damage` (12 max) → komponen rusak
- `collision.ts:92` `checkCollisions` → `KE×angle×penetration` → semua `SystemState.health -= damage` → `destroyed = damage >= integrity(80)` → `region.remove`
- `thermics.ts:28` `computeThermal` → `>1200K → health-=2/tick`
- `lineage.ts:28` `recordDestruction` — provenance tetap walau hancur (`04:22` wreckage archive)

## Acceptance
- [ ] 16 lapak kelihatan di promenade (bisa jalan ke lapak, [E] interact)
- [ ] Bisa jual/beli source code komponen vessel beneran (bukan dummy)
- [ ] Validasi gameserver (cuma komponen hidup yang bisa dijual)
- [ ] Preview stats + graph + lineage
- [ ] Trade update `RegionState` langsung, damage mapping bener

---

# FASE 12 — USER BEBAS BIKIN STADIUM + LIVING WORLD INTERAKSI (FULL)

## Status: ⬜ Belum mulai

## Tujuan
**Semua stadium yang dibikin user bebas**, kayak Genshin — di dalam bisa
interaksi sesama player, ada lapak, ada garasi, MMORPG AAA.

## Konsep — Stadium = StationEntity dari Repo
- User bebas bikin stadium via repo — push repo dengan
  `arclux.stadium.json` (isinya `ringCount, habitatDensity, dockingCount`,
  plus `VesselModel` config universe). Contoh:
  ```json
  // arclux.stadium.json di github.com/dia/my-stadium
  { "name": "Stadion Dia", "rings": 4, "habitatsPerRing": 24, "dockingPerRing": 12, "communityId": "dia-faction" }
  ```
- `scene3d.ts:760` `buildArkLibrary()` → `buildStadiumFromConfig(config)` di
  `scene3d.ts`/`interior.ts` generate `StationEntity` baru (bukan background).
  `world.ts:115` `spawnStation({id, name, owner:playerId, communityId, safeZoneRadius:1000})`
- Stadium muncul di world, `gate.ts:34` `GateLink` bikin gate antar stadium

## File
- `apps/game/src/renderer/scene3d.ts` +60 — `buildStadiumFromConfig()`
- `apps/game/src/renderer/interior.ts` +60 — interior stadium user
- `packages/gameserver/world.ts:115` `spawnStation` — sudah ada
- `packages/gameserver/gate.ts:34` `GateLink` — sudah ada
- `packages/gameserver/governance.ts:31` `isInSafeZone` — sudah ada
- `packages/gameserver/persistence.ts:120` — simpan stadium

## Detail implementasi

### 12a. Build Stadium dari Repo
```typescript
// scene3d.ts — extend buildArkLibrary
function buildStadiumFromConfig(cfg: StadiumConfig): THREE.Group {
  // reuse Fase 3.5 ring logic: buildRingSection(radius, {habitats: cfg.habitatsPerRing, docking: cfg.dockingPerRing})
  // habitat/docking/windows InstancedMesh kayak Ark, tapi param dari cfg
  // return group + ringInstances kayak Fase 3 integration
}
// client kirim: PlayerIntent { type:"spawn_station", payload:{ stadiumJson, repoUrl } }
// server: validator cek repoUrl valid → world.spawnStation → persistence.saveRegion
```

### 12b. Living World Interaksi
- **Di dalam stadium:** semua `CharacterEntity` bisa `proximity` chat/interact
  (wire `governance.ts` + `intel.ts` `addIntel`/`getIntel` untuk presence &
  `cockpit.ts` HUD faction `[KOMUNITAS A] [GSF-xxxx]` `01:806`)
- **Antar stadium:** `gate.ts:127` `createGateRouter` + `bridge.ts:75`
  `createGameBridge` transactional ACK + `teleport.ts` 2-teleport mobilisasi
  (`MAX 50000, cooldown 300 ticks` `teleport.ts`)
- **Damage stadium:** `combat.ts`/`collision.ts` hit stadium → `governance.ts`
  `isInSafeZone` cek — di dalam safe zone `02:160` `BLOCKED`, di luar →
  `SystemState.health` turun kayak vessel

### 12c. Wire Community (06 §13, §15-16)
- `02:190` `Station permissions` `PUBLIC/COMMUNITY/FLEET/PRIVATE` via `GateLink.allowedCommunityIds:43`
- `06:540` `Access ≠ Ownership` — `OWNER→OPERATOR→MAINTAINER→AUTHORIZED→TEMPORARY→COMMUNITY_ADMIN` `06:554`
- `06:728` multi-sig `REQUEST→LEADER+COUNCIL→ACTION` buat ganti safe-zone

## Acceptance
- [ ] User bisa bikin stadium baru via repo (`arclux.stadium.json`) — muncul di world
- [ ] Stadium punya interior FPS + 16 lapak + 32 garasi kayak Ark
- [ ] Bisa interaksi sesama player di dalam (proximity, chat, trade)
- [ ] Gate antar stadium jalan (transactional, crash-safe)
- [ ] Damage stadium ngaruh ke code repo itu (health turun)

---

# ESTIMASI TOTAL (Part A + Part B)

| Fase | Fitur | File | Estimasi |
|------|-------|------|----------|
| 1 | Environment map reflection | scene3d.ts | 2 jam |
| 2 | Player ship model upgrade | scene3d.ts | 3 jam |
| 3 | Ark-Librarieschip detail (incl. stadium ring) | scene3d.ts | 4.5 jam |
| 4 | Explosion visual (full particle) | scene3d.ts | 3 jam |
| 5 | 5 sound effects | audio.ts | 2.5 jam |
| 6 | Custom music upload | audio.ts + menu.ts | 1.5 jam |
| 7 | UI effects polish | hud.ts + menu.ts | 1.5 jam |
| **Part A TOTAL** | | | **~18 jam** |
| 8 | FPS walkable interior (Genshin-like) | interior.ts + renderer.ts + input.ts | 6 jam |
| 9 | Karakter (repo = karakter) | menu.ts + types.ts + world.ts | 3 jam |
| 10 | Hangar garasi + docking film 3s | interior.ts + scene3d.ts + gate.ts | 4 jam |
| 11 | Bazaar jual source code vessel | interior.ts + menu.ts + component.ts | 3.5 jam |
| 12 | User bebas bikin stadium + living world | scene3d.ts + interior.ts + world.ts | 3.5 jam |
| **Part B TOTAL** | | | **~20 jam** |
| | **GRAND TOTAL A+B** | | **~38 jam** |

## File additions
- `scene3d.ts`: +735 baris (Part A 675 + Part B 60 stadium config)
- `interior.ts`: **+620 baris NEW** (Fase 8 480 + 10 120 + 11 80 + 12 60, lazy-load)
- `renderer.ts`: +60 baris (Part B DockingState switch)
- `input.ts`: +80 baris (Part B FPS mode)
- `audio.ts`: +270 baris (Part A 250 + Part B 20 docking/hangar sfx)
- `menu.ts`: +280 baris (Part A 110 + Part B 170 bazaar+character)
- `hud.ts`: +40 baris (Part A 30 + Part B 10 interior HUD)

## Grand total lines: **~2085 baris, 7 file (1 baru interior.ts), 0 breaking change.**

> Part A = polish exterior (ship, Ark stadium, ledakan, sfx, musik, UI)
> Part B = polish interior living world (FPS, karakter repo, hangar film, bazaar code, stadium bebas)
> Semua wire ke `packages/gameserver` yang udah ada (D-008 authoritative), **gak sentuh `packages/engine`**.

---

# EXECUTION CHECKLIST (per fase — centang saat selesai)

## Fase 1 — Env map ✅
- [x] pmrem generator dibuat (`PMREMGenerator` + `compileEquirectangularShader`)
- [x] scene.environment di-set tiap 10 frame (`pmrem.fromScene(scene,0.04)` + dispose target lama)
- [x] Verify build + tsc (`build-game.mjs` ✓, `tsc -p apps/game` ✓, ThreatCrush 0)

## Fase 2 — Ship model
- [ ] buildVessel() detail baru
- [ ] Verify build + tsc

## Fase 3 — Ark detail (stadium megastructure)
- [ ] 12 komponen detail
- [ ] Ring = stadium megastructure: 24 habitat + 12 docking + 4 platform + 96 windows per ring (InstancedMesh)
- [ ] Ring animation (rotasi + instanceMatrix update windows)
- [ ] Anchor position (bukan background)
- [ ] buildArkLibrary return ring/engine/shield/ringInstances refs
- [ ] Verify build + tsc

## Fase 4 — Explosion
- [ ] spawnExplosion() full particle
- [ ] Trigger saat vessel dihapus
- [ ] Memory dispose setelah 2s
- [ ] Verify build + tsc

## Fase 5 — Sound effects
- [ ] 5 sfx methods
- [ ] Trigger wiring
- [ ] sfxVolume/musicGain terpisah
- [ ] Verify build + tsc

## Fase 6 — Custom music
- [ ] File input di menu
- [ ] decodeAudioData + playlist Map
- [ ] play/pause/stop/next
- [ ] ThreatCrush safe (no innerHTML)
- [ ] Verify build + tsc

## Fase 7 — UI polish
- [ ] HUD panel fade + glow
- [ ] Menu hover effects
- [ ] Verify build + tsc

## Fase 8 — FPS interior
- [ ] interior.ts buildArkInterior() (corridor+promenade+plaza+habitat)
- [ ] FPS controller WASD+Shift+pointer-lock + Box3 collision
- [ ] Lazy-load pas docking, exterior visible=false
- [ ] CharacterEntity sync 25Hz
- [ ] Verify build + tsc

## Fase 9 — Karakter repo
- [ ] CharacterEntity + spawnCharacter()
- [ ] CharacterCustom UI 4 preset + emblem repo
- [ ] lineage + persistence
- [ ] Verify build + tsc

## Fase 10 — Hangar + docking film
- [ ] Hangar 32 slot InstancedMesh
- [ ] Animasi 3 detik controllable + bay door + light sweep
- [ ] 2-phase commit gate.ts + bridge.ts
- [ ] Parkir luar & dalam
- [ ] Verify build + tsc

## Fase 11 — Bazaar
- [ ] 16 stall promenade + proximity [E]
- [ ] Marketplace overlay filter + preview graph/lineage
- [ ] Trade via PlayerIntent + validator + component
- [ ] Validasi health/usage
- [ ] Verify build + tsc

## Fase 12 — Stadium bebas + living world
- [ ] arclux.stadium.json → buildStadiumFromConfig()
- [ ] spawnStation + GateLink + governance
- [ ] Interaksi proximity + trade antar stadium
- [ ] Damage stadium → health
- [ ] Verify build + tsc

---

# FINAL VERIFICATION (SEBELUM COMMIT)

1. [ ] `node scripts/build-game.mjs` — bundle success (gak error)
2. [ ] `npx tsc --noEmit -p apps/game/tsconfig.json` — type check clean
3. [ ] `grep -rn "innerHTML.*+" apps/game/src/renderer/` — 0 match (ThreatCrush)
4. [ ] `npx tsc --noEmit -p packages/gameserver/tsconfig.json` — gameserver type check (CharacterEntity, GateLink)
5. [ ] Manual test di game client (Electron / browser):
     - Part A: Ark detail, ring berputar, engine glow, ship detail + refleksi, ledakan + sfx, musik upload
     - Part B: FPS jalan di interior (WASD+mouse), bikin karakter via repo, parkir 32 slot + animasi docking 3 detik, 16 lapak bazaar trade, bikin stadium baru via arclux.stadium.json
6. [ ] Gak ada stray files ke-commit (`ArcluxEnvironment.ts`, `ARCLUX`)
7. [ ] Konfirmasi kepemilikan sebelum push (jangan force push)
8. [ ] Committed ke branch `feat/mmo-blueprint-full`
9. [ ] Push + buka/update PR

---

# PR / COMMIT STYLE
- Author: `GSF-001 <230616882+GSF-001@users.noreply.github.com>`
- Jangan pernah commit `packages/environment/ArcluxEnvironment.ts` atau stray `ARCLUX`
- Commit message singkat, deskriptif: `feat(game): ark detail + explosions + custom music`
- push ke `feat/mmo-blueprint-full` aja (jangan ke main langsung)
