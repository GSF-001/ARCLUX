# ARCLUX → UE5: FLAGSHIP CLIENT (migrasi presentasi, bukan rewrite MMO)

> Status: **DECISION-FINAL + SPEC.** Keputusan: UE5 menjadi flagship client
> PC kelas berat (20–30GB sah, super-realistis sci-fi), BUKAN pengganti
> server, BUKAN pengganti web client. Alasan migrasi SATU: kompleksitas
> game (state/simulasi/cerita) sudah AAA di TypeScript, tapi renderer
> Three.js/WebGL tidak sanggup me-render kompleksitas itu dengan jelas.
> HP/mobile BUKAN target (by design, tertulis `settings.ts`) — UE tidak
> mengobati mobile, UE mengobati ceiling visual PC.
> Urutan: 10.V DONE dulu di three.js (= work order port UE), lalu slice UE.

## 0. Keputusan yang tidak bisa ditawar

1. **Server 1, client 2.** `packages/gameserver` TIDAK DISENTUH. Format
   intent/snapshot TIDAK BOLEH berubah demi UE — yang adaptasi UE.
2. **UE = presentasi, bukan otoritas.** UE kirim intent → validator vonis
   → sim → snapshot → UE render. Client tidak pernah menulis state.
3. **`apps/game` (three.js) TETAP HIDUP** = client ringan (demo self-host,
   buka URL langsung main). UE = flagship. Dua client, satu otoritas.
4. **TS tidak di-transpile.** `apps/game/src/renderer/**` = referensi
   perilaku + visual. Ditulis ulang C++/Blueprint sebagai presentasi.
5. **10.V = ART yang di-port.** Tiap fase 10.V DONE = spek UE (tabel §7).
   Jangan port fase yang belum DONE — port kabut = hasil kabut.
6. **Slice bergate.** Slice N gagal gate = stop, jangan lanjut (§8).

## 1. Arsitektur akhir

```
                    ┌─────────────────────────┐
                    │   ARCLUX SERVER (TS)    │
                    │  packages/gameserver    │
                    │  sim 10Hz · validator   │
                    │  gate · persistence     │
                    │  :24001 /snapshot       │
                    │  /intent /deliver       │
                    └────────┬────────────────┘
                             │ HTTP/JSON (kontrak Transport.ts)
              ┌──────────────┴──────────────┐
              ▼                             ▼
   ┌─────────────────────┐      ┌─────────────────────┐
   │ WEB CLIENT (aktif)  │      │ UE5 FLAGSHIP (baru) │
   │ apps/game           │      │ apps/game-ue        │
   │ three.js + DOM      │      │ C++ + UMG + Nanite  │
   │ ringan, self-host   │      │ Lumen + Niagara     │
   │ demo, URL langsung  │      │ 20-30GB, PC DX12    │
   └─────────────────────┘      └─────────────────────┘
              │                             │
              └─────── SATU OTORITAS ────────┘
              └──────── SATU ART (10.V) ─────┘
```

## 2. Tree project `apps/game-ue/` (final)

```
apps/game-ue/
  ARCLUXUE.uproject
  Config/
    DefaultEngine.ini        ; DX12/SM6, TSR, VSM, World Partition
    DefaultGame.ini          ; server URL default 127.0.0.1:24001
    DefaultInput.ini         ; (Enhanced Input di-asset, bukan ini)
  Source/
    ARCLUXUE/
      ARCLUXUE.Build.cs      ; module: HTTP, JSON, UMG, Niagara, EnhancedInput
      ARCLUXUE.h/.cpp        ; GameInstance: boot, server URL, tick poll
      Transport/
        ArcluxTransport.h/.cpp       ; UCLASS: POST /intent, GET /snapshot 10Hz
        ArcluxTypes.h                ; USTRUCT FArcluxIntent / FArcluxSnapshot
      World/
        ArcluxRegionActor.h/.cpp     ; AActor: pegang regionId + tick
        ArcluxWorldSubsystem.h/.cpp  ; UWorldSubsystem: snapshot -> Actor sync
      Vessel/
        VesselActor.h/.cpp           ; AVesselActor: FVesselSystems + mesh + VFX
        VesselMovementVis.h/.cpp     ; interpolasi snapshot (presentation only)
      Station/
        StationActor.h/.cpp          ; hub + ring + safe-zone visual
      Planetary/
        PlanetaryReader.h/.cpp       ; EnvironmentalContext JSON -> UE params
        StormDirector.h/.cpp         ; beat sinematik (trigger, bukan sim)
      UI/
        ArcluxHud.h/.cpp             ; UUserWidget: TAC/VESSEL/slot (token §6)
        CockpitWidget.h/.cpp         ; instrumen 3D + shake (ganti DOM U4)
        NpeWidget.h/.cpp             ; tutorial 5 langkah (desain U10)
      Input/
        IMC_ARCLUX.uasset            ; Input Mapping Context (WASD/QE/look)
        IA_Move/IA_Fire/...uasset    ; Input Action per intent
  Content/
    ARCLUX/
      Vessels/
        SM_VesselHull.uasset         ; static mesh (import glTF/FBX §3)
        M_Hull.uasset                ; material: albedo/rough/normal (M1 port)
        T_Hull_* .uasset             ; texture dari seed kit (atau bake)
      World/
        M_Planet.uasset  M_Ocean.uasset  M_Cloud.uasset
        NS_Storm.uasset              ; Niagara: rain/streak/splash/spray
        NS_Weapon_*.uasset           ; Niagara per archetype (W1 port)
      Station/  Interior/  UI/  Audio/
        ; Audio: MetaSounds synth (port audio.ts, BUKAN mp3 — CSP lesson)
  Docs/
    PORT-10V.md                ; generated per fase: ceklist port (§7)
```

## 3. Aset: apa yang dibawa, apa yang dibikin ulang

| ARCLUX sekarang | UE5 | Cara |
|---|---|---|
| Mesh `.glb/.fbx` (bila ada di `assets/`) | `SM_*.uasset` | Import FBX/glTF Epic (static/skeletal/LOD/morph) |
| Texture `.png/.tga/.exr` | `T_*.uasset` | Import + sRGB/Linear yang benar |
| `materials.ts` DataTexture seeded | Material Graph + bake `T_*` | Port ALGORITMA (seed sama → tile konsisten dua client) |
| ShaderPass GLSL (grade/cockpit/touch) | Post Process Material | Tulis ulang HLSL-node (logika sama, bahasa beda) |
| Canvas overlay droplet | Niagara / UMG material | Tulis ulang (canvas 2D tidak ada di UE) |
| DOM HUD/CSS (`hud.ts`) | UMG Widget | Tulis ulang (desain + token sama) |
| WebAudio synth (`audio.ts`) | MetaSounds | Port parameter (osc/freq/durasi), bukan file |
| Animasi prosedural `timeSec` | Timeline / Material Time | Port rumus (posisi = f(time) tetap) |

DITOLAK: convert otomatis TS→C++, bawa ShaderMaterial mentah, bawa
canvas/DOM, ubah format snapshot demi UE.

## 4. Bridge jaringan (spesifikasi, bukan teori)

Server SEKARANG (terverifikasi di repo, jangan diubah):

- Tick 10Hz. `POST /intent` (10 tipe: `move, attack,
  activate_capability, dock, scan, teleport, spawn, spawn_character,
  trade_component, spawn_station`). `GET /snapshot` tiap 100ms.
- `VesselEntity { id, owner, position, velocity, heading, systems,
  integrity, emergency }`. `StationEntity { name, owner, communityId,
  position, safeZoneRadius }`.
- Validator menolak: identity mismatch, cooldown, safe-zone, flight
  blocked (adrift/crashed), license. UE TIDAK mengulang validasi —
  UE menampilkan penolakan (read-only).

`UArcluxTransport` (C++):

- `SendIntent(FArcluxIntent)` → POST JSON, queue + retry 1x, timeout 2s.
- `PollSnapshot()` → timer 100ms (bukan Tick — hemat), parse ke
  `FArcluxSnapshot`, broadcast delegate `OnSnapshot`.
- Interpolasi di `UVesselMovementVis` (alpha seperti `vessels.ts`,
  presentation only — `simulation.ts p+=v*dt` tetap kebenaran).
- Gate slice 1: connect + snapshot masuk + vessel kelihatan. Gagal =
  stop (§8 butir 1).

## 5. State → presentasi (kontrak port inti)

```
EnvironmentalContext (JSON, dari server, TETAP)
  │ timeOfDay · sun.elevation · moonState · weather.kind
  │ wind · clouds · precipitation · ocean · terrain
  ▼
UPlanetaryReader (C++, murni fungsi — testable, pola resolver TS)
  │ GradeMood { warm, storm, night }  (= deriveGradeMood, JANGAN ubah rumus)
  │ CockpitState { flash, heat, dim, shake, exposure } (rumus SAMA)
  ▼
UE presentation
  │ Post Process (grade + cockpit + touch, urutan SAMA §P1.3)
  │ Lumen (sun/moon/flash) · Niagara (rain/storm/weapon)
  │ UMG cockpit (shake transform, pola U4)
```

Aturan: RUMUS derivasi tidak boleh diubah saat port (ubah = dua client
beda perilaku = bug MMO). Yang berubah hanya bahasa + mesin render.

## 6. Token → UE (jembatan identitas visual)

`apps/game/src/ui/tokens.ts` (satu sumber: warna/tipografi/glow +
konverter CSS↔THREE) menjadi:

- `DT_ArcluxColors` (DataTable: voidDeep, hull, tech, tactical, amber…)
- `DT_ArcluxType` (font + size + tracking)
- Material Parameter Collection `MPC_Arclux` (glow intensity, scanline,
  faction tint) → UMG + material dunia membaca SUMBER SAMA.
- Aturan: re-skin = ubah DataTable, BUKAN ubah tiap widget (pelajaran
  §8.1: grammar layout kiri-TAC/kanan-VESSEL/bawah-slot JANGAN pindah).

## 7. Tabel port 10.V → UE (diisi per fase DONE)

| Fase 10.V | Status three.js | Port UE | Catatan |
|---|---|---|---|
| M1 material kit | ✅ DONE (PR #730) | M_Hull + T_* bake | Seed SAMA → konsisten |
| U4 cockpit | ✅ DONE (PR #730) | CockpitWidget 3D + Post | Shake transform → UMG |
| P1 grade+touch | ✅ DONE (PR #730) | Post Process Material | Urutan SAMA |
| L1 lighting | ⬜ antri | Lumen + VSM | Key/fill/rim → Light Rig |
| W1 weapon | ⬜ antri | NS_Weapon_* | Pool → Niagara pool |
| D1 damage | ⬜ antri | Material swap + VFX | Level visual SAMA |
| A1–A4 planet | ⬜ antri | Nanite + M_* + volumetrik | Doktrin kamera TETAP |
| U1–U12 UI | ⬜ antri | UMG + NPE | Desain SAMA, mesin beda |
| H1 dunia hidup | ⬜ antri | Crowd AI sederhana + anim | f(timeSec) → Timeline |
| R1 gaps | ⬜ antri | Per item | Presentasi-only TETAP |
| F0/F6–F8 sim | ⬜ antri | TIDAK DI-PORT (server tetap) | UE baca hasilnya saja |

Aturan: baris ⬜ = DILARANG mulai port-nya. Port = tiap baris ✅ +
`Docs/PORT-10V.md` dicentang + screenshot BANDED (browser vs UE,
adegan SAMA — dua client harus mirip, itu acceptance port).

## 8. Slice eksekusi + gate (stop-or-go)

- **Slice 0 — Scaffold.** `.uproject` + Build.cs + Config + folder §2.
  Gate: project kebuka + compile bersih.
- **Slice 1 — Connect + 1 vessel terbang.** Transport + snapshot +
  VesselActor + IMC gerak (intent `move`) + interpolasi.
  Gate: vessel server kelihatan + gerak WASD + HUD baca tick.
  GAGAL = STOP TOTAL, jangan sentuh slice 2.
- **Slice 2 — 1 planet + 1 station + dock.** PlanetaryReader +
  StationActor + intent `dock` + interior placeholder UMG.
  Gate: fly → planet → dock → interior, tanpa crash.
- **Slice 3 — Material + Lumen + 1 cuaca.** M1 port + day/dusk/night +
  1 storm cell Niagara. Gate: banded screenshot vs browser mirip.
- **Slice 4 — Senjata + damage.** W1 + D1 port + duel 2 vessel.
  Gate: kill full (large explosion + carcass) + damage terbaca.
- **Slice 5 — UMG HUD + NPE.** U1–U10 port. Gate: pemain baru 5 menit
  sampai hangar tanpa wiki.
- **Slice 6 — Multi + shard.** Multiplayer + directory + gate transit.
  Gate: 2 pemain 2 region + handoff tanpa duplikat.
  (INI FASE BERDARAH: UE Replication vs snapshot — Replication
  DILARANG untuk state MMO, UE cuma render snapshot. Siapin mental.)

## 9. Biaya jujur (dibaca sebelum mulai)

- Mesin: PC Windows/Linux + GPU DX12/SM6. Termux/HP TIDAK BISA build.
- Ukuran: 20–30GB project (disetujui, bukan masalah).
- Iterasi 5–10x lebih lambat dari `pnpm + browser`. Harga AAA.
- Skill: C++ gameplay + Material/VFX artist + UMG. Slice 0–2 bisa
  kecil, slice 3+ butuh artist beneran.
- Lisensi: UE royalti 5% >$1M — cocokkan ARCLUX MMO License SEBELUM
  komersil. Konsultan hukum, bukan AI.
- Larangan: ubah server demi UE, Replication untuk state MMO, port
  fase ⬜, convert otomatis, Schneeball-scope (1 slice = 1 gate).

## 10. Kembali ke 10.V (perintah aktif)

Dokumen ini DIKUNCI sampai 10.V DONE. Eksekusi lanjut: L1 → W1 → D1 →
A1–A4 → U → H1/R1 → F0 (PR #730 = batch 1: M1/U4/P1). Setiap baris
tabel §7 berubah ✅ = amunisi UE. Tidak ada kerja UE sebelum I.3
(9 komposisi + fps guard) centang.
