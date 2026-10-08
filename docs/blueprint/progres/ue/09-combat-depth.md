# 09 — COMBAT DEPTH SPEC (lock-on, projectile, AI, damage pipeline)

> Status: **SPEC-FINAL (belum dieksekusi — PR docs terpisah; eksekusi = PR sendiri per subslice).**
> Induk: `08-server-hardening.md` §4 **Sprint 7** (checklist eksekusi), `06-gameplay-systems.md`
> §2 (skill dual — Sprint 5 mengkonsumsi fondasi atribut di §5 spec ini), `05-hukum-kota.md`
> (wanted hook untuk kill NPC), `MMO-CONTRACT.md` (kontrak intent/event — update WAJIB
> saat eksekusi).
> Sumber inspirasi: riset 3 repo UE5 (§9) — **IDEA ONLY, nol kode disalin** (lisensi
> ketiganya NONE; pola dipelajari, implementasi ulang server-authoritative TS milik kita).
> Prinsip satu kalimat: **combat harus punya RUANG KEPUTUSAN — lock yang bisa dipatah,
> peluru yang terbang & bisa dielak, musuh yang mikir — semuanya dihitung server.**

---

## 0. Prinsip dasar (tidak bisa ditawar)

1. **Server-authoritative penuh (D-008).** Lock state, projectile, AI, damage — semua
   hidup di `WorldRegion` + `simulation.ts` (10Hz). Client kirim intent, terima event.
   Client TS sekarang & UE5 nanti = pelukis, bukan hakim.
2. **Determinisme (E-5 invariant).** Tidak ada `Math.random`/`Date.now` di sim path.
   Semua entitas baru (projectile, lock) iterasi-nya array- insertion-ordered, posisi
   di-round konsisten (2 desimal) tiap step, RNG hanya `createSeedRng` FNV-1a.
3. **Anti-cheat dulu, feel kemudian.** Validator menolak sebelum simulation menghitung.
   Tidak ada "client bilang sudah lock ya sudah lock" — lock di-derive dari geometry.
4. **Ceiling damage (I.7) tetap.** `DAMAGE_CEILING = 12` per-subsystem per-tick berlaku
   di SEMUA jalur baru (projectile hit, AI fire). Tidak ada one-shot dari mana pun.
5. **Semua balance = named constant** di file terpusat (mirip `SCAN_*`/`HACK_*`), siap
   ditune tanpa menyentuh logika.
6. **Volatile by default.** Projectile & lock TIDAK di-persist (restore bersih = fair);
   yang persist hanya yang sudah ada (vessel, karakter, economy, wanted).

---

## 1. Gap analysis — kondisi kita vs temuan riset

| Sistem | Kita sekarang (fakta kode) | Inspirasi riset | Keputusan desain |
|---|---|---|---|
| Targeting | **Tidak ada.** Intent attack bawa `targetId`, validator cek range, damage instan | SpaceInvader3D `PlayerShip`: detection sphere 1800m → soft-lock → **lock putus kalau gak lihat 0.8s** → reload missile 2.5s terpisah | §2 Lock-on store + state machine |
| Peluru | **Hitscan instan.** `weapon.missile` = damage biasa ke subsystem "defense" | SpaceInvader3D `Missle.cpp`: Speed 300u/s, homing `RInterpTo` turn-rate terbatas → **bisa dielak** | §3 Projectile entity server-side |
| AI PvE | **Nol combat AI.** Cosmic events spawn entity tapi gak ada yang nembak balik | SpaceInvader3D `EnemyShip.cpp`: patrol → detect → chase → aim-check (PawnSensing ke-2!) → fire → balik patrol | §4 NpcBrain state machine + wave spawner |
| Damage | Hardcoded `4 + weaponsHealth/100*8`, resist dari fit (sudah bagus) | Demo_ARPG `GEExeCalc_DamageTaken`: BaseDamage × combo × **SourceAttackPower ÷ TargetDefensePower** + pre/post mod | §5 Pipeline data-driven + mod hooks |
| Atribut | Per-subsystem health (cukup buat kapal), gak ada stat terpusat | Demo_ARPG `AttributeSet_Base`: Current/Max + `PostGameplayEffectExecute` clamp + broadcast | §5 `stats.ts` accessors (fondasi Sprint 5) |
| Skill | `capability.ts` doang (kapal induk, 3 aktivasi) | Demo_ARPG GAS: cost + cooldown + activation policy + granted-per-class | **Sprint 5** (`06` §2) — spec ini sediakan hooks-nya saja |
| Combat feel UE5 | Belum ada client UE5 (Part B) | SpaceInvader3D: thruster warna-kecepatan, lock box + beep, reload bar; Demo_ARPG: attribute bar broadcast | §8 Appendix pemetaan client |

**Yang justru kita LEBIH BAIK dari ketiga repo:** netcode. Mereka berdua client-
authoritative single-player (damage dihitung di overlap event client); repilikasi
"multiplayer" di Demo_ARPG hanya bawaan GAS tanpa kode custom. Repo tidak pernah
menyelesaikan masalah yang SPRINT INI hadapi (authority, anti-cheat, determinisme) —
jadi tidak ada yang bertentangan dengan arsitektur kita. Komplementaritasnya bersih:
**mereka ide mekanik, kita eksekusi versi server-authoritative.**

---

## 2. Lock-on & targeting (P2-A)

### 2.1 Model data

```ts
// packages/gameserver/targeting.ts (BARU)
type LockPhase = "acquiring" | "locked" | "breaking";

interface LockState {
  attackerId: string;        // vessel pemilik lock
  targetId: string;
  startedTick: number;
  progress: number;          // 0..need — naik 1/tick selama syarat terpenuhi
  need: number;              // acquisitionTicks kelas target × sensorFactor
  phase: LockPhase;
  breakingFor: number;       // hitung grace saat phase="breaking"
}

const LOCK_STORE = new Map<string, LockState>(); // key: attackerId (1 lock aktif, MVP)
```

### 2.2 Mekanik (angka awal, tunable)

- **Syarat per tick** (semua harus true agar `progress` naik):
  1. `dist(attacker, target) ≤ LOCK_RANGE(attacker)` — dasar 8 km + bonus sensor
     (komunikasi/EW yang terpasang, dari `fitDefinitionsOf`).
  2. `angle(forward, dir→target) ≤ LOCK_CONE_DEG` — dasar 45°. Kapal harus
     "menghadap" target — ini sumber drama dogfight.
  3. Keduanya `activeMode === "ship"` (mode gate Sprint 2).
  4. Tidak melewati batas safe-zone (`isInSafeZone` pair — lihat §2.5).
- **Waktu akuisisi** `need = BASE[targetClass] × sensorFactor(attacker)`:

  | Kelas target | BASE (tick @10Hz) | Rasa |
  |---|---|---|
  | Corvette/frigate | 8 | 0.8 dtk — cepat, skirmish |
  | Cruiser | 15 | 1.5 dtk |
  | Capital | 30 | 3 dtk — commit besar |

  `sensorFactor = clamp(1.3 − target.signature/200, 0.5, 1.5)` — signature
  (massa/kelas) dari data vessel; kapal kecil susah di-lock (EVE-like, disederhanakan).
- **Grace / break**: syarat hilang → `phase = "breaking"`, beri `BREAK_GRACE_TICKS = 4`
  (0.4 dtk) — flicker sensor gak langsung merusak lock. Grace habis → lock dihapus,
  event `lock_broken` + alasan (`out_of_range` | `out_of_cone` | `safety_boundary` |
  `mode_switch` | `target_destroyed` | `target_jammed` (future ECM)).
- **Re-lock adil**: lock target yang SAMA dalam 100 tick setelah putus → `progress`
  dilanjut 50% (anti "kite lock-reset"); ganti target → progress 0.
- **Maksimal 1 lock per kapal (MVP).** Sensor multi-lock (3-5) = iterasi setelah
  Sprint 5 butuh EW.
- **Turret vs missile** (pembeda penting ala EVE):
  - **Turret** cukup target *valid*: dalam `weapon.maxRange` + cone senjata — tanpa lock.
  - **Missile wajib `phase === "locked"`** — menembak missile = komitmen nyata.

### 2.3 Intent & validator

- Intent baru: `lock {targetId}`, `unlock {}`.
- Validator `lock`: target ada & kind vessel/karakter-di-vessel; bukan diri sendiri;
  range ≤ lock range; bukan pemilik vessel yang sama (teman satu owner = valid —
  friendly-fire policy tetap 06 §1); rate-limit kecil (max 1 lock intent / 2 tick —
  anti spam re-lock).
- Validator `attack` (weapon.missile): **wajib** `LOCK_STORE` attacker `phase==="locked"`
  dengan `targetId` sama dengan payload target → reject `reason:"lock_required"`.
  Turret: range+cone seperti sekarang.
- Mode gate: `lock`/`unlock` masuk `SHIP_ONLY_INTENTS`.

### 2.4 Simulation

- `stepLocks()` dipanggil tiap tick SETELAH intent apply, SEBELUM projectile step:
  update progress/grace/expire sesuai §2.2. Break = hapus + log.
- Event (log + push ke pemilik lock & target saja — intel privat, bukan broadcast
  region): `lock_started`, `lock_acquired`, `lock_broken`.

### 2.5 Interaksi sistem yang sudah ada

- **Safe-zone (governance)**: lock yang targetnya masuk/keluar safe-zone berbeda →
  `safety_boundary` break. Kapal di dalam safe-zone tidak bisa lock target di luar.
- **Hack/ECM (future)**: intent `hack` targetType baru `"ew"` (Sprint 5) → target
  attacker: `lock_broken` instan + `LOCK_COOLDOWN_AFTER_JAM` sebelum re-lock.
- **Scan (P1-3)**: scan tetap cara dapat intel (posisi/kelas); lock = layer kedua
  yang butuh geometry nyata — keduanya saling melengkapi, bukan duplikat.

### 2.6 Regresi (wajib saat eksekusi)

`tests/server-sprint7-lock.test.ts`:
1. Lock in-cone dalam range → progress naik → `lock_acquired` pada tick ke-`need`.
2. Keluar cone > grace → `lock_broken(out_of_cone)`; kembali < grace → recover.
3. Missile tanpa lock → `rejected("lock_required")`; turret tanpa lock → accepted.
4. Re-lock target sama < 100 tick → progress start ≥ 50% `need`.
5. Ganti target → progress reset 0.
6. Lock target di safe-zone lain → `safety_boundary`.
7. Target destroyed saat acquiring → `target_destroyed`, store bersih.
8. Mode switch ship→fps saat locked → lock putus (`mode_switch`).
9. Determinisme: seed sama, dua proses → progress identik tick per tick.

---

## 3. Projectile server-side (P2-B)

### 3.1 Model data

```ts
// packages/gameserver/projectiles.ts (BARU)
interface ProjectileEntity {
  id: string;                 // prj:<fnv1a(owner|weapon|tick|seq)>
  ownerId: string;            // vessel penembak
  weaponType: string;         // "weapon.missile" dst — sumber stat
  targetId: string;           // MVP homing-only; tembak lurus = targetId tetap
  pos: { x: number; y: number; z: number };   // di-round 2 desimal/tick
  dir: { x: number; y: number; z: number };   // normalized
  speed: number;              // unit/tick (dari weapon def; mis. 60 = 600u/s @10Hz)
  turnRate: number;           // fraction slerp per tick (mis. 0.12 = 12%/tick)
  damage: number;             // baseDamage SEBELUM pipeline (§5)
  ttlTicks: number;           // sisa umur; habis = fizzle
  armTicks: number;           // 2 tick baru meledak — tembak jarak dekat tetap valid
}

// WorldRegion: projectiles: ProjectileEntity[] — array terpisah (bukan union
// WorldEntity): tidak masuk scan-by-default, tidak punya owner privacy sendiri
// (posisi peluru MEMANG publik — orang bisa melihat peluru di luar angkasa).
```

### 3.2 Langkah per tick (`stepProjectiles()`, urutan: intents → locks → projectiles → resolve)

1. Untuk tiap projectile (iterasi insertion-order):
   a. Cari target via `region.get(targetId)`; mati/hilang → lanjut homing ke
      titik terakhir (inert fly-by), TTL jalan.
   b. Homing: `desired = normalize(target.pos − pos)`; `dir = slerp(dir, desired,
      turnRate)`; **ini inti "bisa dielak"** — target dengan transversal tinggi
      membuat kurva belok tidak pernah sampai (inspirasi `RInterpTo` +
      `RotationSpeed=2` di `Missle.cpp`, dinormalkan ke fraction).
   c. `pos += dir × speed`, round 2 desimal. `ttlTicks--`.
2. **Hit resolution** (closest-approach): `dist(pos, target.pos) ≤ HIT_RADIUS_M (25)`
   DAN `armTicks` habis → `applyDamagePipeline(attacker, target, weaponType, baseDamage)`
   (§5 — jalur pipeline SAMA dengan turret, ceiling tetap), event `projectile_hit`.
3. `ttlTicks ≤ 0` → event `projectile_fizzle` (peluru meledak di ruang hampa —
   visual client), hapus dari array.

### 3.3 Spawn & point-defense (counterplay)

- Spawn: intent `attack` weapon.missile yang lolos validator (§2.3) → sim membuat
  projectile dari posisi kapal + arah ke target. Cooldown senjata (4-10 tick) tetap
  berlaku — rate of fire missile = kombinasi cooldown + lock cycle.
- **Point defense**: intent baru `intercept {projectileId}` — turret menembak peluru
  masuk. Syarat: peluru dalam `weapon.maxRange` + cone, target peluru. Hasil
  deterministik: `HIT_CHANCE = clamp(baseTracking − projSpeed/1000, 0.15, 0.85)`,
  roll pakai `createSeedRng(hash(ownerId|projectileId|tick))` — bukan Math.random.
  Sukses → event `projectile_destroyed`, peluru hilang SEBELUM resolve hit.
- Kapasitas: `MAX_PROJECTILES_PER_REGION = 100` (stability trim: fizzle dulu, lalu
  oldest). Over cap → spawn di-reject + event (pola entity cap Sprint 1).

### 3.4 Stat missile (contoh balance table — di `weaponDefs`)

| Weapon | speed/tick | turnRate | baseDamage | ttl | cooldown | catatan |
|---|---|---|---|---|---|---|
| weapon.missile | 60 | 0.12 | 10 | 50 | 6 tick | homing standar, dielak kapal cepat |
| weapon.torpedo | 35 | 0.07 | 12 (ceiling) | 80 | 12 tick | lambat, capital hunter, gampang PD |
| weapon.rocket (future) | 90 | 0.05 | 6 | 30 | 3 tick | pseudo-straight, anti-frigate |

### 3.5 Snapshot / visibility

- `/snapshot` penuh (viewer = pemilik / legacy): sertakan `projectiles[]` ringan
  `{id, ownerId, targetId, pos, weaponType}` — jangan sertukan ttl/turnRate (intel
  minor, hemat byte). Delta/interest = urusan Sprint 3 — projectile prioritas tinggi
  hanya untuk pemilik + kapal yang meng-lock pemilik (bukan ke seluruh region).
- Persist: TIDAK (volatile §0.6). Resume dari snapshot → langit bersih, lock hilang.

### 3.6 Regresi

`tests/server-sprint7-projectile.test.ts`:
1. Spawn via intent missile setelah lock → `projectile_spawned`, array berisi 1.
2. Target diam → `projectile_hit` pada tick yang deterministik, damage masuk pipeline
   (cek subsystem berkurang, ≤ ceiling).
3. Target dodge tegak lurus (move intent zig-zag seed sama) → TTL habis tanpa hit →
   `projectile_fizzle`.
4. `intercept` dalam range → seed tertentu destroyed / selamat (assert dua seed yang
   menghasilkan dua hasil — bukan hardcode keberuntungan).
5. Arm time: tembak dari jarak < 10m tetap kena (armTicks terpenuhi sebelum jarak
   0) — tidak ada "self-fizzle point-blank".
6. Cap 100: spawn ke-101 → reject + event.
7. Replay determinisme dua proses → posisi projectile identik per tick.

---

## 4. NPC AI combat (P2-C) — menghidupkan PvE

### 4.1 NpcBrain — state machine per vessel NPC

```
PATROL  --hostile in SENSOR_RANGE--> DETECT
DETECT  --lock-like confirm 2 tick--> CHASE
CHASE   --dalam WEAPON_RANGE + CONE--> AIM
AIM     --aim hold 2 tick--> FIRE (applyDamagePipeline, cooldown senjata)
FIRE    --target mati/keluar--> RETURN (balik patrol point) / ulang CHASE
State apa pun --target masuk safe-zone--> RETURN (AI tidak pernah menembak di safe-zone)
```

- Referensi mekanik: `EnemyShip.cpp` (patrol-target detection sphere → chase rotation
  → aim check via PawnSensing KEDUA khusus "cukup mengarah?" → fire → null-out timer
  0.1s → patrolling). Kami port ke tick-based TS: semua timer dalam tick, tanpa
  FTimerHandle.
- **Think cadence**: NPC berpikir tiap 3 tick, offset `hash(id) % 3` — 20 AI tidak
  pernah spike bersamaan di satu tick (anggaran CPU).
- **Faction matrix** kecil di data (`hostile: {pirate: ["*"], convoy: ["pirate"]}`) —
  default: faksi `pirate` hostil ke semua non-pirate. Sumber faction = field entity
  (sudah ada di payload scan P1-3).

### 4.2 NPC = vessel biasa (bukan god-mode)

- NPC dibuat sebagai `VesselEntity` dengan `owner: "npc:<faction>:<seedIdx>"`,
  sistem health standar, **tanpa player authority** — AI memanggil jalur damage
  internal sim (bukan `/intent`), TAPI `applyDamagePipeline` yang SAMA (ceiling,
  resist dari fit, semuanya berlaku). NPC bisa dibunuh, bisa salah tembak kapal
  se-faksi kalau matrix bilang (MVP: friendly-fire AI off).
- Kill NPC → **tanpa wanted** (05 §2: buronan hanya untuk kejahatan antar-pemain /
  terhadap nyawa sipil — hook `escalateCrime` TIDAK dipanggil); log `npc_killed`
  + hak salvage drop = economy hook (drop table sederhana: komponen 1-3 unit —
  diimplementasi minimal dulu, crafting = Sprint 5/6).

### 4.3 Wave spawner (PvE event)

State machine region-level (inspirasi `GameMode_Survival.cpp`):

```
IDLE --event/table--> WAIT (pre-roll spawn points dari seeded rng)
WAIT --WAVE_DELAY--> SPAWNING (spawn N NPC, stagger 1/tick)
SPAWNING --semua spawned--> IN_PROGRESS (AI aktif §4.1)
IN_PROGRESS --counter == 0--> COMPLETED (reward event) / FAILED (timer habis)
COMPLETED --ada wave berikut--> WAIT (next) / IDLE
```

- Trigger MVP: cosmic event "anomaly swarm" (extend `generateCosmicEvents`) atau
  intent admin/dev `dev_spawn_wave` (guard: hanya non-production / role admin —
  pola guard `DEV_SECRET`/env yang sudah ada).
- Budget: `MAX_AI_ACTIVE_PER_REGION = 20`; wave > 20 = reject + event (stability
  hook Sprint 1 yang sudah ada).
- Event: `wave_started {wave, count}`, `wave_completed {wave, salvage}`.

### 4.4 Regresi

`tests/server-sprint7-ai.test.ts`:
1. Hostile masuk sensor → PATROL→CHASE→FIRE dalam jumlah tick yang deterministik,
   damage NPC = pipeline (ceiling berlaku).
2. Target masuk safe-zone → AI RETURN, tidak ada hit setelahnya.
3. Kill NPC → log `npc_killed`, **wanted pemain tidak naik**, salvage drop masuk
   inventory region.
4. Wave: spawn N=5 → counter 5; kill 5 → `wave_completed`; seed sama → susunan
   spawn identik.
5. Budget: 25 spawn request → 20 aktif + reject event.
6. AI tidak pernah memanggil path `/intent` (assert internal-only: store authority
   bersih dari playerId pemain).

---

## 5. Damage pipeline upgrade (P2-D) — fondasi Sprint 5

### 5.1 `stats.ts` (BARU — accessors terpusat, ala AttributeSet tapi TS)

```ts
// packages/gameserver/stats.ts
export function attackPowerOf(v: VesselEntity): number;   // 0..150, dari weapons health + mod fit
export function defensePowerOf(v: VesselEntity): number;  // 0..150, dari hull+defense health ratio
export function signatureOf(v: VesselEntity): number;     // massa/kelas → faktor lock & splash (future)
```

- Tidak ada state baru — semua DERIVED dari data vessel yang sudah ada (sistem health
  + fit definitions). Inilah versi kita dari `AttributeSet_Base`: satu tempat angka
  dicari, konsisten untuk kapal pemain, NPC, dan (Sprint 5) karakter FPS.

### 5.2 Formula & mod hooks (mengganti `attackPower()` hardcoded di combat.ts)

```
raw        = basePower(weapon) × (attackerPower/100) / max(defensePower/100, 0.5)
afterMods  = applyMods(raw, ctx)          // array mod — lihat bawah
afterResist= afterMods × (1 − resist)     // resist fit target (SUDAH ADA, pindah ke pipeline)
damage     = min(afterResist, DAMAGE_CEILING, targetSys.health)
```

Mod hooks MVP (urutan tetap, murni, deterministik):
1. **rangeFalloff**: linear 100% → 60% dari `0` ke `weapon.maxRange` — tembak jarak
   jauh lemah (mendorong dogfight, komplementer lock cone).
2. **conditionPenalty**: `attackerWeaponsHealth < 50` → ×0.7 (kapal rusak = sakit
   menembak — memperkuat subsystem damage yang sudah ada).

Sprint 5 menambah mod di array yang SAMA (booster, skill aktif, hack effect) —
inilah analog TS kita dari GameplayEffect execution calc (`GEExeCalc_DamageTaken`:
capture SourceAttackPower / TargetDefensePower → kami capture via `stats.ts`).

### 5.3 Regresi

`tests/server-sprint7-pipeline.test.ts`:
1. Kapal power 150 vs defense 50 → damage 3× lipat dasar (sebelum ceiling).
2. Defense 150 → damage setengah; clamp defense min 0.5 (anti-invit).
3. Falloff di maxRange → 60% damage; di 60% range → ~76%.
4. Weapons health 40 → ×0.7 conditionPenalty.
5. Ceiling 12 tetap menang di semua kasus di atas (invariant I.7).
6. Regresi lama: semua test combat/fitting yang ada tetap hijau (refactor,
   bukan revolusi).

---

## 6. Kontrak & integrasi (checklist eksekusi)

- [ ] `MMO-CONTRACT.md`: intent `lock`, `unlock`, `intercept`; event `lock_started`,
      `lock_acquired`, `lock_broken`, `projectile_spawned/hit/fizzle/destroyed`,
      `npc_killed`, `wave_started/completed` — signature + payload + siapa yang
      menerima (privat vs region).
- [ ] `visibility.ts` sanitizeSnapshot: proyeksi projectile ringan (§3.5) + lock
      state PEMILIK saja (lock = intel privat).
- [ ] `types.ts`: `ProjectileEntity` type + `WorldRegion.projectiles`.
- [ ] `stability.ts`: cap projectile (§3.3) + cap AI (§4.3) masuk ladder trim.
- [ ] `persistence`: TIDAK menyentuh projectile/lock (volatile, §0.6) — tapi
      `world.restore` harus **mengosongkan** store baru (bukan bawaan lupa).
- [ ] `server.ts`: route `/intent` meneruskan intent baru (validator sudah cukup
      — tidak ada route baru).
- [ ] Client TS: panel target lock minimal (daftar target dalam lock range + progress)
      — polish = urusan `09-client-polish.md` fase UE.

---

## 7. Slicing eksekusi (satu PR per subslice, gate §6 08 = merah = STOP)

| PR | Isi | Estimasi | Test |
|---|---|---|---|
| A | `targeting.ts` + validator lock + sim stepLocks + contract | ~250 baris | 9 (§2.6) |
| B | `projectiles.ts` + stepProjectiles + spawn dari intent + intercept | ~300 baris | 7 (§3.6) |
| C | `npcBrain.ts` + wave spawner + faction matrix + budget | ~350 baris | 6 (§4.4) |
| D | `stats.ts` + pipeline refactor combat.ts + 2 mod hooks | ~150 baris | 6 (§5.3, hati-hati regresi) |

Urutan **A → B → C → D** (D paling akhir = paling banyak menyentuh file lama;
A→B cepat terasa efeknya di PvP). Bisa juga A+B jadi satu PR "projectile combat"
kalau review lebih suka diff besar-bersih.

**Definisi done Sprint 7 (semua PR)**: regresi di atas hijau; `npx tsc --noEmit`
scoped bersih; replay determinisme 2 proses identik untuk lock+projectile+AI;
smoke QUICKSTART-MMO.md jalan; `Math.random`/`Date.now` di sim path = 0.

---

## 8. Appendix A — Pemetaan ke client UE5 (Part B / `09-client-polish.md` / `07-studio.md`)

Fase UE butuh referensi "cara kapal terasa + combat UX" — inilah yang dipetik dari
riset (tanpa kode, tanpa aset):

| Kebutuhan client UE5 kita | Inspirasi (repo/file) | Yang diadopsi |
|---|---|---|
| Flight feel (thrust, turn per-axis) | SpaceInvader3D `PlayerShip` (`SetCurrentControlSpeed` per-axis deadzone/sensitivity; `UFloatingPawnMovement` max speed) | Pola input: pitch/yaw/punya bobot terpisah; **validasi tetap server** (maxspeed P1) |
| Lock-on UX | `HandleLockedOnEnemyShipStatus` + box outline musuh + beep makin cepat saat lock dekat + reload bar 2.5s | Client render dari event `lock_*` server; beep/UI pacing disesuaikan `need` server — BUKAN dihitung client |
| Missile visual | `Missle.cpp` Niagara trail + thruster | Peluru = interpolasi visual ke posisi server (cosmetic); jangan prediksi damage |
| Thruster feedback | thruster warna/`SetThrusterPitch` by `CurrentSpeed` | Bahasa visual kecepatan — pas dengan kapal kita yang maxspeed-nya bervariase per fit |
| Wave/PvE HUD counter | `SpaceInvaderGameState` enemy-count | Binding event `wave_*` → HUD musuh tersisa |
| Attribute bar (HP/energy) | Demo_ARPG `UIComponent` broadcast `OnCurrentHealthChanged` | Pola: event stream server → binding bar cockpit; Sprint 5 energy = slot Rage |
| Ability cost/cooldown UX | GAS `EAbilityActivationPolicy` (OnTriggered/OnGiven) | Panel skill cockpit: aktif (tekan) vs pasif (badge) — Sprint 5 |
| Damage numbers | `GEExeCalc` SetByCaller base+mod | Event `projectile_hit` sudah bawa before/after — tinggal render |
| Studio (07) PvE per planet | Wave spawner §4.3 | Tabel spawn dari `world.json` koloni/founder — AI = "isi planet", bukan hardcode |

Catatan strategis: **semua baris di atas TIDAK membutuhkan UE5 untuk di-review** —
spesifikasi server (§2-§5) adalah kontraknya; client tinggal memenuhi.

## 9. Appendix B — Sumber riset & transparansi lisensi

| Repo | Kontribusi ide | Ambil? | TIDAK ambil |
|---|---|---|---|
| `Learningstuff98/SpaceInvader3D` (2★, C++, license **NONE**) | Lock-on flow (sphere/cone/grace/reload), homing turn-rate (bisa dielak), AI patrol→chase→aim→fire, thruster-by-speed UX | **Pola mekanik saja** (§2-§4, §8) | Kode, aset, VFX, animasi; seluruh arsitektur client-authoritative-nya |
| `Yunyang29/Demo_ARPG_Cpp` (5★, GAS, license **NONE**, "educational only") | AttributeSet + PostEffect clamp, damage formula capture Source/Target, mod-hook pipeline, ability cost/cooldown/granted-by-data, UI broadcast pattern | **Pola arsitektur saja** (§5, §8) | Kode, aset kursus, animasi, widget; klaim "multiplayer replication" (ternyata hanya bawaan GAS) |
| `OctavianTocan/Realistic-Assault-Rifle-Template` (4★) | **Repo = showcase marketing, NOL kode** (README+gambar). Produk berbayar FAB/Gumroad | Tidak ada yang bisa diambil dari GitHub-nya | — (catatan: kalau suatu saat butuh weapon feel FPS, beli lisensi marketplace = urusan legal terpisah) |

Alasan legal: lisensi ketiganya NONE = all-rights-reserved; ide/mekanik/gambaran
sistem TIDAK dilindungi copyright (yang dilindungi = ekspresi kode/aset). Spec ini
menuliskan ulang semuanya dalam bahasa desain milik kita, dengan angka dan bentuk
data sendiri, untuk diimplementasi di `packages/*` milik kita. Tidak ada potongan
kode dari ketiga repo yang masuk repo ini — kalau ada kemiripan baris, itu bug,
bukan fitur.

---

## 10. Hubungan dengan sprint lain

- **Sebelumnya** (sudah SELESAI): Sprint 1 hardening (#775), Sprint 2 otoritas (#779).
  Lock/projectile/AI BERDIRI di atas: validator identity+seq, mode gate, rate limit,
  ceiling, seeded rng — tanpa itu spec ini tidak aman dieksekusi.
- **Sprint 3 (skala) tidak tertahan**: interest management justru LEBIH baik tahu
  bentuk `projectile[]` + `lock` privat saat mendesain delta snapshot — boleh
  dikerjakan dulu ATAU sesudah PR A-B sprint ini. Tidak ada dependency kaku.
- **Sprint 5 (skill)** mengkonsumsi §5: mod hooks + `stats.ts` = tempat cost/cooldown/
  efek skill dipasang; `06` §2 tetap dokumen otoritatif isi skill-nya.
- **Sprint 6 (load-test)**: §4.3 budget AI + §3.3 cap projectile = kasus load nyata
  pertama yang harus diukur harness-nya.
- **UE5 (Part B / Studio 07)**: Appendix A = daftar kebutuhan client yang sudah
  terpetakan — dieksekusi SETELAH PC Windows + UE5 tersedia.

> Aturan main dokumen ini: **ide boleh diusulkan di issue/PR, angka balance boleh
> ditune, tapi prinsip §0 tidak boleh dilanggar** (authority, determinisme, ceiling,
> volatile, no-code-copy).
