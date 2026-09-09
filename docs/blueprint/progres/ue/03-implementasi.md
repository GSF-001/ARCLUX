# 03 — PETA IMPLEMENTASI MIGRASI UE (file per file, layer per layer)

> Ini PETA, bukan teori. Tersesat = balik ke sini. Setiap baris bilang:
> file APA, statusnya APA (tetap/baca/tulis-ulang), dan kenapa.
> Legenda: 🟢 TETAP (jangan sentuh) · 🟡 BACA (kontrak, mirror jangan
> ubah rumus) · 🔴 TULIS-ULANG (presentasi, di UE).

## §1 — BUKTI tidak bikin ulang dari 0 (file yang TIDAK disentuh)

Inilah "game"-nya. Semua 🟢. UE tidak boleh import, mengubah, atau
menduplikasi logika file-file ini — UE hanya MEMBACA outputnya
(snapshot/contract) via HTTP/JSON.

### packages/gameserver (otoritas + simulasi) — SEMUA 🟢

| File | Kenapa tetap |
|---|---|
| `simulation.ts` | Tick 10Hz + fisika + emergency. Kebenaran dunia. |
| `validator.ts` | Polisi 10-checklist + license + safe-zone. UE tidak validasi ulang. |
| `world.ts` | Registry entity + spawn. |
| `vesselState.ts` | Mesin nominal→adrift→falling→crashed. |
| `combat.ts` | Damage per-subsystem + ceiling 12. Angka dari sini SAJA. |
| `collision.ts` | KE×angle×penetration. |
| `thermics.ts` | 1/r² + overheat. |
| `cosmicEvent.ts` | Event seeded per tick. |
| `environs.ts` | Kepler + orbit body. |
| `physics.ts` | Helper Newton (UE boleh MIRROR rumus untuk prediksi visual — rumus SAMA, file tetap). |
| `gate.ts` | Handoff 2-fase antar region. |
| `bridge.ts` | Handoff-by-reference anti-clone. |
| `persistence.ts` | Crash-safe + restart≠reset. |
| `regionState.ts` | Load/resume snapshot. |
| `capability.ts` | 3 aktivasi + depleted ( + hidupkan `enforceCapitalLimit` yang mati — ITU satu-satunya "sentuh": WIRE, bukan rewrite). |
| `component.ts` | Condition + repair. |
| `lineage.ts` | Provenance (+ beri caller `recordDestruction` — WIRE, bukan rewrite). |
| `teleport.ts` | Recall/gate transit math. |
| `baseline.ts` | Imun gravitasi + breach log. |
| `governance.ts` | Safe-zone + pause ( + validator WAJIB pakai `getEffectiveSafeZone` — WIRE, bukan rewrite). |
| `tickScheduler.ts` | 10Hz no-drift. |
| `server.ts` | HTTP /snapshot /intent /deliver + static. UE ngomong ke SINI. |
| `random.ts` | mulberry32 (UE MIRROR untuk determinisme visual yang sama). |
| `rateLimiter.ts` | WIRE ke server (mati hari ini — hidupkan SEBELUM UE, anti-spam dulu). |
| `stability.ts` | WIRE ke loop (mati hari ini — hidupkan). |
| `intel.ts` · `cockpit.ts` | Registry (konsumsi saat fiturnya tiba, tetap). |
| `observability.ts` | Tick trace (tracer UE boleh kirim span ke sini — format TETAP). |
| `netcode.ts` | Kontrak net (baca sebelum tulis transport UE). |
| `types.ts` | 🟡 KONTRAK SUCI (lihat §2). |
| `index.ts` | Barrel (tambah ekspor BARU boleh, ubah existing jangan). |
| `planetary/environment.ts` | 🟡 EnvironmentalContext — RUMUS derivasi TETAP (UE mirror, §2). |
| `planetary/chunks.ts` · `planetary/geography.ts` | 🟡 Kontrak chunk + niche (UE baca). |
| `transport/*.ts` | 🟡 Kontrak Transport (UE implementasi C++-nya, kontrak SAMA). |

### packages/universe · relay · directory · db — SEMUA 🟢/🟡

| File | Status | Kenapa |
|---|---|---|
| `universe/connect.ts` | 🟢 | Repo→vessel pipeline. UE tidak ikut campur. |
| `universe/schema.ts` · `stats.ts` · `license.ts` | 🟢 | Validasi + build model + 3-tier. |
| `universe/types.ts` | 🟡 | VesselModel — UE baca (tampil), tidak tulis. |
| `relay/*` (5 file) | 🟢 | Identitas + gate federasi. |
| `directory/*` (3 file) | 🟢 | Server list (UE server-browser BACA endpoint ini). |
| `db/*` | 🟢 | Persistence. UE tidak pernah query langsung. |

## §2 — KONTRAK yang di-mirror (rumus SAMA, bahasa beda)

Pelanggaran = dua client beda perilaku = bug MMO. Daftar TERTUTUP
(tambah item = keputusan creative director):

1. `VesselEntity / StationEntity / RegionSnapshot` (gameserver/types)
   → `FArcluxVessel / FArcluxStation / FArcluxSnapshot` (C++ USTRUCT).
   Field 1:1, nama boleh gaya UE, TIPE + SATUAN sama (meter, m/s,
   tick). Ubah format = DILARANG (§0 butir 1 migrasi).
2. 10 intent (`move…spawn_station`) → JSON key SAMA persis.
3. `EnvironmentalContext` → `FArcluxEnvironment` (field 1:1).
4. `deriveGradeMood / deriveCockpitState` → fungsi C++ MURNI hasil
   IDENTIK (unit test banded: input sama → output bit-sama).
5. `mulberry32(seed)` → implementasi C++ SAMA (noise/tekstur/scatter
   konsisten dua client).
6. Token warna (`tokens.ts`) → DataTable + MPC (§6 migrasi).
   Nilai HEX sama, bukan "mirip".

## §3 — Yang DITULIS-ULANG di UE (🔴, presentasi saja)

`apps/game/src/renderer/**` SELURUHNYA = referensi, bukan untuk
di-port baris-per-baris:

| TS sekarang | UE nanti | Catatan |
|---|---|---|
| `scene3d/*` (planets/suns/belt/nebula/ark/...) | Level + Actor + Material | Perilaku dibaca, code dibuang |
| `vessels.ts` · `stations.ts` | `AVesselActor` · `AStationActor` | State dibaca, mesh baru |
| `planetary/*` visual | Niagara + Material + PlanetaryReader | Resolver jadi C++ murni |
| `cinematic/*` (9 resolver + wireC) | StormDirector + Sequencer + Post | Rumus §2 TETAP, mesin beda |
| `weapons.ts` (W1) · `damage.ts` (D1) | Niagara pool + material swap | Tabel visual SAMA |
| `cockpitGradePass/gradePass/finalTouchPass` | Post Process Material | Urutan SAMA (POST_PASS_ORDER) |
| `materials.ts` kit | Material Graph + bake T_* | Seed + recipe SAMA |
| `hud.ts` · `menu.ts` · `landing.ts` · overlay | UMG Widget | Desain + token SAMA |
| `interior.ts` | Level interior | Geometri referensi, bukan convert |
| `audio.ts` | MetaSounds synth | Parameter SAMA (freq/durasi) |
| `input.ts` | Enhanced Input (IMC + IA) | Aksi SAMA (intent sama) |
| `net.ts` | `UArcluxTransport` | Poll 100ms, kontrak SAMA |
| `settings.ts` tiers | UE Scalability +*preset sekufu* | LOW/MED/HIGH/ULTRA/CINEMATIC sama |
| `cockpitOverlay.ts` | UMG/cockpit 3D material | Pola droplet SAMA |

## §4 — Langkah + checkpoint (jalan pulang saat tersesat)

```
Slice 0 scaffold → CK: compile bersih.
Slice 1 transport + 1 vessel → CK: snapshot masuk + WASD gerak.
  TERSASAT (vessel tidak gerak)? Cek: server nyala? /snapshot ada?
  JSON field sama (§2.1)? Intent sampai (log server)? Mundur 1 langkah.
Slice 2 planet + station + dock → CK: fly→dock→interior no-crash.
  TERSASAT? Cek EnvironmentalContext parse (§2.3) + dock intent (log).
Slice 3 material + Lumen + cuaca → CK: banded screenshot mirip.
  TERSASAT (beda jauh)? Cek seed mulberry ( §2.5) + rumus mood (§2.4).
Slice 4 senjata + damage → CK: kill full + damage terbaca.
Slice 5 UMG + NPE → CK: pemain baru 5 menit ke hangar.
Slice 6 multi + shard → CK: 2 pemain 2 region + handoff.
  TERSASAT (duplikat/hilang)? Replication state MMO = DILARANG.
  Kembali ke snapshot-render. Jangan "perbaiki" dengan Replication.
```

Aturan jalan pulang: (1) baca CK slice-mu, (2) cocokkan §2 kontrak,
(3) mundur 1 slice, JANGAN maju sambil rusak. (4) Kalau 2 slice
berturut gagal CK = STOP + lapor, bukan lembur buta.

## §5 — Yang DILARANG (tempel di monitor)

1. Ubah file 🟢 demi UE. 2. Ubah rumus 🟡. 3. Replication untuk
   state MMO. 4. Convert otomatis TS→C++. 5. Port fase 10.V yang
   masih ⬜. 6. Aset tanpa LOD ke `keep/`. 7. Naro bangunan manual
   (sistem yang naro). 8. Nerf visual demi GPU kentang (tier urusan
   user). 9. Ide duplikat tanpa sumber. 10. Lanjut slice saat gate
   merah.
