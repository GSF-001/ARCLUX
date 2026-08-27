# ⚔️ ARCLUX — Combat & World Validator (Layer I)

> Visual boleh cinematic. Hasil harus deterministic + tervalidasi.
> *"Users create the machines. ARCLUX defines the physics. The server verifies
> reality."*

Desain combat dua lapis yang dipisahkan tegas.

**Prinsip inti:** client boleh **menggambar** perang, client **tidak boleh
menentukan** kebenaran perang.

```
REPOSITORY ──▶ ARCLUX ANALYSIS ──▶ VESSEL STATE ──▶ WORLD SERVER
                                                       │
                                              ┌────────┴────────┐
                                              ↓                 ↓
                                           CLIENT A          CLIENT B
                                              │                 │
                                              ▼                 ▼
                                          3D RENDER        3D RENDER
```

---

## I.1 — Visual serangan (client-side, cinematic)

Target lock: kapal mengidentifikasi target (distance, velocity, heading,
available weapons); UI menampilkan bracket/marker; kamera zoom cinematic
ringan namun gameplay tetap taktikal.

Senjata punya **archetype visual**, bukan instruksi visual mentah dari user.
User memberi *capability* (`component` → mis. `weapon.plasma`); ARCLUX
menerjemahkannya:

```
Weapoon capability ──▶ ARCLUX combat renderer
        ├── Projectile
        ├── Beam
        ├── Missile
        ├── Drone
        └── Area effect
```

Impact visual: shield flash, sparks, directional explosion, armor
fragments, electrical effects, smoke, disabled subsystem, debris.
Animasi **hanya merepresentasikan** hasil simulation, bukan sumbernya.

---

## I.2 — Damage berdasarkan subsystem

Bukan sekadar HP = 73%, tapi per-subsystem:

```
VESSEL
├── Engine       82%
├── Navigation   91%
├── Weapons      64%
├── Defense      48%
└── Reactor      77%
```

Serangan tertentu menurunkan subsystem spesifik → visual kapal berubah
(mis. Defense 48% → shield flicker) → dapat ditelusuri ke component/modul
via model impact yang sudah ada.

---

## I.3 — Catastrophic damage

State turun 100% → … → 0% → `VESSEL DESTROYED` → berubah menjadi wreckage;
world-state menyimpan event (lihat [04-wreckage-history.md](04-wreckage-history.md)).
Repo project asli tidak dihancurkan — yang berubah hanya layer `.arclux/` /
world-state.

---

## I.4 — World Validator (server = referee)

Server/middleware memvalidasi setiap request sebelum event sah:

```
CLIENT A attack request
   │
   ▼
WORLD VALIDATOR
   ├── attacker valid?
   ├── weapon exists?
   ├── component authorized?
   ├── license valid?
   ├── vessel state valid?
   ├── cooldown valid?
   ├── range valid?
   ├── target valid?
   ├── damage ≤ ruleset?
   └── state/version valid?
        │
        ▼
   DAMAGE EVENT ──▶ CLIENT A render + CLIENT B render
```

Server tidak merender 3D — ia hanya menentukan "event ini sah". Client
menggambar hasilnya.

---

## I.5 — Vessel state fingerprint/version

```
Repository (Commit: a83f91)
   ──▶ Analysis #1842
   ──▶ Vessel State
   ──▶ State Hash
```

Jika user mengubah client (mis. `armor = infinity`), state lokal tidak cocok
dengan validated state → ditolak.

---

## I.6 — Component authorization

Validator memastikan component benar-benar milik/terizinkan: license valid,
terpasang, capability sesuai, tidak expired/revoked, vessel state mengenal
component tersebut. Mencegah: *"copy component legendary punya orang ke
.arclux/ gue"*.

---

## I.7 — Damage ceiling / ruleset

User bebas membuat weapon kompleks, tapi hasil simulation terjepit aturan:

```
raw capability ──▶ simulation ──▶ rules ──▶ MAX 10,000
```

Kreativitas user berada di dalam "physics ARCLUX" (damage ceiling).

---

## I.8 — Replay / event log

Pertempuran penting direkam (battle ID, aksi, impact, subsystem, damage,
state awal/akhir, event hash). Dasar sengketa ("dia cheat!"), preventasi
cheat, dan fondasi Hall of Fame / history (lihat
[04-wreckage-history.md](04-wreckage-history.md)).
