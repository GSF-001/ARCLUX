# 🚀 ARCLUX — Repository War Universe

> Repository adalah sumber kebenaran. ARCLUX adalah universe yang \
> memvisualisasikan, mensimulasikan, dan memberi kehidupan pada repository.

**Blueprint strategis — dibaca dengan izin** · Lihat [BLUEPRINT_LICENSE.md](BLUEPRINT_LICENSE.md) sebelum menggunakan. Draf iterasi 1.

---

## 0. Kompas Strategis

**Satu kalimat visi:**
> ARCLUX menjadi universe tanpa batas tempat setiap software repository
> menjadi source of truth bagi entitas virtual (kapal) yang dapat
> divisualisasikan, dikembangkan, ditransfer, dirusak, diperbaiki, dan
> berjejak sejarah — dengan engine code-intelligence sebagai mesin di
> baliknya, dan ARCLUX sebagai *canvas*, bukan konten.

**3 prinsip non-negotiable:**
1. **Repo user = source of truth.** Kapal dibangun user di repo mereka
   (`.arclux/`), BUKAN di repo ARCLUX.
2. **ARCLUX = canvas + mesin.** ARCLUX membangun universe/aturan/engine;
   konten (kapal, senjata, system) 100% karya user.
3. **Serangan tidak merusak code asli.** Damage hanya menyentuh layer
   `.arclux/` / world-state; repo project aman. **"Repair = commit"**
   (bukan tombol).

**Struktur 3 lapis:**
```
ARCLUX CORE (code intelligence — SUDAH ADA / OP)
   ├─ Parser / Indexer / Graph / Detector / Impact / Security
   ├─ SDK / MCP / CLI / DSL          (sudah live di npm)
   ├─ .arclux/ layer                 (BELUM ADA — titik baru)
   │      vessel / components / systems / state
   ├─ World Model                    (BELUM ADA — abstraksi baru)
   └─ Developer World ↔ 3D World     (3D sudah ada; loop-nya belum)
```

---

## 1. Keputusan Arsitektur

Rekomendasi yang perlu dikunci sebelum eksekusi:

| # | Keputusan | Rekomendasi |
|---|---|---|
| K1 | Siapa hitung atribut kapal | **Hybrid**: base-stat otomatis dari analisis + user extends (validated, anti-abuse) |
| K2 | Skala pondasi | **Single-repo → 1 kapal hidup** dulu; multi-repo/war = milestone lanjutan |
| K3 | License 3-tier | Masuk pondasi pertama (bikin transfer & kompetisi adil sejak awal) |
| K4 | Rendering | Pakai `three` + `react-force-graph-3d` yang ada, extend jadi "kapal" |

---

## 2. Arsitektur Teknis

### Layer A — `.arclux/` manifest (objek K1, K3)

Titik baru pertama: file konfigurasi ARCLUX di dalam repo user
(belum ada; gap teridentifikasi dari riset).

```
my-project/
└── .arclux/
    ├── arclux.json          # manifest: nama kapal, lisensi, override stats
    ├── vessel/
    │   └── *.arclux         # definisi kapal (DSL — engine DSL sudah ada & live)
    ├── components/          # component capability (lihat Layer C)
    ├── systems/             # subsystem def (engine/reactor/nav/defense/weapon/ai)
    └── state/               # di-generate ARCLUX, versioned (history → provenance)
```

- Definisi kapal memakai **DSL ARCLUX** (`packages/dsl`) yang sudah live di
  npm — user memakai bahasa yang ada, bukan bahasa baru.
- `.arclux/state/` = world-state yang di-generate ARCLUX, tetap versioned di
  repo user → terbawa history → nyambung ke provenance.

### Layer B — World Model (abstraksi baru; objek K1, K3)

Package baru (mis. `packages/universe/`):

```
WorldModel            # agregat status semua vessel + state universe
VesselModel           # satu kapal: base-stat (engine) + override (user) + live-state
SystemState           # per-subsystem: health/damage/degraded
ComponentBinding      # component terpasang → capability (SDK/MCP)
LicenseValidator      # K3: open/shared/private → authorized/unauthorized
ProvenanceTracker     # reuse packages/provenance → asal-usul component
DamageResolver        # simulasikan damage → lokasi modul/file yang kena
ImpactDebugger        # damage → impact tracing → baris/fungsi yang rusak
```

**Mapping stat kapal dari analisis:**
| Atribut kapal | Sumber dari ARCLUX |
|---|---|
| Armor/Integrity | `computeHealthScore` |
| Weapons | Component terpasang + security findings |
| Defense | Layer violations / attack surface |
| Engine/Navigation | Graph structure (module/node/edge counts) |
| Repair-ability | Impact tracing → file yang kena |

Ini mewujudkan "makin project berharga → makin kuat", tapi terukur &
anti-abuse (K1-C).

### Layer C — Component System (objek K3)

- Component = **capability nyata** dari SDK/MCP, bukan sekadar skin.
- Setiap component: `id`, `capability` (referensi fungsi SDK), `license`,
  `provenance`, `owner`.
- Contoh binding:
  - `security-scanner` → `analyzeRepositorySecurity`
  - `impact-solver` → `calculateAffectedFiles`
  - `route-mapper` → `mapAttackSurface`
  - `call-graph` → `buildCallGraph`
- **License 3-tier** (`LicenseValidator`):
  - 🟢 Open — boleh reuse sesuai terms
  - 🟡 Shared — butuh attribution/permission
  - 🔴 Private — hanya owner & yang diizinkan; unauthorized → **capability
    disabled** (bukan code rusak)

### Layer D — Ingestion & Auto-Update (objek K2)

- **Connect**: `arclux connect <repo-url>` (npm/CLI/MCP/SDK yang sudah live)
  → membuat boilerplate `.arclux/`.
- **Auto-update**: daemon (`packages/daemon/`) + watcher
  (`packages/watcher/`) → event `analysis:updated` → update `VesselModel`
  → push ke web.
  - **Gap**: web belum consume SSE daemon (`/events`). Perlu bridge route
    Next.js (`/api/universe/events`) + `EventSource` client.
  - **Gap jangka panjang**: `watchRepository` masih full-rebuild; true
    per-file incremental (`packages/incremental`) belum di-wire ke
    `buildIndex`.

### Layer E — 3D World (objek K2, K4)

- Render hub/dashboard memakai `three` yang sudah ada.
- 3D kapal: extend pola `GraphCanvas3D` + `GraphAuditOverlay` (terbukti bisa
  drive scene dari luar via `fgRef`).
- Mapping: sistem kapal → mesh 3D, health → warna/scale/partikel damage.
- Kualitas adaptif (resolution/FPS/effects/render distance) — render di
  client, sim tetap di world-state (FPS tidak menentukan kebenaran sim).

### Layer F — Developer World → Debug

- **Health Dashboard**: game-HUD + observability; tiap subsystem → health%,
  click-through ke modul/file/baris (via `ImpactDebugger` +
  `packages/editor/CodeNavigator` + `packages/impact/*`).
- **"Repair = commit"**:
  1. Damage → `DamageResolver` identifikasi modul terkait
  2. Dev debug & update code
  3. Commit → ARCLUX re-analyze
  4. `VesselModel` update → health pulih

### Layer G — Server/Infra (objek K3)

- Sebagian besar workload di client/user runtime (render + sebagian sim).
- Server/global cuma: identity, sync, persistence, world-events, validation,
  permissions.
- Persistence pakai `packages/db` + `packages/storage/RecoveryManager`.
- Community/fleet/station/territory/hall-of-fame = milestone lanjutan.

### Layer H — Business & Ecosystem

- **Monetisasi**: core sudah `arclux` live di npm. Tier: free core + premium
  SDK/MCP/enterprise + storage/history + advanced universe component.
- **Collaborator ecosystem**: extension di atas ARCLUX (SDK, sandbox,
  validation, publish) — tanpa write access ke core. Fondasi ada di
  `packages/shell/plugins.ts` + `detectors.ts` (user-space).

---

## 3. Roadmap Milestone

### Milestone 1 — "Kapal Hidup" (pondasi)
1 repo → 1 kapal yang hidup & bisa dijelajah. Validasi loop inti (#2-4, #7-10).

- `.arclux/` schema + generator (`arclux connect`)
- World Model core (`VesselModel`, `SystemState`, stat mapping, `ComponentBinding`)
- Health Dashboard di `apps/web` (hub 2D)
- 3D vessel (extend `GraphCanvas3D` jadi mesh kapal sederhana)
- License 3-tier validation (`LicenseValidator` + provenance) — K3
- Bridge SSE daemon→web (auto-update)
- `arclux connect` + docs

**Out of scope M1:** perang menyeluruh, multi-repo universe, transfer antar
kapal, fleet/community, hall-of-fame, global server.

### Milestone 2 — "War & Damage"
- Damage simulation + `DamageResolver` + `ImpactDebugger`
- Component rusak → capability turun; repair = commit
- Catastrophic damage threshold → rebuild via commit
- Multi-repo connect + war 2 kapal (tak merusak repo asli)

### Milestone 3 — "Universe Persisten"
- Persistent world-state (server sync, identity, events)
- Transfer component antar kapal + provenance transfer
- Wreckage Archive + Hall of Fame (museum sejarah) — lihat Section 3b

### Milestone 4 — "Ecosystem & Economy"
- Extension Registry + publish + discovery
- Community/fleet/station/territory
- Economic loop penuh

---

## 3b. Wreckage & Hall of Fame — Museum Sejarah

Kapal yang hancur tidak "respawn lalu hilang". Ia meninggalkan **puing
sejarah** yang permanen dan menjadi aset dunia — bukan sekadar log database.

```
🚀 VESSEL
   ↓
⚔️ BATTLE
   ↓
💥 CATASTROPHIC DAMAGE
   ↓
🚀❌ VESSEL DESTROYED
   ↓
🧩 WRECKAGE
   ↓
ARCLUX RECOVERY SYSTEM
   ↓
🏛️ HALL OF FAME
```

**Wreckage Archive** — setiap puing jadi historical artifact dengan entri
permanen (ID, identitas, event, status, komponen recover):

```
╔══════════════════════════✇══╗
║   ARCLUX WRECKAGE #042       ║
╠══════════════════════════════╣
║ Vessel: Project Aurora       ║
║ Community: Nova Fleet        ║
║ Last Battle: Event #182      ║
║ Status: Destroyed            ║
║ Components Recovered: 17     ║
╚══════════════════════════════╝
```

**Puing membawa provenance** — bagian terkuat dari konsep ini. ARCLUX
menyimpan jejak hidup sebuah component:

```
Component X
   ↓
Created by Developer A
   ↓
Installed on Vessel A
   ↓
Transferred to Fleet B
   ↓
Destroyed in Battle #72
   ↓
Recovered
   ↓
Hall of Fame / Wreckage Archive
```

Ini mengubah **history menjadi aset dunia**, bukan sekadar log database.
Provenance (`packages/provenance`) + `packages/db` (`AnalysisRecord` /
snapshot) adalah bahan mentahnya.

**Hall of Fame = museum sejarah ARCLUX**, bukan leaderboard:
- 🏆 legendary vessels
- ⚔️ major battles
- 🧩 recovered components
- 🚀 retired vessels
- 🏛️ wreckage
- 📜 historic events
- 👥 legendary communities

Pemain baru bisa datang dan melihat sejarah: *"Kapal ini pernah terlibat
perang terbesar tahun lalu."*

**Filosofi yang konsisten:** ARCLUX tidak perlu membuat semua cerita.
Developer & komunitas menciptakan kejadian → ARCLUX menyimpan &
memvisualisasikan sejarahnya. Semakin lama universe hidup, semakin banyak
sejarah yang terbentuk — itulah yang membuat ARCLUX terasa seperti **dunia**,
bukan sekadar game yang punya map.

---

## 4. Yang Sudah Ada vs Harus Dibangun

| Kebutuhan | Status | Keterangan |
|---|---|---|
| npm CLI/MCP/SDK/DSL | ✅ ADA | `arclux` live |
| 3D engine (`three`) | ✅ ADA | `apps/web`, `GraphCanvas3D` |
| Scene drive dari luar (`fgRef`) | ✅ ADA | `GraphAuditOverlay` |
| Daemon + SSE live-push | 🟡 | daemon ada; web belum consume SSE |
| Persistensi + history trend | ✅ ADA | `AnalysisRecord` |
| Provenance | 🟡 | `ProvenanceRecord` ada; `Revision/Snapshot` stub |
| User-space plugin/detector | ✅ ADA | `packages/shell/plugins.ts` |
| Impact tracing → debug map | ✅ ADA | `packages/impact/*` |
| Crash-safe storage | ✅ ADA | `RecoveryManager` |
| Config `.arcluxrc` di repo user | ❌ BELUM | titik baru |
| World Model / VesselModel | ❌ BELUM | abstraksi baru |
| License validation | ❌ BELUM | bikin baru |
| Damage/simulation engine | ❌ BELUM | bikin baru |
| Wreckage Archive / Hall of Fame | ❌ BELUM | museum sejarah; pakai provenance + db |
| Global server | ❌ BELUM | baru di M3+ |
| True per-file incremental | 🟡 | built, belum di-wire ke `buildIndex` |

---

## 5. Risiko & Pertanyaan Terbuka

1. **Anti-abuse & fairness (K1-C):** gimana user extends base-stat tanpa jadi
   pincang? Butuh rule: override cap / atribut yang tak bisa diubah.
2. **Validasi sentral vs lokal:** untuk kompetisi adil, mungkin butuh server
   validation di M2+ war.
3. **"Perang" perlu attack surface yang adil** — tuning supaya tak mudah 1-hit-KO.
4. **Skala visi besar:** M1 harus dikunci supaya arsitektur tak melenceng saat
   ke M2-M4.
