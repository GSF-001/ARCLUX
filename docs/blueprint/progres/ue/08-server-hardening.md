# 08 — SERVER HARDENING (MMORPG otoritatif, EVE-grade)

> Status: **DRAFT — AUDIT + RENCANA.** Tanggal: 2026-10-04.
> Induk: `00-migrasi.md` §0 (server = otoritas), `03-implementasi.md` §1
> (file 🟢 jangan disentuh tanpa review), `06-gameplay-systems.md` §0–§1.
> Prinsip satu kalimat: **UE5 = mata; semua logic di server TS.**
> Anti-duplikasi: file ini TIDAK mengulang blueprint — hanya audit gap
> server + rencana penguatan.

## 0. Audit keadaan sekarang (fakta)

`packages/gameserver` 3428 baris / 30 file, semua paket sudah jalan:

| Area | Status | Bukti |
|---|---|---|
| Tick 10Hz deterministik | ✅ | `simulation.ts`, `tickScheduler.ts`, `random.ts` mulberry32 |
| Validator | ✅ sebagian | `validator.ts` — 10-checklist (identity/range/cooldown/safezone/license/dock) |
| Combat per-subsystem + ceiling | ✅ | `combat.ts:46`, `vertex` subsystem |
| Gate handoff 2-fase + token anti-clone | ✅ | `gate.ts`, `bridge.ts`, pending handoff crash-safe |
| Persistence crash-safe | ✅ | `persistence.ts` (RecoveryManager) |
| Physics/thermal/collision | ✅ | `physics.ts` `thermics.ts` `collision.ts` |
| Environs/cosmic event | ✅ | `environs.ts` `cosmicEvent.ts` |
| Transport HTTP | ✅ | `transport/*` POST /intent GET /snapshot |

## 1. Gap brutual (urutan prioritas)

### P0 — Otoritas tidak nyata tanpa ini
1. **`rateLimiter.ts` & `stability.ts` MATI** — tidak di-wire ke `server.ts`.
   Anti-spam & stability guard cuma file. Wire ke POST /intent + tick loop.
2. **Auth NOL** — `defaultAuthProvider()` = "any playerId trusted".
   Siapa saja bisa kirim intent atas nama siapa saja. Butuh signed token.
3. **Directory in-process** — `packages/directory` tidak ada HTTP API;
   client (UE) tidak bisa discovery shard. Butuh `GET /servers`.
4. **In-process multi-shard** — `bridge.ts` prototype 2 shard 1 proses.
   Produksi = proses per region, IP allow-list.

### P1 — Validator belum lengkap
5. **Tether radius** (01-assets §5, FPS_TETHER 1000m) belum di-enforce
   server — client saja.
6. **Wanted** (05 §2.1–2.6) — trigger/eskalasi/blacklist belum ada.
7. **Economy integrity** — OC debit/kredit, pajak 5%, transaksi P2P
   (06 §1) belum ada; tanpa ini cheat OC trivial.
8. **Klaim tanah** (02 §8.5, §9) — patok 7 hari, sertifikat, anti-serakah
   3 petak/pemain, garis pantai 10m publik — belum ada.
9. **Dual skill / activeMode** (06 §2.5) — player state belum simpan mode.
10. **Hack targets** (06 §3.4), loot, wanted consequences — belum.

### P2 — Skala & integritas dunia
11. **Full-state snapshot 100ms** — kirim seluruh entity tiap poll.
    Boros: butuhnya event delta + interest management (radius kapal).
12. **Event log tidak persisted** — `replayLog` di memori saja.
    Perang/HoF (04) butuh event store append-only immutable.
13. **No deterministic cross-check** — `worldHash` ada, tapi replica
    compare belum dijalankan periodik (anti-desync).
14. **Token handoff** — `relay/gate.ts` TODO: token cryptograph,
    in-flight recovery, event record.
15. **Identity** — `relay/identity.ts` TODO: persist db + auth playerId.

### P3 — Operasional
16. **No metrics/alerting** — observability.ts ada tapi cuma tick trace.
    Butuh Prometheus-style counter, latency, drop rate, tick budget.
17. **No integration test lintas shard** — handoff cross-process belum diuji.
18. **Transport berbasis HTTP poll** — latency & bandwidth; naik ke WebSocket
    dengan replay dari event store.
19. **Memory growth** — eventLog cap ada (10k) tapi belum rotate; persist
    + rotate JSONL.
20. **Shadowban belum dipakai** — rateLimiter shadowbanThreshold ada,
    panggilan ke server = belum.

## 2. Rencana eksekusi (sprint)

**Sprint 1 — Waras dulu**
- [ ] Wire `rateLimiter` ke POST /intent (per playerId@ip) + shadowban.
- [ ] Wire `stability.checkStability` ke tick loop (tick_overbudget →
      skip tick + counter).
- [ ] Auth: `POST /login` → signed token (HMAC+exp) → intent wajib
      `Authorization: Bearer`.
- [ ] `GET /servers` directory endpoint (reuse `packages/directory`).

**Sprint 2 — Otoritas fitur**
- [ ] Validator: tether, wanted gate, hack cooldown, OC cost, klaim radius.
- [ ] Paket `packages/economy` (OC, pajak, Company Store, P2P tx log).
- [ ] Snapshot delta + interest radius.

**Sprint 3 — Skala**
- [ ] True multi-process shard + relay federation.
- [ ] Event store append-only (JSONL) + rentang replay.
- [ ] Deterministic cross-check 2 replica (hash compare periodik).
- [ ] WebSocket transport (upgrade dari HTTP poll).

**Sprint 4 — Dunia MMO**
- [ ] Wanted/prison/bounty (05).
- [ ] Dual skill + FPS skills (06 §2).
- [ ] Crafting queue + lifecycle 30h / 1–2 th (02 §3–4).
- [ ] Perang & puing (02 §10), discovery/plaque (R1.1/R1.2).

## 3. Batasan
- UE5 tidak pernah menentukan angka (D-008).
- Semua perubahan kontrak di sini wajib mirror ke `UE5Types.h` (§2.1
  `03-implementasi.md`) sebelum client di-port.
- Satu sprint = satu PR (pola slice). Gate merah = STOP.
