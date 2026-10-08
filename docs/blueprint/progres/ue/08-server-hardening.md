# 08 — SERVER HARDENING (MMORPG otoritatif, EVE-grade) — VERSI SEMPURNA

> Status: **AUDIT FINAL + RENCANA AAA** (rev 2). Tanggal: 2026-10-04.
> Induk: `00-migrasi.md` §0 (server = otoritas), `03-implementasi.md` §1
> (file 🟢 jangan disentuh tanpa review), `06-gameplay-systems.md` §0–§1.
> Prinsip satu kalimat: **UE5 = mata; semua logic di server TS.**
> Anti-duplikasi: file ini TIDAK mengulang blueprint — hanya audit gap
> server + rencana penguatan.
> Rev 2 ini: riset AAA (EVE/CCP, Rockstar GTA Online, modern MMORPG
> server design) + audit baris-per-baris `packages/gameserver` — setiap
> gap punya bukti `file:line`, skenario eksploit, referensi AAA, dan
> acceptance criteria.

---

## 0. Riset referensi AAA — apa yang dipetik

### 0.1 EVE Online (CCP Games) — standar emas untuk ARCLUX
Sumber: devblog CCP (CarbonIO/BlueNet 2011, "Paint Your Ship Red" 2025,
Quasar), Gamasutra (Emilsson, single-shard), CSM8 minutes 2014, PC Gamer
(TiDi 2012), EVE support (downtime).

| Fakta EVE | Pelajaran untuk ARCLUX |
|---|---|
| **Single-shard** (Tranquility), ~250 node, 1 solar system = 1 node | Shard = region ARCLUX (D-006) sudah benar; 1 region = 1 proses server (jangan split sim 1 region ke multi-proses) |
| **Stackless Python, single-threaded per node** — 1 core CPU per node | Sim loop harus single-threaded, no mutex di tick path (lihat DDS §5). Node JS kita cocok (event loop 1 thread) |
| **Physics tick 1Hz** sengaja rendah (warisan 56k modem); interaksi non-fisik diproses secepat mungkin | Tick 10Hz kita SUDAH lebih tinggi dari EVE. Fisika tidak perlu >10Hz; yang perlu cepat adalah **responsivitas input** (server harus akui intent sebelum tick) |
| **Simulation frame** untuk cosmetic state; fanout via NATS ~10k msg/detik; **Quasar** offload cosmetic dari sim engine | Pisahkan **sim state** (authoritative, lambat) dari **presentation event** (cepat, bisa di-offload). ARCLUX belum punya jalur event terpisah — snapshot-only |
| **Time Dilation (TiDi)** — saat overload, sim diperlambat HONEST untuk semua pemain (slow-motion adil), bukan lag/crash | ARCLUX belum punya degradation ladder. Tick overrun harus → TiDi broadcast, bukan catch-up spiral |
| **Single database nucleus** yang mengikat seluruh dunia | `packages/db` = nucleus; persistence per region harus selalu aktif, bukan optional |
| **Event-driven invalidation**, bukan polling/rebuild | Snapshot 100ms poll kita = polling. Harus ada jalur event (delta) |
| **Derived state dibungkus & di-cache** (PlayerBrain), bukan di-recompute di hot path | `computeEntityHash` dihitung ulang tiap tick di hot path — harus cached/dirty-flag |
| **Degradation ladder dideklarasikan** (node diperkuat, player cap, fidelity budget) | Butuh `regionProfile` (solo/PvP/battle) dengan budget eksplisit |
| **Mass-testing di public test server (Singularity)**, JANGAN di live | Butuh test-region + load-test harness sebelum hardening dianggap selesai |
| Downtime harian ~15 menit, prosedur deploy/rollback disiplin | `stop()` harus save; `start()` harus resume; deploy = graceful handover |

### 0.2 Rockstar GTA Online — pelajaran anti-cheat
Sumber: RockstarINTEL, IGN, PC Gamer, Vera field guide.

- GTA Online PC **9 tahun tanpa client anti-cheat** → mod menu merajalela
  (drop money, griefing, korupsi akun). Sept 2024 baru tambah **BattlEye
  kernel-mode** → Rockstar konfirmasi (Feb 2025) "significant reduction in
  cheating".
- Jaringan GTA Online = **hybrid P2P + dedicated**; Take-Two tolak dedicated
  server penuh karena biaya.
- "Cheater pool" = isolasi pemain curang, bukan ban langsung.
- **Pelajaran**: client-trust = 9 tahun penderitaan. Garis pertama pertahanan
  adalah **server-side validation** (murah), kernel AC adalah opsi terakhir
  (mahal). Untuk ARCLUX: semua angka & kepemilikan ditentukan server —
  client bahkan tidak boleh mengirim stat (lihat gap P0-2 `/deliver`).

### 0.3 Modern MMORPG server design (DDS, open-mmorpg, Valve, tick-engine)
- **Fixed timestep + server authoritative + client prediction & reconciliation**
  (Valve HL SDK): klien prediksi gerak sendiri, server koreksi. ARCLUX punya
  interpolasi client (`updateVesselInterp`) tapi **tidak ada protokol
  reconciliation** — tidak ada ack/nack intent, tidak ada verifikasi prediksi
  (`verifyClientPrediction` ada tapi tak pernah dipanggil).
- **Interest management (AOI: aura/nimbus, grid/quadtree) + delta-compressed
  snapshot** (ACM MMORPG, open-mmorpg): client hanya terima entity dalam
  radiusnya. ARCLUX kirim **seluruh entity tiap 100ms**.
- **Deterministic sim → replay, lockstep validation, server-side
  re-simulation** (open-mmorpg): sim deterministik ARCLUX (mulberry32) sudah
  ada tapi **tidak pernah dipakai untuk verifikasi ulang** — anti-cheat level
  lanjut belum jalan.
- **Tick budget monitoring + catch-up cap** (tick-engine: `maxTickBudgetMs`,
  catch-up cap 5×, spiral-of-death guard): ARCLUX `tickScheduler` catch-up 5×
  sudah ada, tapi **tidak ada per-tick budget enforcement** dan tidak ada
  TiDi.
- **Actor isolation, supervision trees, no shared mutable state di tick path**
  (DDS): `simulation.ts` akses `region["entities"]` private Map lintas modul
  (bracket trick) — rapuh, harus jadi API resmi.
- **Grace period disconnect** (30s), **snapshot schema versioning**,
  **write-behind DB** (hot cache + PostgreSQL), **mirroring** untuk fault
  tolerance — belum ada di ARCLUX.
- Biaya downtime MMORPG: ~$26,198/jam (WoW, via ACM paper) — dasar kenapa
  persistence-on-stop bukan optional.

---

## 1. Audit keadaan sekarang (fakta, 2026-10-04)

`packages/gameserver` 40 file / ~4100 baris. Semua SUDAH jalan tapi
**belum AAA**. Tabel keadaan (dengan bukti):

| Area | Status | Bukti |
|---|---|---|
| Tick 10Hz deterministik | ✅ | `simulation.ts:95` step(), `tickScheduler.ts` fixed-timestep, `random.ts` mulberry32 |
| Validator | 🚧 sebagian | `validator.ts:41` — identity/owner/range/cooldown/safezone/license/dock. **Banyak hole** (§3) |
| Combat per-subsystem + ceiling | ✅ | `combat.ts` DAMAGE_CEILING=12, cooldown per weapon |
| Gate handoff 2-fase crash-safe | ✅ | `gate.ts` persist-before-remove, `bridge.ts`, `persistence.ts` handoff store |
| Persistence | 🚧 setengah | `persistence.ts` ada, **tapi tidak pernah dipanggil server** (§3 P0-1) |
| Physics/thermal/collision/cosmic | ✅ | `physics.ts` `thermics.ts` `collision.ts` `cosmicEvent.ts` `environs.ts` |
| Transport HTTP | ✅ | `transport/*` POST /intent GET /snapshot POST /deliver |
| Emergency 10.E (adrift→falling→crashed) | ✅ | `vesselState.ts` nextEmergencyState, `simulation.ts:350` stepEmergency |
| Auth | ❌ nol | `server.ts:99` defaultAuthProvider = trust any playerId |
| Rate limiting / stability | ❌ mati | `rateLimiter.ts` `stability.ts` ada, **tidak di-wire** |
| Interest management / delta snapshot | ❌ | snapshot penuh tiap poll; `WebSocketTransport.ts` cuma helper |
| Time dilation / degradation ladder | ❌ | tidak ada |
| Event store / replay persisten | ❌ | `replayLog()` in-memory (`simulation.ts:159`) |

---

## 2. Eksploit kritis (buka dulu sebelum sprint fitur)

Ini bukan "gap fitur" — ini **lubang otoritas** yang bisa dieksploit hari ini:

### E-1. Pencurian component via `trade_component` — KRITIS
- **Bukti**: `validator.ts:89-99` hanya cek `componentId` ada + tidak
  depleted. **Tidak** cek apakah aktor memilik vessel penjual.
  `simulation.ts:257-289` lalu scan SEMUA entity untuk component itu dan
  `splice` ke vessel pembeli.
- **Eksploit**: pemain A kirim intent `{entityId: <vessel A>, type:
  "trade_component", payload: {componentId: <component milik B>,
  toVesselId: <vessel A>}}` → component B berpindah ke A. Validasi lolos
  karena yang dicek cuma kepemilikan `entityId`, bukan seller.
- **Fix**: validator harus resolve seller dari `componentId`, cek
  `seller.owner === ctx.playerId` (atau seller = karakter di vessel aktor),
  dan sim harus pakai seller yang sudah divalidasi (bukan scan ulang).
- **Referensi AAA**: kepemilikan asset = server authority 101 (EVE: asset
  transaction selalu dua-fase consent).

### E-2. `POST /deliver` = forge vessel tanpa batas — KRITIS
- **Bukti**: `server.ts:156-163` — tanpa auth, menerima `VesselModel`
  arbitrer dari wire (`h.vessel`), lalu `region.spawnVessel(...)`.
- **Eksploit**: siapa saja POST `/deliver` dengan vessel `{integrity: 100,
  weapons: 100, components: [...]}` → kapal god mode masuk region.
  `deliver` seharusnya hanya dipanggil oleh **relay gate handoff** antar
  server terpercaya, bukan publik.
- **Fix**: (a) token handoff signed (HMAC, server-to-server), (b) verifikasi
  `VesselModel` terhadap `buildVesselModel(analyzeRepository(...))` — server
  yang re-derive stat, tidak menerima stat dari klien (D-008), (c) IP
  allow-list untuk route ini.
- **Referensi AAA**: GTA Online — client tidak pernah menentukan stat; EVE —
  ship fit ditentukan oleh fit yang tersimpan di DB server.

### E-3. `stop()` tidak save + `start()` tidak resume — D-013 dilanggar — KRITIS
- **Bukti**: `server.ts:224-228` `stop()` hanya tutup scheduler + HTTP.
  Tidak ada `saveSnapshot`. `server.ts` **tidak pernah import**
  `persistence.ts`/`regionState.ts` — jadi `start()` juga tidak pernah
  `loadAndResume` (`regionState.ts:14` ada tapi yatim).
- **Dampak**: restart = world reset. Bertentangan langsung dengan D-013
  ("server restart ≠ world reset") dan `persistence.ts:15` yang menjanjikan
  recovery. Persistence ada tapi tidak wired ke lifecycle server.
- **Fix**: `createGameServer` opsi `persistence?: PersistenceStore`;
  `start()` → `loadAndResume` (atau region kosong kalau belum ada);
  `stop()` → `saveSnapshot` sebelum tutup; periodic autosave (tiap 100 tick,
  `shouldSnapshot` dari `stability.ts:32` sudah ada).
- **Referensi AAA**: EVE downtime harian dengan world tetap utuh; DDS
  write-behind + graceful shutdown.

### E-4. Intent replay + no idempotency di `/intent` — TINGGI
- **Bukti**: `server.ts:146-153` menerima `POST /intent` apa adanya. `seq`
  dari klien **tidak** dicek monotonik server-side (idempotency seq cuma ada
  di `relay/gate.ts` untuk handoff, bukan untuk intent).
- **Eksploit**: capture & replay serangkaian intent `attack` — cooldown
  membatasi, tapi intent `move`/`scan`/`trade` bisa di-replay; dan intent
  yang sama bisa diproses 2× dalam race.
- **Fix**: server simpan `lastSeq` per (playerId, entityId); reject
  `seq <= lastSeq` ("stale/duplicate"). Ack intent dengan seq + verdict
  (`accepted`/`rejected`) supaya client bisa reconciliation.
- **Referensi AAA**: Valve — server mengoreksi prediksi client; open-mmorpg
  — input-queue dengan seq.

### E-5. Determinisme bocor di `spawn_station` — TINGGI
- **Bukti**: `simulation.ts:292` `stationId = ...Date.now() % 100000` dan
  `simulation.ts:299` `Math.random() * 2000` untuk posisi.
- **Dampak**: ID tabrakan mungkin, posisi tidak reproducible, replay log tidak
  bisa merekonstruksi world state yang sama (melanggar D-008 deterministic +
  Layer I.8 replay). `random.ts` (mulberry32) memangnya ada untuk ini.
- **Fix**: id dari `${regionId}:st:${tick}:${eventSeq}`; posisi dari
  seeded rng (`createSeedRng(regionId+tick)`), bukan `Math.random()`.

---

## 3. Gap registry super-detail (P0 → P3)

Format tiap gap: **bukti** (file:line) → **skenario** → **fix** →
**acceptance criteria** → **referensi AAA**.

### P0 — Otoritas tidak nyata tanpa ini

**P0-1 Lifecycle persistence belum wired** (E-3 di atas).
Acceptance: `serve --vessel` → kill -9 → `serve` lagi → vessel & tick
tersimpan; `git`-style crash test: kill saat tick berjalan, world tidak
corrupt (RecoveryManager WAL).

**P0-2 Auth nol** — `server.ts:99-101` `defaultAuthProvider()` = "any
playerId trusted". Siapa saja kirim intent atas nama siapa saja (validasi
`intent.playerId === ctx.playerId` di `validator.ts:46` tidak berguna kalau
playerId self-declare).
- Fix: `POST /login` → signed token (HMAC-SHA256 + exp, atau Ed25519);
  intent wajib `Authorization: Bearer`; `authProvider` decode token →
  `ValidatorContext` dengan `ownedComponentIds`/`grantedComponentIds`
  (`universe/license.ts:28` AuthorizationContext sudah ada).
- Acceptance: intent tanpa token = 401; token expired = 401; intent dengan
  playerId ≠ token subject = reject `validator.ts:46`.
- AAA: EVE SSO/SSO-style token; GTA — identity server terpusat.

**P0-3 `/deliver` tanpa auth + forge vessel** (E-2 di atas).

**P0-4 `rateLimiter.ts` & `stability.ts` MATI** — tidak di-wire ke
`server.ts`/`simulation.ts`.
- Fix: rateLimiter di POST /intent (per `playerId@ip`, token bucket 20/s
  burst 40, shadowban 10 violations); `stability.checkStability` di awal
  `step()` (entity cap 5000, tick budget 80ms, eventlog 10k → reject
  `entity_cap`/`tick_overbudget`/`eventlog_overflow`).
- Acceptance: bot 1000 intent/s → 429 + shadowban; 5001 entity → spawn
  ditolak.
- AAA: EVE — request flood tidak boleh mengganggu pemain lain.

**P0-5 Directory in-process, tanpa HTTP API** — `packages/directory`
registry Maps in-memory; client (UE/Electron) tidak bisa discovery shard.
- Fix: `GET /servers` (filter status/visibility/federation) + heartbeat
  endpoint; **heartbeat loop** di `server.ts` (saat ini `server.ts:209`
  heartbeat dipanggil 1× saat start → directory menampilkan ONLINE selamanya
  meski server mati). TTL 30s; heartbeat tiap 10s; mati → OFFLINE otomatis.
- Acceptance: matikan server → ≤30s kemudian tidak ada di `listServers`.

**P0-6 Multi-shard in-process only** — `bridge.ts` prototype 2 shard 1
proses. Produksi = 1 proses per region + IP allow-list + token handoff
cryptograph (bukan heuristic `sanitizeToken` `relay/gate.ts:44` yang bisa
dibobol dengan string tanpa substring terlarang).

### P1 — Validator belum lengkap (otoritas fitur)

**P1-1 Eksploit trade_component** (E-1 di atas).

**P1-2 Intent `spawn` dead code** — `validator.ts:105` default-reject
semua type tak dikenal (termasuk `"spawn"`), tapi `simulation.ts:240-244`
masih handle `"spawn"`. Dead code yang membingungkan: hapus salah satu.

**P1-3 `scan` tanpa biaya** — `validator.ts:78-79` accept tanpa cooldown/cost
→ intel spam (`simulation.ts:221-226` log daftar entity id lengkap).
Fix: cooldown per vessel (mis. 10 tick) + range cap + payload terbatas
(id + faction class saja, bukan detail — lihat juga P2-4 privacy).

**P1-4 Tether radius (FPS_TETHER 1000m, `01-assets.md` §5)** belum
di-enforce server — client saja. Fix: validator cek jarak character/player
ke vessel induk (`CharacterEntity.vesselId`) saat `move` FPS.

**P1-5 Wanted/eskalasi/blacklist (`05-hukum-kota.md` §2)** belum ada.
Butuh `packages/wanted`: record `{wantedLevel,lastSeen,disguise}`, trigger
(kejahatan ≥ threshold), eskalasi 0→5, decay waktu, blacklist.

**P1-6 Economy integrity (`06-gameplay-systems.md` §1)** — OC debit/kredit,
pajak 5% P2P, Company Store belum ada. Tanpa ini cheat OC trivial (klien
bisa klaim balance). Butuh `packages/economy` dengan **semua transaksi
server-side**, tx log immutable, idempotency key per tx.

**P1-7 Klaim tanah (`02-asset-pipeline.md` §8.5/§9)** — patok 7 hari,
sertifikat, anti-serakah 3 petak/pemain, garis pantai 10m publik — belum ada.

**P1-8 Dual skill / activeMode (`06-gameplay-systems.md` §2.5)** — player
state belum menyimpan mode (SHIP/FPS). Fix: `PlayerSession.activeMode`
persisten, validator tolak intent yang tidak cocok dengan mode.

**P1-9 Hack targets/loot (`06-gameplay-systems.md` §3.4)** belum ada.

### P2 — Skala & integritas dunia

**P2-1 Full-state snapshot tiap 100ms** — `server.ts:138-141` kirim seluruh
`region.snapshot()` per poll. Boros: bandwidth ∝ entity².
- Fix bertahap: (a) **interest management** — `interestFiltered` sudah ada di
  `WebSocketTransport.ts:17` (radius 5000m) tapi **tidak dipakai**; (b)
  **delta snapshot** — client kirim `lastTick`, server kirim entity yang
  berubah sejak itu (event sourcing dari event store P2-2); (c) kompresi
  binary (bukan JSON) untuk jalur UDP nanti.
- AAA: EVE — "simulation frame" hanya untuk entity dalam bubble yang sama;
  open-mmorpg — AOI grid/quadtree + delta compression.

**P2-2 Event log tidak persisted** — `simulation.ts:78` `eventLog` array
in-memory, tumbuh tanpa batas (`stability.ts` cap 10k tidak wired). Perang &
Hall of Fame (blueprint 04) butuh **event store append-only immutable**
(JSONL per region + rotate).
- Fix: `EventStore.append(event)` → JSONL; `replayLog()` baca dari store;
  rotate per 10k event / 24 jam.
- AAA: EVE — semua kejadian tercatat untuk audit; DDS — event log sebagai
  source of truth replay.

**P2-3 Time Dilation / degradation ladder belum ada** — saat tick overrun
(`tickScheduler` catch-up 5×), sim spiral atau drop. Tidak ada TiDi.
- Fix: ukur `tickDuration` (`simulation.ts:124` sudah pakai `Date.now()`);
  jika > budget (mis. 80ms) → masukkan mode dilated: `dt` efektif diperlambat
  (0.5×, 0.25×), **diumumkan ke client** via event `region.dilated` (semua
  pemain slow-motion adil — EVE TiDi), dan/atau aktifkan budget per sistem
  (cosmic events di-skip dulu, priority queue).
- Acceptance: load-test 500 entity + 100 intents/tick → TiDi aktif, tidak
  ada crash, tidak ada catch-up spiral.
- AAA: EVE TiDi (PC Gamer 2012: 1400+ pemain, no crash) — ini *signature*
  EVE dan ARCLUX harus punya sebelum klaim "EVE-grade".

**P2-4 Snapshot leak privasi** — `RegionSnapshot` (`types.ts:105`) mengirim
`vessel.components` lengkap (termasuk komponen **private** + provenance) ke
SEMUA client. Pemain bisa scout komponen private lawan.
- Fix: `sanitizeSnapshot(snapshot, viewerPlayerId)` — komponen non-public
  di-redact (`{id, capability}` saja, tanpa label/provenance) kecuali viewer
  = owner atau berwenang. License tier (`universe/license.ts`) jadi dasar
  visibilitas.
- AAA: EVE — intel tentang kapal lawan terbatas (sensor strength), bukan
  terbuka.

**P2-5 Anti-desync tidak jalan** — `computeEntityHash` (`simulation.ts:435`)
dihitung & di-LOG tiap tick tapi **tidak pernah dibandingkan**;
`verifyClientPrediction` (`simulation.ts:443`) tidak pernah dipanggil.
Selain itu hash **tidak cover `emergency`** (`types.ts:63`) → desync state 10.E tak terdeteksi.
10.E tak terdeteksi.
- Fix: (a) tambahkan `emergency` + `heading` ke hash; (b) client kirim
  hash prediksi tiap N tick; server bandingkan → mismatch → kick prediksi &
  force resync; (c) server re-simulation berkala (deterministic replay dari
  event store) untuk verifikasi independen.
- AAA: Valve — prediction error correction; open-mmorpg — server-side
  re-simulation untuk anti-cheat.

**P2-6 Determinisme lintas proses belum dibuktikan** — tidak ada test yang
menjalankan 2 replica sim dari event log yang sama dan membandingkan
`worldHash` (`stability.ts:26`) periodik.
- Fix: harness test: replay event log yang sama di 2 engine → hash harus
  sama persis. Masuk CI.

**P2-7 `WebSocketTransport.ts` cuma helper** — `createWsInterestServer`
(`:41`) **bukan** WebSocket server (nama menyesatkan); `compressSnapshot`
membungkus JSON (komentar sendiri akui "real compress would use pako").
- Fix: implementasi WS sungguhan (ws/uWebSockets) dengan binary snapshot +
  interest filter, atau ganti nama jadi `InterestFilter` yang jujur.

**P2-8 Snapshot tanpa versi** — `RegionSnapshot` tidak punya `schemaVersion`.
Perubahan world model (field entity baru) akan mematahkan save lama.
- Fix: `schemaVersion: 1` di snapshot; `loadRegion` validasi versi &
  migrasi (atau tolak dengan pesan jelas).

**P2-9 Hot path private Map access** — `simulation.ts:139/145/263/314/398`
akses `this.region["entities"]` (private Map) via bracket trick, juga
`collision.ts`/`thermics.ts`/`governance.ts`. Berfungsi tapi rapuh —
refactor `world.ts` harus update 5+ file tanpa kompiler protes.
- Fix: API resmi `WorldRegion.eachEntity(cb)` / `vessels()` / `entries()`.

### P3 — Operasional

**P3-1 `readBody` tanpa batas ukuran** (`server.ts:81-90`) — DoS memori:
POST 1GB JSON → `chunks` membengkak. Fix: batas 1MB, `413` kalau lebih.

**P3-2 Tidak ada lifecycle koneksi** — client hanya poll; server tidak tahu
siapa online; `population` heartbeat = jumlah entity (`server.ts:209`),
bukan jumlah pemain. Fix: `POST /join` (session + grace period disconnect
30s ala DDS), presence map, population = unique playerId.

**P3-3 `safeZoneBlocked` O(n) radius 1e6m** (`validator.ts:160-170`) —
scan semua entity per validasi attack; efektif "stasiun mana pun di region".
Fix: spatial index (grid) atau precompute set station per region.

**P3-4 Observability tipis** — `observability.ts` hanya tick trace (max
1000). Butuh Prometheus counters (intent accepted/rejected rate, reject
reason histogram, tick duration p99, dilated ticks), latency, drop rate.
`toPrometheus` (`observability.ts:37`) sudah ada tapi hanya 3 metric.

**P3-5 Tidak ada integration test lintas shard** — handoff cross-process
belum pernah diuji (relay in-memory saja). Fix: docker-compose 2 region +
gate handoff e2e test.

**P3-6 `require()` di modul ESM** — `validator.ts:72/94`, `simulation.ts:285`
pakai CommonJS `require()` di dalam ESM. Berjalan di bundler tapi rapuh di
native ESM/tsx. Fix: static import.

**P3-7 Backup & retention** — tidak ada rotation backup region (JSONL region
record bisa korupsi tanpa history). Fix: rotate `region-<id>.json` harian,
retensi 7 hari.

**P3-8 Tidak ada admin/audit trail** — `spawn_station`, `deliver`, `teleport`
tidak ada log admin terpisah. Fix: `admin` event category dengan actor =
operator, immutable.

**P3-9 Client poll tanpa backoff** — `net.ts` poll 100ms tanpa backoff saat
server error → thundering herd saat server pulih. Fix: exponential backoff
500ms→5s saat 5xx, reconnect jitter.

**P3-10 Static file server tanpa kepala** — `serveStaticFile` (`server.ts:260`)
baik (ada traversal guard), tapi tidak ada `Cache-Control` versioning untuk
asset, tidak ada size cap, tidak ada HEAD. Fix: ETag + immutable cache untuk
asset hashed.

---

## 4. Rencana eksekusi (sprint, satu sprint = satu PR, gate merah = STOP)

Setiap sprint wajib lulus checklist §6. Urutan prioritas = tutup eksploit
dulu, lalu otoritas, lalu skala, lalu operasional.

### Sprint 1 — "Waras dulu" (P0 eksploit + auth) — SELESAI (PR #775)
- [x] Tutup E-1 (trade theft): validator resolve seller + ownership check;
      sim pakai seller tervalidasi. (`resolveTradeSeller`/`actorOwnsSeller`
      di validator + dipakai lagi di sim = defense-in-depth 2 lapis)
- [x] Tutup E-2 (`/deliver`): signed handoff token (HMAC), server re-derive
      VesselModel (tidak terima stat dari wire), IP allow-list.
      (`auth.ts` signHandoff/verifyHandoff ±60s timingSafeEqual;
      `sanitizeVesselModel` clamp+recompute agregat; `rederiveVessel` hook)
- [x] Tutup E-3 (lifecycle): `persistence` option di `createGameServer`,
      `start()` → `loadAndResume`, `stop()` → `saveSnapshot`, autosave tiap
      100 tick. (+ resume via `isValidResume` + `world.restore`, `serve`
      default ON, `--no-persist` untuk matikan)
- [x] Tutup E-4 (replay): per-player `lastSeq`, reject stale, ack intent
      (seq + verdict).
- [x] Tutup E-5 (determinisme): id & posisi `spawn_station` dari seeded rng.
      (`createSeedRng` FNV-1a; Math.random/Date.now di sim path = 0)
- [x] Auth: `POST /login` → Bearer token (HMAC+exp), intent wajib token.
      (401 tanpa/expired/forged; identity mismatch → rejected;
      `HttpClientTransport` auto-login + retry 401; handoffSigner opt-in)
- [x] Wire `rateLimiter` (POST /intent) + `stability.checkStability` (tick loop)
      + shadowban. (429 + shadowban flag; stability_trip → trim separuh;
      entity cap → spawn_rejected; eventlog_overflow)
- [x] `GET /servers` directory endpoint + heartbeat loop 10s + TTL 30s.
      (visibility/federation/status filter, `effectiveStatus`)
- [x] Batasi `readBody` 1MB. (`MAX_BODY_BYTES` → 413)

> Regresi: `tests/server-hardening-sprint1.test.ts` 20 test (E-1..E-5,
> auth, 413, 429, sanitize D-008, save/resume, entity cap, /servers TTL).

**Definisi done Sprint 1**: semua eksploit E-1..E-5 punya regresi test
(replay intent curian → reject; forge deliver → 403; kill -9 → world utuh);
`npx tsc --noEmit` bersih; smoke test QUICKSTART-MMO.md masih jalan.

### Sprint 2 — Otoritas fitur (P1)
- [ ] Validator: tether, wanted gate, hack cooldown, OC cost, klaim radius,
      activeMode, scan cooldown.
- [ ] Hapus dead code intent `spawn` (P1-2).
- [ ] Paket `packages/economy` (OC, pajak 5%, Company Store, P2P tx log +
      idempotency key).
- [ ] `packages/wanted` (eskalasi/blacklist).
- [ ] Snapshot sanitasi per-pemirsa (P2-4).

### Sprint 3 — Skala (P2)
- [ ] Interest management + delta snapshot (pakai `interestFiltered`,
      client kirim `lastTick`).
- [ ] Event store append-only JSONL + rotate (P2-2).
- [ ] Time Dilation + degradation ladder + broadcast `region.dilated` (P2-3).
- [ ] Anti-desync: hash cover emergency, client prediction check, re-simulation
      harness (P2-5/P2-6, masuk CI).
- [ ] WebSocket transport sungguhan (P2-7).
- [ ] Snapshot `schemaVersion` + migrasi (P2-8).
- [ ] API resmi entity iteration (P2-9).
- [ ] Spatial index untuk safe-zone (P3-3).

### Sprint 4 — Multi-proses & federation (P0-6)
- [ ] 1 proses per region; relay sebagai registry terpusat (persist ke
      `packages/db`, bukan Map in-memory).
- [ ] Token handoff cryptograph (Ed25519), in-flight recovery, event record.
- [ ] Identity lintas shard persist + auth playerId.
- [ ] Integration test lintas shard (docker-compose 2 region + gate e2e).

### Sprint 5 — Dunia MMO (P1 lanjutan + P3)
- [ ] Wanted/prison/bounty (`05-hukum-kota.md`).
- [ ] Dual skill + FPS skills (`06-gameplay-systems.md` §2).
- [ ] Crafting queue + lifecycle 30h / 1–2 th (`02-asset-pipeline.md` §3–4).
- [ ] Klaim tanah (patok 7 hari, sertifikat, anti-serakah, pantai 10m).
- [ ] Prometheus metrics lengkap (P3-4), backup rotation (P3-7), admin audit
      trail (P3-8), client backoff (P3-9), static ETag (P3-10).

### Sprint 6 — Load & verifikasi AAA
- [ ] Load-test harness (mass-testing ala EVE Singularity): 500 entity,
      100 intents/tick, 100 client poll — ukur p99 latency, tick p99,
      bandwidth/client.
- [ ] Public test-region (pemisahan test vs live).
- [ ] Determinism certificate: replay event log → worldHash identik di 2
      proses (dokumen + CI).
- [ ] Acceptance banded: screenshot client TS vs UE5 identik (sudah jadi
      milik `04-graphics.md`).

---

## 5. Invariant desain (tidak bisa ditawar)

1. **Client tidak pernah otoritas** (D-008/I-1). Stat vessel selalu
   di-derive server (`buildVesselModel`), tidak pernah diterima dari wire.
2. **Determinisme adalah hukum** — `Math.random()`/`Date.now()` dilarang di
   sim path (E-5); semua rng dari `random.ts`.
3. **Persistence selalu on** — persistence bukan optional; lifecycle server
   wajib save-on-stop + resume-on-start (D-013).
4. **Semua transaksi asset butuh consent + idempotency** (E-1, P1-6).
5. **Snapshot = tampilan, bukan kebenaran penuh** — sanitasi per-pemirsa
   (P2-4), delta + interest (P2-1).
6. **Degradasi jujur** — overload → TiDi (slow-motion adil), bukan lag
   atau crash (P2-3).
7. **Wire types single source of truth** — `packages/gameserver/types.ts`
   untuk TS, `UE5Types.h` mirror 1:1 untuk UE5 (kontrak `03-implementasi.md`
   §2.1); perubahan kontrak wajib mirror dulu sebelum client di-port.
8. **Setiap gap yang ditutup wajib punya regresi test** — bukan cuma
   typecheck (TOOLING.md verification standard).

## 6. Checklist verifikasi tiap PR

```
[ ] node scripts/build-game.mjs — bundle sukses
[ ] npx tsc --noEmit -p apps/game/tsconfig.json — bersih
[ ] npx tsc --noEmit -p packages/gameserver/tsconfig.json — bersih
[ ] grep -rn "innerHTML.*+" apps/game/src/renderer/ — 0 match
[ ] grep -rn "Math.random()" packages/gameserver/ — 0 match (kecuali random.ts)
[ ] arclux_detect orphan_files scope REPO-ROOT — 0 file yatim baru
[ ] node scripts/check-mmo.mjs — OK
[ ] Regresi test untuk gap yang ditutup (§4 sprint) — PASS
[ ] MMO-IMPLEMENTATION.md §2 + §3 di-update (file + PR)
[ ] docs/ di-add pakai git add -f (docs/ gitignored)
[ ] Manual test: serve --vessel → landing → cockpit (QUICKSTART-MMO.md)
```

## 7. Batasan
- UE5 tidak pernah menentukan angka (D-008).
- Semua perubahan kontrak di sini wajib mirror ke `UE5Types.h` sebelum
  client di-port.
- Satu sprint = satu PR (pola slice). Gate merah = STOP.
- Tidak ada fitur MMO baru di atas gap P0-1..P0-6 — otoritas dulu, fitur
  kemudian (urutan EVE: mereka kuat karena nucleus & TiDi, bukan karena
  fitur).
=======
# 08 — SERVER HARDENING (MMORPG otoritatif)

> Status: **DRAFT v2 — AUDIT LENGKAP + RENCANA RINCI.** 2026-10-04.
> Induk: `00-migrasi.md` §0 (server = otoritas), `03-implementasi.md` §1,
> `06-gameplay-systems.md` §0–§1, `05-hukum-kota.md`, `02-asset-pipeline.md`.
> Prinsip satu kalimat: **UE5 = mata; semua logic di server TS.**
> Anti-duplikasi: file ini TIDAK mengulang blueprint — ini audit gap
> server + solusi teknis per gap.

---

## 0. Kondisi sekarang (fakta, bukan klaim)

`packages/gameserver` 3428 baris / 30 file. Yang SUDAH jalan:

| Area | Status | Bukti |
|---|---|---|
| Tick 10Hz deterministik | ✅ | `simulation.ts` `tickScheduler.ts` `random.ts` (mulberry32) |
| Validator inti | ✅ | `validator.ts` — identity/range/cooldown/safezone/license/dock/flightBlocked |
| Combat per-subsystem + ceiling | ✅ | `combat.ts`, damage level |
| Gate handoff 2-fase + token anti-clone + recovery | ✅ | `gate.ts` `bridge.ts` `persistence.ts` |
| Persistence crash-safe (JSON per record) | ✅ | `persistence.ts` RecoveryManager |
| Environs / collision / thermics / cosmic | ✅ | `environs.ts` `collision.ts` `thermics.ts` `cosmicEvent.ts` |
| Transport HTTP (POST /intent, GET /snapshot, /deliver, /health) | ✅ | `server.ts`, `transport/*` |
| WebSocket transport | ✅ kode, belum default | `transport/WebSocketTransport.ts` |
| RateLimiter + stability guard | ⚠️ ada, MATI | `rateLimiter.ts` `stability.ts` tidak di-wire |
| Directory shard registry | ⚠️ in-process, no HTTP | `packages/directory` |
| Auth | ❌ | `defaultAuthProvider()` = "any playerId trusted" |

---

## 1. Gap — P0 (otoritas bohong tanpa ini)

### P0-1. Tidak ada auth/session
- **Gap**: `server.ts:99` — `defaultAuthProvider` mempercayai `playerId`
  mentah. Siapa saja bisa kirim intent atas nama siapa saja.
- **Dampak**: impersonasi, cheat trivial, tidak ada cara legal dapat playerId.
- **Solusi**: tambah `POST /login` → `{ playerId, token: HMAC(secret, playerId|exp) }`.
  Intent wajib `Authorization: Bearer <token>`; validator verifikasi signature
  + exp. Secret dari env `ARCLUX_AUTH_SECRET`. Unit test: token rusak/expired → 401.

### P0-2. `rateLimiter.ts` & `stability.ts` MATI
- **Gap**: tidak di-import `server.ts`.
- **Dampak**: spam intent tak dibatasi; tick over-budget tak dihentikan;
  shadowban tidak pernah jalan.
- **Solusi**: di `server.ts` — wrap `POST /intent` dengan `allow(playerId, ip)`;
  di tick loop: `checkStability(region, tickMs, eventLog.length)`; kalau tidak ok
  → skip tick + counter OTEL. Wire `shadowbanned` ke respons 403.

### P0-3. Directory tanpa HTTP
- **Gap**: `packages/directory/registry.ts` in-process saja; tidak ada endpoint.
- **Dampak**: UE & client tidak bisa discovery shard; server browser manual.
- **Solusi**: tambah `GET /servers` di `server.ts` (reuse `listServers()`),
  filter `status=ONLINE`. Dokumentasikan di QUICKSTART.

### P0-4. In-process multi-shard
- **Gap**: `bridge.ts` prototype 2 shard 1 proses.
- **Dampak**: crash 1 shard → semua mati; tidak bisa scale host.
- **Solusi**: jalankan tiap region via `createGameServer` di proses terpisah
  (docker/ systemd template), directory di proses tersendiri (atau instance
  kecil), IP allow-list antar shard, shared db JSON per region.

---

## 2. Gap — P1 (validator & fitur belum jadi otoritas)

### P1-1. Tether radius (01-assets §5)
- **Gap**: kapal/FPS bisa "teleport" di intent move; radius tether 1000m
  hanya client.
- **Solusi**: validator cek `distance(entity, vesselAnchor) <= 1000` untuk
  intent FPS-character; kapal = anchor sendiri.

### P1-2. Wanted system (05 §2)
- **Gap**: tidak ada record player, trigger, eskalasi, blacklist, disguise.
- **Solusi**: paket `packages/wanted` — record invisible di server, trigger
  kejahatan (kill/kerusuhan/curi), wantedLevel 0–5, `lastSeen {chunkKey, tick}`,
  disguise flag; validator gerbang tolak level ≥3 masuk kota.

### P1-3. Economy integrity (06 §1)
- **Gap**: OC tidak ada, pajak 5% belum, tx log belum.
- **Solusi**: `packages/economy` — ledger append-only per player
  (`packages/db` collection `wallets`), semua mutation OC via tx
  (`debit`, `credit`, pajak 5% → treasury world). Company Store & P2P =
  dua tx berpasangan + log.

### P1-4. Klaim tanah (02 §8.5/§9)
- **Gap**: claim beacon / patok 7 hari / anti-serakah 3 petak / garis pantai
  10m publik belum ada.
- **Solusi**: `packages/claims` — claim 100×100m via claimId, timestamp;
  patok hangus setelah 7 hari tanpa bangunan; max 3 petak per player;
  garis pantai tidak bisa diklaim (validator cek coastal band).

### P1-5. Dual skill / activeMode (06 §2.5)
- **Gap**: player state tidak simpan `activeMode`.
- **Solusi**: `VesselEntity`/session state tambah `activeMode`; server
  transisi saat dock/exit interior.

### P1-6. Hack targets (06 §3.4)
- **Gap**: hack belum ada di validator/sim.
- **Solusi**: intent `hack` (baru) dengan cooldown 60s/target,
  3-fail alarm + wanted+2, computer HP=100.

---

## 3. Gap — P2 (skala & integritas dunia)

### P2-1. Full-state snapshot boros
- **Gap**: `GET /snapshot` kirim seluruh entity tiap 100ms ke semua client.
- **Solusi**: interest management — server kirim `entitiesWithin(vessel, R)`
  per-vessel (R ~ 5000m), + event delta antar snapshot; WebSocket sudah ada,
  jadikan default.

### P2-2. Event log tidak persisted
- **Gap**: `replayLog` di memori saja.
- **Solusi**: append-only JSONL per region di `packages/db` (`events` collection),
  rotate, cap 10k in-memory.

### P2-3. No replica hash-check
- **Gap**: `worldHash()` ada tapi tidak dipakai.
- **Solusi**: cron periodik (mis. tiap 100 tick) kirim hash ke OTEL; 2 replica
  sim → compare hash, alert kalau beda.

### P2-4. Handoff token belum crypto kuat
- **Gap**: `relay/gate.ts` TODO: token cryptograph, in-flight recovery, event record.
- **Solusi**: token = `HMAC(secret, vesselId|fromShard|seq|exp)`, idempotent seq,
  pending handoff JSON persist (sudah ada) + event record.

### P2-5. Identity belum persist
- **Gap**: `relay/identity.ts` TODO persist db + auth playerId.
- **Solusi**: identity record di db collection `identities`, per-player
  presence update atomic saat gate handoff.

---

## 4. Gap — P3 (operasional & keamanan jaringan)

### P3-1. `/deliver` & `/intent` tanpa body size cap
- **Gap**: `readBody` baca tanpa limit.
- **Solusi**: batas 64KB, balas 413.

### P3-2. `PayloadJson` tanpa schema check
- **Gap**: JSON mentah biasa lolos.
- **Solusi**: validate shape per intent type di validator sebelum `case`.

### P3-3. `/deliver` tidak di-rate-limit
- **Gap**: spam spawn vessel.
- **Solusi**: rateLimiter juga untuk `/deliver`.

### P3-4. Tick loop drift
- **Gap**: fix-step tanpa kompensasi saat `step()` berat.
- **Solusi**: track `tickMs` real vs budget 80ms; over → skip + count;
  alert OTEL.

### P3-5. No metrics/alerting real
- **Gap**: `observability.ts` cuma tick trace.
- **Solusi**: counter (intents/s, accepted/rejected, rate-limited, tickMs
  p95, entity count) + Prometheus scrape endpoint `/metrics`.

### P3-6. No integration test lintas shard
- **Gap**: handoff cross-process & replica hash belum dites.
- **Solusi**: `tests/shard-handoff.integration.test.ts` — 2 proses `createGameServer`,
  1 vessel pindah shard, assert no dup + event log utuh.

---

## 5. Rencana eksekusi (sprint — satu PR per sprint)

**Sprint 1 — "Waras dulu"**
- [ ] P0-1 auth token + POST /login
- [ ] P0-2 wire rateLimiter + stability + OTEL counter
- [ ] P0-3 GET /servers
- [ ] P3-1 body size cap, P3-3 rate-limit /deliver

**Sprint 2 — "Otoritas fitur"**
- [ ] P1-1 tether, P1-2 wanted gerbang, P1-3 economy OC, P1-4 klaim
- [ ] P1-5 activeMode, P1-6 hack
- [ ] P3-2 schema check PayloadJson

**Sprint 3 — "Skala"**
- [ ] P2-1 interest management + WS default
- [ ] P2-2 event store, P2-3 replica hash, P2-4/5 handoff & identity crypto+persist
- [ ] P3-4 tick drift, P3-5 metrics

**Sprint 4 — "Dunia MMO"**
- [ ] Wanted full (prison, bounty, blacklist)
- [ ] Dual skill lengkap + FPS skills
- [ ] Crafting queue + lifecycle 30h / 1–2 th
- [ ] Perang & puing, discovery/plaque

---

## 6. Batasan
- UE5 tidak pernah menentukan angka (D-008).
- Kontrak baru (token, GET /servers, delta snapshot) wajib mirror ke
  `UE5Types.h` / transport UE sebelum client UE di-port.
- Gate merah = STOP, bukan lembur.

