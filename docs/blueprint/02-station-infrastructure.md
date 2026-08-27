# 🛰 ARCLUX — Station & Infrastructure System

> The repository is a vessel. The station is where vessels gather, evolve,
> and leave their history behind.

Desain sistem station & infrastruktur — hub sosial, developer, dan ekonomi
yang user-ciptakan di dalam persistent universe ARCLUX.
Bagian dari blueprint ARCLUX (Repository War Universe).

---

## 1. Design Philosophy

ARCLUX tidak membuat station satu-per-satu. ARCLUX membangun **sistem** yang
memungkinkan user membangun ribuan station.

> "The universe is not a map. It is a space governed by rules."

**Prinsip inti:**
- User menciptakan konten (station, vessel, component).
- ARCLUX menyediakan physics, rules, dan world validation.
- Server memverifikasi realitas (lihat [03-combat.md](03-combat.md)).

---

## 2. What is a Station?

Station = persistent, user-created center of activity dalam universe.

Bukan sekadar menu — station adalah **lokasi fisik** di dunia:

```
🛰 STATION
│
├── 🧩 Component Exchange
├── 🛠 Engineering Bay
├── 👥 Community Hub
├── 📜 History Archive
├── 🏛 Hall of Fame
├── 🚀 Fleet Dock
├── 🔬 Analysis Lab
├── 🔭 Observatory
└── 🛡 Security Center
```

---

## 3. Station Facilities

**Docking Bay** — kapal parkir / docking.
**Engineering Bay** — upgrade, repair, modify vessel.
**Component Market** — membeli/menjual component antar vessels.
**Analysis Lab** — inspeksi repository architecture/intelligence.
**Community Hub** — tempat interaksi antar developers.
**Wreckage Museum** — history & wreckage dari universe.
**Navigation Center** — peta universe, rute, gates.
**Security Center** — rule enforcement, protected zone.
**Observatory** — tampilan universe level tinggi.

Setiap facility dapat diwakili sebagai lokasi/area spesifik di dalam station —
bukan sekadar tombol menu.

---

## 4. Station Identity

Setiap station punya:
- **Name**
- **Owner** (user/community/fleet)
- **Location** (koordinat spatial)
- **Type** (outpost/hub/fleet base/landmark)
- **Permissions** (public/community/fleet/private)
- **Facilities** (yang dibuka/dibangun)
- **Reputation / History** (event yang terjadi)
- **Components hosted** (yang di-exchange/stored)

Station yang sama bisa berarti banyak bagi berbagai kelompok.

---

## 5. Station Creation

Stasiun dibuat user melalui rules yang disediakan ARCLUX.

```
USER INITIATES
    ↓
STATION BLUEPRINT / REQUEST
    ↓
WORLD VALIDATION (space, resources, permission)
    ↓
STATION SPAWNED
    ↓
FACILITIES UNLOCKED / BUILT
```

Creation dikontrol oleh validation agar fair & anti-abuse
(lihat [03-combat.md](03-combat.md) — World Validator).

---

## 6. Station Types

Taksonomi awal (bisa berkembang):
- **Outpost** — small, private, early infrastructure
- **Hub** — larger, trade-focus, public interaction
- **Fleet Base** — private, fleet/community owned
- **Trading Post** — component exchange focus
- **Landmark** — famous/historical object
- **Observatory** — universe overview focus

Tipe bisa berubah seiring evolusi station.

---

## 7. Station Evolution

Station bukan statis — ia berevolusi.

```
OUTPOST
   ↓
HUB
   ↓
FLEET BASE / LANDMARK
```

Evolution driven oleh:
- world-state
- milestones
- community activity
- economy

**Filosofi:** ARCLUX menyediakan rules; user & komunitas yang membuat
evolusi terjadi.

---

## 8. Safe Zone Model

Pertimbangan rule khusus untuk station.

```
       ╭───────────────╮
       │  SAFE ZONE     │
       │   (radius 1km) │
       │   🛰 STATION    │
       ╰───────────────╯
```

**Konsep:** banyak spatial games menerapkan safe zone di sekitar station
untuk mencegah gank / kill di area sosial.

**Aplikasi di ARCLUX:**
- Default: area aman di sekitar station.
- World Validator **menolak** hostile action di radius safe.
- Melindungi area sosio-ekonomi (trade, repair, community).

```
HOSTILE ACTION
    ↓
INSIDE SAFE ZONE?
 ├── YES → REJECTED by World Validator
 └── NO  → validated normally
```

---

## 9. Flee-to-Safety

Rule defensif terkait safe zone.

```
TARGET
    ↓
ENTERS SAFE ZONE
    ↓
INCOMING DAMAGE
    ↓
BLOCKED / REJECTED
```

- Damage dicegah saat target masuk radius perlindungan.
- Memberi taktik nyata: kapan menyerang, kapan mundur.
- Deterministic & tervalidasi server-side (anti-cheat).

---

## 10. Station Permissions

Siapa yang boleh apa di dalam station.

```
PUBLIC
├── dock
├── trade (open)
├── visit
└── interact limited

COMMUNITY
├── confirm members
├── dock
├── trade
└── build facilities

FLEET
├── manage
├── build
├── trade
└── dock

PRIVATE
├── owner only
└── invited
```

Permissions dipaksakan oleh World Validator.

---

## 11. Component Market

Station menyediakan pasar component antar vessels.

```
🧩 COMPONENT
    ├── id
    ├── capability
    ├── license
    ├── provenance
    └── owner
```

Trade dikaitkan dengan:
- license 3-tier (open/shared/private)
- provenance (asal-usul component)
- anti-abuse validation

Component yang "legendary" punya jejak (lihat
[04-wreckage-history.md](04-wreckage-history.md)).

---

## 12. Engineering Bay

Tempat upgrade / repair / modify vessel.

```
🛠 ENGINEERING BAY
    ├── repair (map damage → module/file)
    ├── upgrade
    ├── component install/remove
    └── vessel reconfiguration
```

**"Repair = commit"** — repair terjadi lewat perubahan repo, bukan tombol.

---

## 13. Analysis Lab

Jembatan antara spatial world & developer tooling.

```
🔬 ANALYSIS LAB
    ├── architecture view
    ├── health overview
    ├── security findings
    ├── dependency graph
    └── impact analysis
```

Developer dapat menginspeksi repository langsung dari station
(lihat [01-spatial-ux.md](01-spatial-ux.md) — Analysis Lab).

---

## 14. Community Hub

Tempat interaksi antar developers / fleets.

```
👥 COMMUNITY HUB
    ├── member list
    ├── shared space
    ├── announcements
    └── collaboration
```

Community = kumpulan developer di balik vessels.

---

## 15. Hall of Fame (Station)

Museum sejarah di station (lihat
[04-wreckage-history.md](04-wreckage-history.md)):
- legendary vessels
- major battles
- famous communities
- recovered components
- retired vessels
- historic events

Membuat station menjadi tempat sejarah universe.

---

## 16. Navigation Center

Peta universe & rute.

```
🗺 NAVIGATION CENTER
    ├── system map
    ├── gates/routes
    ├── station locations
    ├── hazardous zones
    └── travel planning
```

Dari sini user dapat merencanakan perjalanan spatial.

---

## 17. Security Center

Guard station & enforce rules.

```
🛡 SECURITY CENTER
    ├── safe zone enforcement
    ├── permission checks
    ├── hostile action filtering
    └── anomaly detection
```

Terintegrasi dengan World Validator (anti-cheat).

---

## 18. Observatory

Tampilan universe level tinggi.

```
🔭 OBSERVATORY
    ├── universe overview
    ├── system status
    ├── activity feed
    └── historical timeline
```

Jembatan antara station lokal & universe global.

---

## 19. Spatial Rules / Zones

Spatial model universe dengan zone & ruleset berbeda.

```
OPEN SPACE       — free movement, combat allowed
COMBAT ZONE      — combat allowed, rewards
STATION / SAFE   — protected, social/trade
PLANETARY        — special rules
TRAVEL ROUTE     — transit / gates
SPECIAL ZONE     — unique rules (events, history)
```

Setiap zone punya ruleset sendiri yang divalidasi server.

---

## 20. Station Evolution & Economy

Station terhubung dengan loop ekonomi universe.

```
REPOSITORY
   ↓
VESSEL
   ↓
COMPONENT
   ↓
TRADE
   ↓
STATION
   ↓
ECONOMY
   ↓
EVOLUTION
```

**(Draft)** — ekonomi detail di milestone lanjutan (M4).

---

## 21. World Integration

Station terintegrasi penuh dengan unified world architecture (lihat
[01-spatial-ux.md](01-spatial-ux.md)):

```
ARCLUX WORLD
     ↓
WORLD MODEL
     ↓
SPATIAL / VESSEL / SOFTWARE
     ↓
STATIONS
     ↓
EVENTS / HISTORY / ECONOMY
```

State yang sama menggerakkan station, vessels, dan developer tooling.

---

## 22. Safety & Anti-Abuse

Station ruleset memastikan fair play:

```
SAFE ZONE  — no hostile action
PERMISSION — who can do what
VALIDATION — station creation/evolution valid
ECONOMY    — component provenances & licenses
```

**Prinsip anti-cheat konsisten** dengan [03-combat.md](03-combat.md):
> "Client renders. Server validates. The server verifies reality."

---

## 23. Summary / Vision

Station = tempat vessel berkumpul, berevolusi, dan meninggalkan sejarah.

```
🌌 UNIVERSE
   │
🛰 STATIONS
   │
🚀 VESSELS
   │
🧩 COMPONENTS
   │
📜 HISTORY
```

**ARCLUX membangun sistem — user membangun dunia.**

> Users create the stations.
> ARCLUX defines the rules of space.
> The server verifies reality.
```
