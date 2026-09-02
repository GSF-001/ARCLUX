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

## FILE YANG DIUBAH (4 file saja — gak ada file baru)

| File | Perkiraan Baris Tambah | Isi |
|------|------------------------|-----|
| `apps/game/src/renderer/scene3d.ts` | +555 | Env map, model kapal player, Ark detail, explosions |
| `apps/game/src/renderer/audio.ts` | +250 | 5 SFX + custom music playback |
| `apps/game/src/renderer/menu.ts` | +110 | UI upload musik + refine |
| `apps/game/src/renderer/hud.ts` | +30 | UI polish |

---

# FASE 1 — ENVIRONMENT MAP REFLECTION (PMREMGenerator)

## Status: ⬜ Belum mulai

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
- [ ] Ship hull memantulkan warna sun/planet saat berputar
- [ ] Metalness 0.7 + envMap tetap performa (regenerate tiap 10 frame)
- [ ] Gak ngerusak bloom composer

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

# ESTIMASI TOTAL

| Fase | Fitur | File | Estimasi |
|------|-------|------|----------|
| 1 | Environment map reflection | scene3d.ts | 2 jam |
| 2 | Player ship model upgrade | scene3d.ts | 3 jam |
| 3 | Ark-Librarieschip detail (incl. stadium ring) | scene3d.ts | 4.5 jam |
| 4 | Explosion visual (full particle) | scene3d.ts | 3 jam |
| 5 | 5 sound effects | audio.ts | 2.5 jam |
| 6 | Custom music upload | audio.ts + menu.ts | 1.5 jam |
| 7 | UI effects polish | hud.ts + menu.ts | 1.5 jam |
| | **TOTAL** | | **~18 jam** |

## File additions
- `scene3d.ts`: +675 baris (fase 1+2+3+4 — naik karena ring stadium detail, +120)
- `audio.ts`: +250 baris (fase 5+6)
- `menu.ts`: +110 baris (fase 6+7)
- `hud.ts`: +30 baris (fase 7)

## Grand total lines: ~1065 baris, 4 file, 0 file baru.

---

# EXECUTION CHECKLIST (per fase — centang saat selesai)

## Fase 1 — Env map
- [ ] pmrem generator dibuat
- [ ] scene.environment di-set tiap 10 frame
- [ ] Verify build + tsc

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

---

# FINAL VERIFICATION (SEBELUM COMMIT)

1. [ ] `node scripts/build-game.mjs` — bundle success (gak error)
2. [ ] `npx tsc --noEmit -p apps/game/tsconfig.json` — type check clean
3. [ ] `grep -rn "innerHTML.*+" apps/game/src/renderer/` — 0 match (ThreatCrush)
4. [ ] Manual test di game client (Electron / browser):
     - Ark terlihat detail, ring berputar, engine glow
     - Ship player detail + refleksi env map
     - Kapal dihancurkan → ledakan + suara explosion
     - Upload file musik → play/pause/stop jalan
5. [ ] Gak ada stray files ke-commit (`ArcluxEnvironment.ts`, `ARCLUX`)
6. [ ] Konfirmasi kepemilikan sebelum push (jangan force push)
7. [ ] Committed ke branch `feat/mmo-blueprint-full`
8. [ ] Push + buka/update PR

---

# PR / COMMIT STYLE
- Author: `GSF-001 <230616882+GSF-001@users.noreply.github.com>`
- Jangan pernah commit `packages/environment/ArcluxEnvironment.ts` atau stray `ARCLUX`
- Commit message singkat, deskriptif: `feat(game): ark detail + explosions + custom music`
- push ke `feat/mmo-blueprint-full` aja (jangan ke main langsung)
