# 🌌 ARCLUX — Spatial Universe & Navigation UX

> The repository is the vessel. The universe is the interface.

Desain spatial universe & navigasi — mengubah camera menjadi metode navigasi
arsitektur software. Bagian dari blueprint ARCLUX (Repository War Universe).

---

## 1. Design Philosophy

ARCLUX terasa seperti persistent software universe, bukan game konvensional
dengan tema coding.

**Core principle:**
> "The repository is the source of truth. ARCLUX is the spatial canvas and
> simulation layer."

Tiga perspektif yang terhubung:

```
                    ARCLUX WORLD
                         │
          ┌──────────────┼──────────────┐
          ↓              ↓              ↓
      UNIVERSE          VESSEL       DEVELOPER
       VIEW              VIEW           VIEW
          │              │              │
     🌌 🪐 🛰️        🚀 ⚙️ 🛡️       🔗 📦 📄
```

User berpindah antar perspektif tanpa merasa membuka aplikasi terpisah.

---

## 2. Spatial Universe

Canvas utama = persistent 3D spatial environment.

Objek yang mungkin:
- stars
- planets
- stations
- jump gates
- vessels
- fleets
- wreckage
- historical locations
- tactical markers

```
                    ✦
          ·                    ✦

                    🪐
                     │
                  🚀 Vessel
                     │
       ✦─────────────┼─────────────✦
                     │
                 🛰 Station
                     │
             🚀 Vessel B

          ·                    ✦
```

Visual terinspirasi space simulator skala besar, namun ARCLUX mempertahankan
identitas visualnya sendiri.

---

## 3. Abstraction Zoom System

Zoom bukan sekadar memperbesar objek — zoom mengubah **level abstraksi
software** yang ditampilkan.

```
🌌 UNIVERSE
     ↓
🗺️ SECTOR
     ↓
☀️ SYSTEM
     ↓
⚔️ BATTLEFIELD
     ↓
🚀 VESSEL
     ↓
⚙️ SUBSYSTEM
     ↓
📦 COMPONENT
     ↓
🔗 MODULE / GRAPH
     ↓
📄 FILE
     ↓
💻 CODE
```

Contoh:

```
Universe
   ↓ zoom
System
   ↓ zoom
Project Aurora
   ↓ zoom
Engine
   ↓ zoom
engine.ts
   ↓ zoom
initialize()
```

**Camera itu sendiri menjadi metode navigasi arsitektur software.**

---

## 4. Spatial Navigation

**Free Camera:**
- Mouse — camera orientation
- WASD — movement
- Q/E — vertical movement
- Shift — boost
- Space — brake/stop
- Scroll — zoom

**Navigation:**
- M — universe map
- J — jump/navigation
- F — follow selected object
- T — target/lock
- C — scan
- D — dock/interact
- Esc — exit current interaction

*(Usulan kontrol, bukan kontrol ARCLUX yang sudah ada.)*

---

## 5. Semantic Navigation

ARCLUX mendukung navigasi antara representasi spatial dan software.

```
🚀 Vessel
   ↓
⚙️ Engine
   ↓
📦 Component
   ↓
🔗 Dependency
   ↓
📄 File
   ↓
💻 Code
```

Dan sebaliknya:

```
💻 Code
   ↓
📄 File
   ↓
📦 Component
   ↓
⚙️ Subsystem
   ↓
🚀 Vessel
   ↓
🌌 Universe
```

User yang sedang menginspeksi fungsi dapat memilih **"Show in Universe"** dan
kamera berjalan ke vessel/component terkait.

---

## 6. Vessel Control

Model penerbangan spatial dasar:

```
W       Forward
S       Reverse
A/D     Strafe
Q/E     Vertical movement
Shift   Boost
Space   Brake
Mouse   Look
```

Model penerbangan dapat disesuaikan dengan aturan simulation. Client
mengontrol presentasi/input sementara world-state yang authoritative
menentukan hasil valid.

---

## 7. Tactical Overview

Overview taktis khusus:

```
              TARGET
            ╭────────╮
            │   🚀   │
            ╰────────╯
               12.4 km

        [LOCK] [FOLLOW] [SCAN]

       🚀 A              🚀 B
        \                  /
         \                /
          \              /
           ── battlefield ──
```

Overview menyediakan:
- daftar target
- jarak
- kecepatan/arah
- status subsystem
- anggota fleet
- objek terdekat
- world events yang relevan

---

## 8. Combat Interaction

Combat memisahkan intent user, simulation, dan visualisasi.

```
USER INPUT
    ↓
ATTACK REQUEST
    ↓
WORLD VALIDATION
    ↓
SIMULATION
    ↓
DAMAGE EVENT
    ↓
CLIENT A ──→ RENDER
CLIENT B ──→ RENDER
```

Client **tidak pernah** menjadi otoritas penentu apakah attack benar terjadi.

---

## 9. Weapon Interaction

Weapon/component mengekspos capability.

```
1  2  3  4  5  6
│  │  │  │  │  │
W1 W2 W3 W4 W5 W6
```

*(Usulan kontrol:)*
- 1–6 — weapon/component slots
- Tab — cycle targets
- T — lock target
- C — scan
- R — reload/cooldown action
- G — tactical overview

Input ini hanya mewakili **intent**. Perilaku weapon aktual ditentukan oleh
validated simulation rules (lihat [03-combat.md](03-combat.md)).

---

## 10. Combat Visual Language

User mendefinisikan capability/component. ARCLUX menentukan **archetype
visual** yang terstandardisasi:

```
CAPABILITY
    ↓
COMBAT RENDERER
    ├── Projectile
    ├── Beam
    ├── Missile
    ├── Drone
    └── Area Effect
```

Visual merepresentasikan hasil simulation — ia tidak menentukan hasil.
Efek impact yang mungkin:
- shield flash
- sparks
- electrical effects
- smoke
- subsystem shutdown
- directional impact
- debris
- controlled explosion

Visual layer tetap cinematic sementara simulation tetap deterministic.

---

## 11. Subsystem Visualization

Bukan cuma satu HP bar:

```
ENGINE       82%
NAVIGATION   91%
WEAPONS      64%
DEFENSE      48%
REACTOR      77%
```

Subsystem damage memengaruhi:
1. world-state
2. representasi visual

```
DEFENSE 48%
     ↓
shield instability
     ↓
visual flicker
     ↓
component/module impact
     ↓
developer inspection
```

---

## 12. Developer Inspection Mode

World yang sama bisa berpindah ke interface developer-oriented.

```
VESSEL
  ↓
SUBSYSTEM
  ↓
COMPONENT
  ↓
MODULE
  ↓
DEPENDENCY GRAPH
  ↓
FILE
  ↓
CODE
```

*(Usulan shortcut:)*
- H — health/subsystem view
- G — dependency graph
- I — vessel information
- P — provenance
- L — license/component information
- O — module/file inspection
- B — battle/history

*(Usulan UX controls.)*

---

## 13. Focus / Dive Navigation

Aksi Focus/Dive masuk semakin dalam ke lapisan abstraksi.

```
🚀 Vessel
   ↓
⚙️ Engine
   ↓
📦 Component
   ↓
🔗 Dependency
   ↓
📄 File
```

Aksi yang sama digunakan sebaliknya untuk zoom out. Ini bisa menjadi
**signature ARCLUX interaction**.

---

## 14. Jump / Teleport System

Teleportasi ada sebagai navigasi spatial dan semantik.

**Spatial Jump:**
```
SYSTEM A
   ↓
JUMP GATE
   ↓
SYSTEM B
```
Termasuk: destination selection, jump preparation, transition, arrival,
world-state synchronization.

**Semantic Jump:**
```
File
 ↓
Component
 ↓
Vessel
 ↓
System
```
User dapat langsung mencari representasi fisik dari software yang sedang
diinspeksi.

---

## 15. Stations

Station = persistent social/developer hub.

```
🛰 ARCLUX STATION
│
├── 🧩 Component Exchange
├── 🛠 Maintenance / Repair
├── 👥 Community Hub
├── 📜 History Archive
├── 🏛 Hall of Fame
├── 🚀 Fleet Dock
├── 🔬 Analysis Lab
└── 🌌 Observatory
```

Station bukan sekadar menu — ia adalah lokasi fisik di universe.
*(Detail selengkapnya di [02-station-infrastructure.md](02-station-infrastructure.md).)*

---

## 16. Analysis Lab

Station mengekspos repository intelligence sebagai in-world interface.

```
PROJECT AURORA

Architecture     94%
Health           87%
Security         91%
Dependencies   2,481
Impact Radius     17
```

User dapat menginspeksi architecture langsung dari station — jembatan antara
developer tooling dan spatial world.

---

## 17. Fleet & Community Spaces

Komunitas memiliki shared space.

```
COMMUNITY
    ↓
FLEET
    ↓
STATION
    ↓
VESSELS
    ↓
COMPONENTS
```

Station merepresentasikan aktivitas & sejarah komunitas tanpa ARCLUX
membuat kontennya secara manual.

---

## 18. Wreckage Visualization

Kapal hancur meninggalkan wreckage historis yang persisten.

```
BATTLE
  ↓
VESSEL DESTROYED
  ↓
WRECKAGE
  ↓
RECOVERY
  ↓
HISTORICAL ARCHIVE
```

```
🧩 WRECKAGE

Project Aurora
Destroyed: Battle #182

Recovered Components: 17
Historical Events: 4
Last State: Commit a83f91
```

Wreckage tetap dapat ditemukan secara fisik di universe.
*(Detail di [04-wreckage-history.md](04-wreckage-history.md).)*

---

## 19. Hall of Fame

Hall of Fame = museum sejarah, bukan hanya leaderboard.

Kategori:
- legendary vessels
- major battles
- historic components
- recovered components
- retired vessels
- famous communities
- important events
- notable wreckage

Tujuan: sejarah itu sendiri menjadi bagian dari persistent universe.

---

## 20. Universal Cockpit HUD & Adaptive Context

> **Cockpit tetap universal. Kapal tetap unik.** (Extension V5, varian API-first)

ARCLUX memisahkan **kontrol universal** dari **kemampuan kapal**:

```
KONTROL UNIVERSAL ≠ KEMAMPUAN KAPAL
```

Semua kapal memakai bahasa kontrol yang sama; kemampuan tambahan ditentukan
oleh kapal & komponennya.

### 20.1 Standard Control API

Kontrol dasar direpresentasikan sebagai intent standar:

```
move · target · scan · dock · activate · navigate · manage
```

```
PLAYER → CONTROL → PLAYER INTENT → WORLD VALIDATOR → ACCEPT | REJECT → SIMULATION
```

Client tidak menentukan apakah tindakan berhasil.

### 20.2 Ship Capability Registry

Setiap kapal mengekspos daftar capability-nya. Client membangun interface dari
registry ini, bukan hard-code tiap tombol:

```
GET SHIP STATE → { vessel, capabilities: ["targeting","scan","phase_shift","emergency_repair"] }
```

Kapal berbeda punya capability berbeda, tapi kontrol dasar tetap sama.

### 20.3 Three-Layer Model

```
Layer 1 — Control   : apa yang pemain minta (MOVE/ATTACK/SCAN/ACTIVATE)
Layer 2 — Capability: apa yang kapal mampu (weapon/shield/scanner/custom/special)
Layer 3 — World Rules: apa yang dunia izinkan (auth/cooldown/range/damage/
                       component/ownership/safe zone/state version)
```

```
PLAYER INTENT → CAPABILITY → WORLD VALIDATOR → SIMULATION → WORLD STATE
```

### 20.4 Dynamic & Standard Slots

Posisi kontrol dasar konsisten di semua kapal; isi slot berubah per kapal:

```
VESSEL A: [Laser] [Shield] [Scan]  [Repair]
VESSEL B: [Missile][ECM]  [Boost]  [Special]
```

Capability state tampil di slot (pola sama):
`AVAILABLE · ACTIVE · COOLDOWN · DISABLED · DAMAGED · DEPLETED`

### 20.5 UI Bukan Sumber Kebenaran

Kemunculan tombol ≠ aksi pasti berhasil. Saat tombol `SPECIAL` ditekan:

```
ACTIVATE_CAPABILITY → VALIDATOR (exists? authorized? cooldown? uses?
  component condition? ship state? world rules?) → ACCEPT | REJECT
```

Client mengirim **REQUEST** (bukan "berhasil"); server menentukan hasil.

### 20.6 Capability Terhubung Dunia & Provenance

Capability yang melekat pada komponen mewarisi sistem provenance (V4/07):
component → capability → vessel → battle → wreckage → recovery → vessel baru.
Damage pada komponen → degradation/disable capability (lihat §11 subsystem viz di bawah & 07).

### 20.7 Adaptive Context (tetap berlaku)

HUD berubah sesuai konteks — exploration, combat, developer inspection:

**Exploration:**
```
[MAP] [SCAN] [JUMP]
```

**Combat:**
```
[TARGET]
[LOCK]
[WEAPONS]
[DEFENSE]
[TACTICAL]
```

**Developer Inspection:**
```
[GRAPH]
[IMPACT]
[FILES]
[HISTORY]
[PROVENANCE]
[CODE]
```

Mencegah interface menjadi overload permanen — pemain tidak belajar ulang HUD
tiap ganti kapal; ia hanya mempelajari capability baru yang tampil di layout
universal.

---

## 21. Camera Modes

Mode kamera yang disarankan:
- **Free Camera** — eksplorasi spatial penuh
- **Follow Camera** — mengikuti vessel/object
- **Tactical Camera** — kesadaran battlefield
- **Cinematic Camera** — untuk event combat besar
- **Developer Camera** — dioptimalkan untuk inspeksi arsitektur/component
- **Map Camera** — navigasi universe/system tingkat tinggi

---

## 22. Level of Detail

Rendering beradaptasi sesuai jarak & konteks.

```
FAR
🌌 simplified universe objects

      ↓

MID
🪐 system + vessels

      ↓

NEAR
🚀 detailed vessel

      ↓

INSPECTION
⚙️ subsystem/component

      ↓

DEVELOPER
🔗 graph + code
```

Kekompleksan rendering bisa berubah tanpa mengubah kebenaran simulation.

---

## 23. Input Philosophy

Kontrol selalu mewakili **intent**, bukan **authority**.

```
PRESS "1"
    ↓
activate weapon #1
    ↓
server/world validator
    ↓
valid?
 ├── YES → event
 └── NO  → rejected
```

Mempertahankan arsitektur combat server-authoritative
(lihat [03-combat.md](03-combat.md)).

---

## 24. Unified World Architecture

Seluruh UX direpresentasikan sebagai:

```
                    ARCLUX WORLD
                         │
                    WORLD MODEL
                         │
       ┌─────────────────┼─────────────────┐
       ↓                 ↓                 ↓
    SPATIAL            VESSEL          SOFTWARE
     LAYER              STATE            GRAPH
       │                 │                 │
🌌 🪐 🛰 🚀          🚀 ⚙️ 🛡️        🔗 📦 📄 💻
       │                 │                 │
       └─────────────────┼─────────────────┘
                         ↓
                 DEVELOPER ↔ WORLD
```

State yang sama menggerakkan:
- visualisasi universe
- vessel state
- combat
- component state
- dependency inspection
- damage analysis
- history
- provenance

---

## 25. Core UX Principle

> **"Every navigation action should preserve context."**

Moving dari:

```
Universe → System → Vessel → Component → Code
```

harus terasa seperti bergerak melalui satu dunia yang kontinu.

Demikian juga:

```
Code → Component → Vessel → System → Universe
```

harus mengembalikan developer ke representasi spatial dari software yang sama.

---

## 26. Proposed Experience Loop

```
BUILD
  ↓
CONNECT REPOSITORY
  ↓
VESSEL GENERATED
  ↓
EXPLORE
  ↓
DEVELOP
  ↓
COMMIT
  ↓
VESSEL EVOLVES
  ↓
COLLABORATE
  ↓
TRADE / TRANSFER
  ↓
COMPETE
  ↓
BATTLE
  ↓
DAMAGE
  ↓
DEBUG
  ↓
COMMIT REPAIR
  ↓
VESSEL RECOVERS
  ↓
HISTORY
  ↺
```

Distingsi penting: **software development itu sendiri menjadi bagian dari
progression.**

---

## 27. Design Identity

Tujuan bukan:
> "Make ARCLUX look exactly like EVE Online."

Melainkan:
> "Use established spatial/tactical space-sim conventions as UX inspiration,
> while making software architecture the native language of ARCLUX."

Game space konvensional bertanya:
> "Where is my ship?"

ARCLUX juga harus bisa bertanya:
> "Where is this code in my universe?"

Distingsi ini menjadi fondasi identitas visual ARCLUX sendiri.

---

## Final Concept

```
             🌌 ARCLUX UNIVERSE
                     │
              ┌──────┴──────┐
              │             │
          SPATIAL         SOFTWARE
           WORLD            WORLD
              │             │
           🚀 VESSEL ←→ 🔗 CODE
              │             │
           ⚔️ COMBAT ←→ 💥 IMPACT
              │             │
         🧩 COMPONENT ←→ 📦 MODULE
              │             │
           🏛 HISTORY ←→ 📜 GIT
```

**One world. Two perspectives. One source of truth.**

> Users create the software.
> ARCLUX gives it form.
> The universe gives it history.
```
