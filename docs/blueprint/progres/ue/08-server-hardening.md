# 08 — SERVER HARDENING (MMORPG otoritatif, EVE-grade)

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
