# Pustaka Riset AI & Engine — temuan lintas-fitur

> **Status: FINAL (pustaka referensi).** Kumpulan temuan riset repo luar
> (sesi 2026-10-09) yang **TIDAK dimiliki satu fitur/sprint manapun** —
> berlaku untuk fitur mana pun yang butuh: NPC otonom, drone patroli
> (`05` §4.1), autopilot, wave AI (`09` §4.3), turrets, kontrak/kelompok
> (Cangyuan — **PARKED**, lihat §4), deteksi pola pemain, dan lainnya.
>
> Prinsip: **pelajari pola/IDE, jangan copy kode/ekspresi** (aturan user,
> konsisten Appendix B `09-combat-depth.md`).

---

## 0. Aturan pakai (baca dulu)

**Tier lisensi — penentu batas:**

| Tier | Repo | Yang boleh |
|---|---|---|
| **MIT / Zlib** | alife-sdk, aithena, openNPC, GOAP_Unreal, Helios (dokumen) | Port pola/kode + **tulis NOTICE attribution** saat masuk package |
| **PolyForm NC** | aeon | **IDE/DESAIN ONLY** — nol kode; lisensi non-komersial gak cocok sama MMO (store/OC). Mau serius = hubungi pemegang lisensi |
| **NONE (all-rights-reserved)** | Tactix | **IDE ONLY** — baca untuk paham, jangan ambil kode |
| Apache-2.0 | O3DE | Tidak dipakai (§3 — distractor) |

**Aturan konsumen:** temuan di sini boleh dipakai fitur mana pun TANPA
membuka kembali diskusi "ini punya siapa" — kalau port kode dari tier
MIT/Zlib, wajib NOTICE di file package penerima. Riset combat batch awal
(SpaceInvader3D / Rifle Template / Demo_ARPG) sudah tercatat di
`09-combat-depth.md` §9 — file ini tidak mengulang, cukup silang rujuk.

---

## 1. Daftar repo

| Repo | Lisensi | Isi 1-baris | Konsumen potensial |
|---|---|---|---|
| **alife-sdk** (eurusik) | MIT · TS | Online/offline duality, budget otak round-robin, faksi dua-layer, morale, SeededRandom | Strategic tick, agent budget, relasi faksi/komunitas, drone autonomy |
| **aithena** (sa-aris) | MIT · C++17 | Living-world: kontrak sosial, bukti/saksi, memori decay, influence chains, emosi, jadwal | NPC sosial, sistem saksi/investigasi (`05`), jadwal NPC, Cangyuan (parked) |
| **openNPC** (balaraj74) | MIT · Py | **LOD engine** (budget vs jarak/visibilitas/pentingan), goal priority, forgetting memory, pattern tracker | LOD simulasi apa pun, deteksi pola pemain (bounty/hack), goal system |
| **GOAP_UnrealEngine** (timotej2015) | MIT · C++ | GOAP v2: dunia = `uint64` bitmask, Dijkstra graph prebuilt, zero-alloc, multi-goal | Planner buat agen ber-goal (NPC, drone, escort AI) |
| **aeon-living-worlds** (Linutesto) | **PolyForm NC → IDE ONLY** | Tier-0 deterministik, LOD persona pool (materialize di sekitar fokus), faksi emergent, Chronicle | Validasi desain §7.5 agregat + kronik Sprint 3; inspirasi, nol kode |
| **Tactix** (CanReader) | **NONE → IDE ONLY** | Utility/GOAP/HTN/cover/influence map/squad, core bebas engine | Arsitektur layering (core testable tanpa engine), influence maps |
| **HeliosEngine** (PageMastr) | MIT (dokumen) | MMO engine Phase-0: **10 laporan riset** (EVE, SWG, server meshing, authority handoff, backends), ADR, AAA scorecard | **Bacaan perencanaan Sprint 3–4** (jaringan/skala/federasi) |
| **recastnavigation** | Zlib | Navmesh toolset industry-standard | **Back pocket**: gerakan per-meter NPC darat saat route graph gak cukup |
| **Akuma RPG Framework** (AkumaVenom) | MIT · C++/UE5 | Framework RPG: **lock-on Z-target** (LOS/range), AI spawner (aggro/spline/day-night/**performance**), combat block/parry/guard-break, server-auth + persistence akun | **Referensi PR-A lock-on (`09` §2)**, spawner/wave (`09` §4.3), FPS skills Sprint 5, pola persistence |
| **open-theft-auto** (mehulkapadia5) | MIT · Godot | Sandbox GTA: **wanted/police escalation**, distrik kota prosedural, ekonomi | Referensi implementasi `05` (kenaikan heat, patroli per distrik) — ideas (bahasa beda) |
| **O3DE** (Amazon) | Apache-2.0 | Engine 3D penuh | **SKIP** — client udah FINAL UE5 (`00-migrasi`) |

Batch combat awal (license NONE, ideas-only): SpaceInvader3D (lock-on/grace/
missile homing/AI state), Rifle Template (zonk — showcase tanpa kode),
Demo_ARPG (damage windows, combo scaling) → **sudah masuk `09` §9**.

---

## 2. Temuan kunci yang bisa dipakai di mana saja

### 2.1 alife-sdk — ritme & relasi (MIT, TS — yang paling langsung diport)

- **Budget otak round-robin**: `maxBrainUpdatesPerTick` (mis. 20 otak/tick)
  — NPC antri dirotasi, gak semua berpikir tiap tick. Dipakai strategic
  tick Cangyuan (§4.4 `10-cangyuan.md`) **dan** cocok buat sim agen apa
  pun (drone patroli berjumlah banyak).
- **Relasi dua-layer**: `base` (konstanta per jenis) + `goodwill` (dinamis,
  decay → 0 per tick, clamp, threshold hostil) — murah, stabil, gak perlu
  matriks besar. Berlaku buat faksi, komunitas, bahkan hubungan
  pemain↔NPC.
- **Handoff online↔offline**: dekat pemain = granular, jauh = agregat,
  saat pindah radius state "dibuka" dengan seeded rng → konsistensi E-5.
- **SeededRandom per-tick** — determinisme, replay, kronik identik.

### 2.2 aithena — otak sosial (MIT — spec desain, port konsepnya)

- **"Policies propose, boundaries permit"**: kebijakan ngusul aksi, batas
  keras (otoritas/hukum) yang nge-veto = **sama persis** pola validator
  server kita — jadi konsepnya validasi desain kita, tinggal bangun.
- **Evidence spread**: info/saksi menyebar antar NPC per hop (bukan
  global broadcast) — dipakai sistem saksi `05` & model informasi politik.
- **Memory decay + influence chains** — memori NPC relevansi-prioritas
  (E-5 style) + siapa mempengaruhi siapa.
- Jadwal (`schedule`), emosi, kontrak sosial dalam sim — untuk NPC yang
  "punya kehidupan".

### 2.3 openNPC — skala LOD & pola pemain (MIT — konsep TANPA torch/LLM)

- **LOD engine**: komputasi NPC diskalakan menurut **jarak/visibilitas/
  pentingan** = formally version dari desain agregat kita (§7.5
  `10-cangyuan.md`) — dipakai kapan pun jumlah agent meledak (drone,
  kerumunan, patroli).
- **Deterministic fallback chain**: berat→ringan→fallback deterministik.
  Prinsipnya cocok: yang berat (mis. LLM/RL) boleh OPTIONAL di luar
  runtime, **inti tetap deterministik**.
- **Goal priority-scored + constraint validation** — goal system ringan.
- **PlayerPatternTracker / VillainPlanner** — NPC belajar pola pemain
  (kebiasaan rute, taktik) → kaya buat bounty hunter, counter-hack, drone
  yang makin pinter baca pemain.
- **LUPAKAN**: runtime torch/RL, LLM lokal, FastAPI sidecar — lihat §3.

### 2.4 GOAP_UnrealEngine — planner efisien (MIT)

- World state = **`uint64` bitmask**; precondition/effect = operasi bit
  (`goalSet/goalClear`, `effectsSet/effectsClear`) → planning tanpa
  alokasi.
- **Graph state prebuilt saat spawn** + Dijkstra jalan per planning tick;
  cost dinamis (jarak hidup). Multi-goal berbobot dalam satu pass.
- Nilai buat kita: lapisan PERENCANA urutan langkah (utility milih "apa",
  GOAP milih "langkah 1,2,3...") buat agen ber-goal — bisa mulai dari
  drone/rute konvoi sebelum NPC politik.

### 2.5 aeon — validasi desain (IDE ONLY — PolyForm NC)

- **LOD persona pool**: "hanya warga dekat fokus yang fully materialize"
  — presisi desain agregat kita; **bukti pola ini dipakai proyek lain**.
- Sim Tier-0 deterministik + tier AI di atasnya yang cuma
  "interpret/nudge", bukan ngubah outcome — bentuk konkret prinsip
  "NO LLM tetap otoritatif".
- Chronicle (kronik sejarah ditulis sim) — arah Sprint 3 event store.
- Faksi muncul sendiri dari kepercayaan warga (emergent) — inspirasi
  fase lanjut.

### 2.6 Tactix — arsitektur layer (IDE ONLY — NONE)

- Pemisahan layer ketat: **core murni tanpa header engine** (unit-test
  tanpa buka editor) → konsep yang kita sudah jalani (framework-agnostic
  packages), jadi validasi.
- Influence maps, squad coordination, formation, cover — ide buat AI
  tempur massal nanti. v0.1.0 = muda, jangan dianggap matang.

### 2.7 HeliosEngine — bacaan perencanaan (MIT — DOKUMEN doang)

`docs/`-nya emas buat Sprint 3–4: laporan riset EVE Online (server meshing,
cell servers, authority handoff), SWG/SWGEmu, MMO backends, AAA scorecard,
ADR + risk register. **Kodenya Phase-0 (client/editor belum ada) = lewati.**

### 2.8 recastnavigation — cadangan navigasi (Zlib)

Navmesh per-meter. **Sekarang GAK dipakai** — rute NPC = route graph per
segmen (desain Phase A). Relevan saat: NPC jalan granular di kota,
pejalan kaki, konvoi menikung detail. (Drone = ruang 3D → beda masalah:
collision avoidance 3D, bukan navmesh darat.)

### 2.9 Akuma RPG Framework — referensi lock-on & spawner (MIT, C++/UE5)

Framework RPG Blueprint-first yang **server-authoritative** (inventory,
combat, crafting divalidasi di authority) — prinsipnya sejajar D-008.

- **Lock-on Z-target**: acquisition, camera tracking, facing/strafe,
  switching, **LOS + range validation** — pembanding kode pas implementasi
  lock-on `09-combat-depth.md` §2 (PR-A Sprint 7). MIT = boleh diport.
- **Dokumen AI spawner**: `AI_SPAWNER_PERFORMANCE`, `AI_AGGRO_ASSIST`,
  `AI_SOCIAL_INTERACTIONS`, `AI_SPLINE` — bacaan buat wave spawner
  (`09` §4.3) & gerakan patroli.
- Combat: combo, block/parry/dodge/**guard break**, crit/armor — peta buat
  FPS skills Sprint 5 & wuxia (Cangyuan parked).
- **Persistence lesson**: save dunia di-scope per akun (fix kebocoran
  campur-akun di rilis v2.18.5) — peringatan buat persistence kita
  (ownership/state per akun jangan pernah nyampur).

### 2.10 open-theft-auto — referensi wanted/kota (MIT, Godot/GDScript)

Sandbox GTA dengan **wanted/police system**, distrik kota prosedural,
ekonomi, reputasi. Nilainya sebagai **pola implementasi** buat `05`
(escalation heat, patroli per distrik, interaksi polisi–kota) — bahasa
GDScript, jadi **port ide, bukan kode**. Repo besar (437MB, penuh aset) —
cukup baca README/dokumennya, gak perlu clone.

---

## 3. Yang DITOLAK (keputusan, bukan lupa)

| Ditolak | Alasan | Kapan dibuka lagi |
|---|---|---|
| **LLM runtime di server** (Qwen/Ollama dll) | Determinisme E-5 + cost + latency | Tak pernah untuk otoritas; narasi di client boleh pikirkan (bukan state) |
| **RL/torch runtime** (PPO/DQN) | Infra berat, gak deterministik | Offline training aja kalau kelak butuh, output = tabel keputusan deterministik |
| **Native C++ di server** | Portability D-009 (self-host, Termux arm64), dua kebenaran TS/C++ | **Urutan setelah benchmark**: worker thread → Sprint 4 federasi → BARU native addon hot-path spesifik (>30% CPU di Sprint 6 load-test). "Profile first, native last." |
| **Engine kedua** (O3DE/Helios code) | UE5 final (`00-migrasi`); 2 engine = 2 pipeline aset | Tak pernah |
| **Navmesh sekarang** (recast) | Route graph cukup untuk rute per-segmen | Saat gerakan per-meter NPC darat dibutuhkan |
| **Sidecar process AI** (FastAPI dsb) | Nambah proses + serialisasi tanpa kebutuhan | Ikut keputusan native di atas |

---

## 4. Status & kapan dibuka

- **Cangyuan = PARKED** — blueprint tetap ada (`ue/10-cangyuan.md`,
  merged #786) tanpa checklist eksekusi. File ini **tidak tergantung**
  Cangyuan.
- **Konsumen yang sudah jalan**: `09-combat-depth.md` (Sprint 7 —
  lock/projectile/AI) memakai batch combat awal; drone patroli `05` §4.1
  memakai pola budget/LOD saat di-upgrade; wave spawner `09` §4.3.
- **Kapan review file ini**: saat mulai `packages/npc`, drone AI, sistem
  saksi/investigasi, atau sebelum Sprint 4 (baca Helios docs dulu).

---

*File ini tumbuh: temuan repo baru ditambah barisnya + tier lisensinya.
Yang gak ada tier = gak boleh disentuh kodenya.*
