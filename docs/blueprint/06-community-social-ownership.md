# 🛰️🤝 ARCLUX — Community, Social Connection & Battlefield Ownership

> A battle should not simply determine who wins. It should determine what
> survives, who owns it, what knowledge is lost, what knowledge is gained,
> who trusts whom, who joins whom, and what history remains.

Bagian dari blueprint ARCLUX (Repository War Universe).
Extension V2 + V3 — Community Governance, Access, Vessel Identity &
Persistent Social World.

> **V3 (bagian ini):** memperkuat konsep trust, information access,
> ownership, provenance, station governance, safe zones, intelligence leaks,
> persistent history, dan repository-derived vessels dengan mekanika
> eksplisit untuk: **governance roles, asset classification, access expiry &
> revocation, community-specific exclusion (no auto-confiscation), multi-signature
> governance, emergency lockdown, dynamic safe-zone/gate state, community splits,
> governance event model, vessel identity, dan pemisahan visual 3D dari state
> authoritative.**
>
> Prinsip yang dijaga: ARCLUX menyediakan **mekanisme**; komunitas menentukan
> aturannya sendiri. ARCLUX tidak menilai apakah pemain secara moral "baik"
> atau "buruk" — ia melestarikan konsekuensi dari keputusan komunitas.

---

## 1. Prinsip Inti: Konsekuensi Persisten

Warfare di ARCLUX tidak boleh dibaca sebagai:

```
SHIP → BATTLE → DESTROYED → RESPAWN
```

Melainkan sebagai rantai konsekuensi persisten:

```
COMMUNITY → STATION → VESSELS → WAR → DAMAGE/DESTRUCTION → WRECKAGE
  → COMPONENTS/INTELLIGENCE → RECOVERY/CLAIM → OWNERSHIP
  → NEW VESSEL → NEW COMMUNITY HISTORY
```

Warfare harus menghasilkan: history, engineering consequences, strategic
assets, social conflict, collaboration, trust, intelligence, ownership, dan
persistent stories. Dunia dibentuk bukan hanya oleh ARCLUX, tapi oleh
repository, developer, komunitas, dan konflik yang ikut di dalamnya.

> **Design goal:** Code creates the vessel. The vessel creates gameplay.
> Gameplay creates conflict. Conflict creates wreckage. Wreckage creates
> assets. Assets create ownership. Ownership creates diplomacy. Diplomacy
> creates trust and betrayal. Trust creates communities. Communities create
> collaboration. Collaboration creates new software. All of it creates
> persistent history.

---

## 2. Yang Sudah Ada (cross-reference)

Bagian ini TIDAK mengulang — ia memperkuat apa yang sudah didokumentasikan:

| Topik | Sudah di |
|---|---|
| Community station, facilities, customization, evolution | [02-station-infrastructure.md](02-station-infrastructure.md) §2-7 |
| Safe zone (radius 1km, weapons disabled, transition) | [02-station-infrastructure.md](02-station-infrastructure.md) §8-9 |
| Component market, engineering bay, analysis lab | [02-station-infrastructure.md](02-station-infrastructure.md) §11-13 |
| Community hub, permissions (public/community/fleet/private) | [02-station-infrastructure.md](02-station-infrastructure.md) §10,14 |
| Component identity metadata (id, origin, owner, provenance) | [04-wreckage-history.md](04-wreckage-history.md) + `packages/universe/types.ts` |
| Wreckage as resource, recovery, ownership via provenance | [04-wreckage-history.md](04-wreckage-history.md) |
| Provenance survives integration | [04-wreckage-history.md](04-wreckage-history.md) |
| Catastrophic damage → wreckage | [03-combat.md](03-combat.md) I.3 |
| Repair = commit (effort, bukan magic) | Blueprint utama Layer F |
| Component authorization / license 3-tier | `packages/universe/license.ts` + [03-combat.md](03-combat.md) I.6 |
| Community trust / access keys / expiry / revocation (concept) | lihat §3.2-3.4 di bawah |
| Safe zone statis (radius, weapons disabled, transition) | [02-station-infrastructure.md](02-station-infrastructure.md) §8-9 |
| Repository-derived vessel (source of config) | [05-vessel-design-dashboard.md](05-vessel-design-dashboard.md) + `packages/universe` |
| Wreckage / provenance survives integration | [04-wreckage-history.md](04-wreckage-history.md) |
| Gameserver authoritative (WorldRegion / Validator / Sim / Combat) | `packages/gameserver` (dasar implementasi §13-16 di bawah) |

---

## 3. Information & Trust

### 3.1 Information as a Community Asset

Komunitas memiliki informasi berharga tentang vessel mereka: capability,
subsystem, architecture, known weaknesses, component info, battle history,
engineering config, strategic capability.

**Prinsip:**
> ARCLUX menyediakan mechanisms; komunitas menentukan trust & information
> policies mereka sendiri.

### 3.2 Information Access Levels

Komunitas mendefinisikan kelas akses informasi (kategori dapat dikonfigurasi):

```
PUBLIC
   ↓
MEMBER
   ↓
TRUSTED
   ↓
STRATEGIC
   ↓
RESTRICTED
```

Komunitas memutuskan informasi mana yang public, mana yang hanya untuk
anggota terpilih.

### 3.3 Community Access Keys

Informasi sensitif dapat dilindungi oleh access keys. Komunitas menentukan:

- siapa yang menerima key;
- berapa banyak yang memegangnya;
- apakah butuh multi-approval;
- kapan akses kedaluwarsa (expiry);
- bagaimana key di-rotate;
- informasi apa yang tiap key bisa akses.

```
COMMUNITY → SENSITIVE INFORMATION → ACCESS POLICY → ACCESS KEY → AUTHORIZED MEMBERS
```

Ini menciptakan **social trust system** — ARCLUX tidak perlu memutuskan sendiri
siapa yang layak dapat akses.

### 3.4 Trust as Gameplay

Sistem akses menciptakan social consequences yang muncul alami:

```
COMMUNITY → TRUSTED MEMBER → STRATEGIC ACCESS → MEMBER LEAVES → ACCESS REVOKED/ROTATED
```

Ini memproduksi secara organik: alliances, diplomacy, internal disputes,
intelligence leaks, leadership conflicts, reputation, changing loyalties.

> Sistem tidak perlu scripted drama. Players create the drama themselves.

### 3.5 Security Boundary (Penting)

ARCLUX membedakan tegas antara:

```
IN-UNIVERSE INTELLIGENCE   ≠  PRIVATE CREDENTIALS  ≠  SECRET KEYS  ≠  UNAUTHORIZED SOURCE ACCESS
```

- In-universe intelligence = representasi permainan dari info vessel.
- **Private credentials / secrets / source access TIDAK** otomatis menjadi
  gameplay objects yang bisa ditransfer.
- Komunitas menentukan secara eksplisit informasi apa yang direpresentasikan
  atau diekspos di dalam universe.

Ini memungkinkan intelligence warfare **tanpa** mengubah credential pribadi
atau informasi sensitif lain menjadi aset gameplay yang bisa dipindahtangankan.

### 3.6 Intelligence Leaks

Komunitas bisa mengekspos informasi vessel — sengaja atau tidak:

```
VESSEL CAPABILITY → MEMBER KNOWLEDGE → SHARED → OTHER COMMUNITY → STRATEGIC ADVANTAGE
```

Informasi menjadi strategic resource. Komunitas yang gagal melindungi
informasi bisa menampakkan weakness sebelum perang.

### 3.7 Community Reputation (Multi-Dimensional)

Reputasi BUKAN satu skor universal. Signal potensial:

- project participation
- engineering contributions
- successful recovery operations
- community service
- diplomatic history
- completed collaborations
- battle history
- reliability

Komunitas yang berbeda menghargai kontribusi yang berbeda.

---

## 4. Assets & Ownership

### 4.1 Component Identity

Setiap recoverable component punya persistent identity:

```
Component ID
Original Vessel
Original Owner
Current Owner
Component Type
Origin
Provenance
Battle History
Recovery Status
Integration Status
```

Component menjadi **historical object**, bukan disposable loot.

### 4.2 Ownership Transfer & Owner Loss

```
ORIGINAL OWNER (A) → VESSEL DESTROYED → WRECKAGE → RECOVERED → CLAIMED BY (B) → CURRENT OWNER (B)
```

- Ownership transfer dicatat sebagai permanent historical event.
- Setelah legitimate transfer, pemilik lama **tidak lagi otomatis mengontrol**
  aset tersebut.
- Komunitas bisa kehilangan: rare components, strategic systems, historical
  artifacts, valuable engineering assets.
- Ini membuat destruction **materially meaningful**.

### 4.3 Component Integration & Cross-Community History

Recovered component dapat diintegrasi ke vessel lain jika compatibility rules
memenuhi, dan **history-nya tetap menempel** setelah integrasi.

```
VESSEL BETA
├── Component A → Original: Community B
├── Component B → Original: Community C
└── Component C → Original: Community A
```

Sebuah vessel bisa jadi record dari sejarah universe. Component bisa bercerita
menembus beberapa perang.

### 4.4 Component Value

Value muncul dari kombinasi:

```
RARITY + CAPABILITY + COMPATIBILITY + PROVENANCE + HISTORY + DEMAND + STRATEGIC IMPORTANCE
```

> **Engineering significance should matter more than physical size.**

Sebuah subsystem kecil bisa jadi salah satu artifact paling berharga di
universe jika menyediakan capability penting. Component dari flagship
terkenal yang hancur bisa bernilai karena sejarahnya, bukan hanya fungsinya.

---

## 5. Fleet & Recovery Operations

### 5.1 Fleet Mass-Casualty

Perang besar memungkinkan komunitas kehilangan banyak vessel:

```
COMMUNITY FLEET (50 VESSELS)
→ 40 DESTROYED
→ 10 SURVIVE
```

Konsekuensi melampaui battlefield: wreckage recovery, component recovery,
engineering workload, reconstruction, loss of strategic/historical assets,
perubahan fleet capability. **Perang terus memengaruhi komunitas setelah
combat berakhir.**

### 5.2 Recovery as a Community Effort

Operasi recovery besar menjadi community projects:

```
40 WRECKS → SCOUTING → RECOVERY → ENGINEERING → RECONSTRUCTION → VALIDATION
```

Anggota berbeda berkontribusi dalam peran berbeda — memungkinkan programmer
dan non-programmer berpartisipasi dalam ekosistem yang sama.

### 5.3 Player Roles (Non-Programmer Friendly)

Universe tidak mengharuskan semua player jadi programmer:

- **Explorer** — menjelajahi universe, menemukan lokasi
- **Scout** — mengumpulkan info battlefield & environment
- **Analyst** — mempelajari vessel intelligence
- **Community Member** — partisipasi life station
- **Engineer** — mengerjakan sistem vessel/software
- **Developer** — mengubah repository/code representation
- **Recovery Specialist** — mencari & recover battlefield assets
- **Commander** — mengoordinasi operasi komunitas

### 5.4 Non-Coder Participation & Progression

Player dengan pengetahuan programming dasar tetap punya gameplay berarti lewat:
communities, stations, exploration, events, diplomacy, intelligence, scouting,
recovery, dan social systems.

Progression opsional:

```
PLAYER → COMMUNITY → COLLABORATION → LEARNING → ENGINEERING → DEVELOPMENT → VESSEL CREATION
```

ARCLUX menyediakan jalur masuk ke software engineering tanpa mengharuskan
pemain memulainya sebagai programmer berpengalaman.

---

## 6. Community Lifecycle & Social Bridge

### 6.1 Community Discovery & Visibility

ARCLUX menyediakan cara developer/player menemukan & terhubung dengan
komunitas. Sistem tidak mengasumsikan semua player sudah punya tim.

```
INDIVIDUAL DEVELOPER → ARCLUX UNIVERSE → COMMUNITY DISCOVERY
 → EXPLORE → JOIN/REQUEST → SOCIAL CONNECTION → COLLABORATION → NEW HISTORY
```

Discoverability berdasarkan: technical interests, project types, community
activity, engineering specialization, play style, community history, current
projects, open membership, collaboration opportunities.

Komunitas menentukan discoverability sendiri:

```
PUBLIC → DISCOVERABLE → MEMBERSHIP REQUIRED → INVITATION ONLY → PRIVATE
```

### 6.2 Solo Developer Participation

Player solo (1 repo, 1 vessel, limited experience, no collaborators) tidak
terhalang. Path:

```
CREATE/CONNECT REPO → GENERATE VESSEL → ENTER UNIVERSE
 → DISCOVER COMMUNITIES → MEET PLAYERS → JOIN → COLLABORATE
```

Sistem menyediakan jalur dari partisipasi individu ke komunikasi komunitas
**tanpa memaksa** player bergabung.

### 6.3 Community Projects

Komunitas mengorganisir shared projects — melibatkan banyak repository,
vessel, developer, dan member:

```
COMMUNITY → PROJECT
   ├── Repository A / B / C
   ├── Vessel Alpha / Beta
   └── Engineering Team
```

Komunitas jadi collaborative engineering organization, bukan sekadar group.

### 6.4 Community Growth

```
SOLO PLAYER → SMALL GROUP → COMMUNITY → ESTABLISHED → LARGE ORGANIZATION
```

Growth menciptakan kebutuhan baru: governance, access control, engineering
roles, station/intelligence/diplomacy/fleet/recovery management. Struktur
sosial muncul dari aktivitas player.

### 6.5 Social Hub

Station berfungsi sebagai social hub + engineering/strategic:

```
COMMUNITY STATION
  ├── SOCIAL / ENGINEERING / INTELLIGENCE
  ├── DIPLOMACY / EVENTS / PROJECTS / HISTORY
```

Player bisa: meet member, discover projects, discuss engineering, coordinate
ops, organize events, display vessels, exchange knowledge, recruit collaborators,
establish diplomacy, build identity.

### 6.6 Developer Retention Loop

Alih-alih:

```
BUILD PROJECT → PUBLISH REPO → STOP
```

The ARCLUX loop:

```
BUILD PROJECT → CONNECT REPO → CREATE VESSEL → JOIN COMMUNITY
 → BUILD RELATIONSHIPS → DEVELOP → VESSEL EVOLVES → COMMUNITY ACTIVITY
 → RETURN TO PROJECT → CONTINUE DEVELOPMENT
```

Tujuan bukan memaksa developer menjaga repo — persistent world memberi
motivasi tambahan bagi developer yang menikmati melihat software mereka
berevolusi.

### 6.7 Social Bridge for Developers

Loop bidirectional:

```
CODE → REPOSITORY → VESSEL → UNIVERSE → COMMUNITY → PEOPLE → COLLABORATION → NEW CODE
```

Code creates vessels. Vessels create gameplay. Gameplay creates communities.
Communities create collaboration. Collaboration creates new software → new
vessels. **Self-reinforcing developer ecosystem.**

---

## 7. Economic Layer & Payment Boundary

### 7.1 Economic Layer

Jika economy in-universe nanti diperkenalkan, battlefield assets bisa punya
nilai ekonomi. Value sources: rarity, engineering significance, provenance,
demand, compatibility, historical importance, strategic capability.

Economy tetap **layer design terpisah** dan tidak memerlukan nilai uang
dunia nyata.

### 7.2 Real-World Payment Boundary

Any real-world payment/trading/monetization **dispesifikasikan terpisah**
dari core battlefield mechanics.

Universe tidak mewajibkan uang nyata untuk ownership transfer biasa kecuali
secara eksplisit dirancang & diatur oleh sistem ekonomi ARCLUX.

```
GAMEPLAY ASSET  ≠  REAL-WORLD FINANCIAL ASSET
```

---

## 8. Emergent Drama

Sistem menghindari scripted drama. Drama muncul dari:

```
OWNERSHIP + TRUST + INFORMATION + WAR + RECOVERY + LOSS + HISTORY
```

Contoh emergent stories:
- a trusted member leaks strategic information
- a flagship is destroyed
- a rare component is recovered by the enemy
- a community loses access to an important asset
- an old component appears inside a rival's vessel
- communities negotiate over recovered assets
- a station becomes a center of political conflict
- a solo developer joins and becomes a trusted engineer
- a community grows from small group to major organization

> The world creates the conditions. Players create the stories.

---

## 9. Historical Artifacts & Community-Driven World Creation

### 9.1 Historical Artifacts

```
LEGENDARY FLAGSHIP → DESTROYED IN WAR → WRECKAGE DISCOVERED
 → RARE COMPONENT RECOVERED → INTEGRATED → COMPONENT BECOMES RECOGNIZED
```

Years later, players bisa menemukan component dan inspect provenance. Player
actions menjadi persistent universe history.

### 9.2 Community-Driven World Creation

Players tidak hanya mengisi universe — mereka membantu menciptakan struktur
sosialnya: identities, traditions, alliances, rivalries, projects, engineering
cultures, governance, histories, reputations, diplomatic relationships.

> ARCLUX menyediakan underlying systems. Players create the social world.

---

## 10. Engine Value Proposition

Kekuatan extension ini: engine code-intelligence menyediakan layer intelijen
yang menghubungkan:

```
REPOSITORY → GRAPH → IMPACT → VESSEL → DAMAGE → RECOVERY → HISTORY
```

Nilai kunci = **intelligence useful WITHOUT being mandatory**. Tanpa
repository intelligence, recovery kompleks butuh kerja manual memahami
file → dependency → impact → component → subsystem. Dengan ARCLUX,
hubungan ini disurface otomatis — value proposition natural untuk
engineering capabilities.

---

## 11. Ringkasan Model

```
                         ARCLUX UNIVERSE
                     ┌───────────┴───────────┐
                COMMUNITIES                VESSELS
                     │                         │
                  STATIONS                  SYSTEMS
                     │                         │
                SOCIAL HUBS               COMPONENTS
                     │                         │
              TRUST/ACCESS                    CODE
                     │                         │
              INTELLIGENCE
                     └───────────┬─────────────┘
                          COLLABORATION → WAR
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                REPAIR           DESTRUCTION      OWNERSHIP
                    │                │                │
                COMMIT           WRECKAGE          HISTORY
                 │                │                PROVENANCE
              RECOVERY        COMPONENTS              │
                    │                                 │
                    └──────────────┬──────────────────┘
                               NEW VESSEL → NEW HISTORY
                                    │
                               COMMUNITY → NEW PLAYERS → NEW PROJECTS
```

---

## 12. Access is Not Ownership — Asset Classification

Prinsip keamanan fundamental:

> **Access to an asset does not automatically mean ownership of that asset.**

Contoh:

```
PLAYER B —authorized to operate→ COMMUNITY VESSEL
```

tidak berarti `PLAYER B = OWNER`.

Sistem membedakan peran secara eksplisit:

```
OWNER → OPERATOR → MAINTAINER → AUTHORIZED USER → TEMPORARY HOLDER → COMMUNITY ADMIN
```

Ini mencegah sistem governance secara tidak sengaja mengubah permission
operasional menjadi kepemilikan.

### 12.1 Klasifikasi Aset

Setiap aset punya klasifikasi kepemilikan yang eksplisit:

```
PERSONAL
COMMUNITY
SHARED
TEMPORARY
RECOVERED
CONTESTED
```

Contoh:

```
PERSONAL VESSEL         Owner → Player A
COMMUNITY STATION       Owner → Community A
COMMUNITY COMPONENT     Owner → Community A
TEMPORARY ACCESS        Holder → Player B, Owner → Community A
```

Klasifikasi ini memungkinkan sistem disiplin beroperasi **tanpa otomatis
menyita properti pribadi** yang tidak terkait.

> **Invariant I-8:** Operational permission must never silently become ownership.

---

## 13. Authoritative Social Actions — Access Expiry, Revocation & Exclusion

Tindakan sosial mengikuti prinsip authority yang sama dengan combat (§32).

### 13.1 Access Lifetime

Access tidak harus permanen:

```
ACCESS GRANTED → EXPIRATION → REVIEW → RENEW | REVOKE
```

Berguna untuk: temporary engineers, diplomats, contractors, visiting
players, temporary alliances, recovery operations.

**Access yang sudah kedaluwarsa harus ditolak oleh authoritative validation.**

### 13.2 Access Revocation

Ketika member kehilangan trust / meninggalkan komunitas, akses dapat dicabut.
Pemicu: voluntary departure, expulsion, leadership decision, security
incident, access expiration, role change, emergency lockdown.

Tercatat secara akuntabel (bukan hukuman otomatis):

```
WHO  ·  WHAT ACCESS  ·  WHEN GRANTED  ·  WHEN REVOKED  ·  WHO AUTHORIZED  ·  REASON / EVENT REF
```

### 13.3 Community-Specific Exclusion

Komunitas bisa memelihara status eksklusi internal:

```
TRUSTED → SUSPENDED → RESTRICTED → EXPELLED
```

Konsekuensi yang mungkin (ditentukan komunitas):

- station access denied
- strategic information access denied
- community channels restricted
- community-owned asset access revoked
- engineering permissions revoked
- recovery operations restricted

> **Blacklist bersifat community-specific.** Pemain yang dikeluarkan dari
> Community A tidak otomatis menjadi "penjahat global" menurut ARCLUX (§19).

### 13.4 No Automatic Universal Confiscation

Status blacklist **tidak** otomatis memindahkan kepemilikan semua aset pemain:

```
PLAYER BLACKLISTED
       ↓
CHECK ASSET OWNERSHIP
       ↓
┌───────────────┬─────────────────┐
│ PERSONAL      │ COMMUNITY       │
│ remains       │ governed by     │
│ personal      │ community rules │
└───────────────┴─────────────────┘
```

Kepemilikan dievaluasi menurut catatan kepemilikan aktual aset — mencegah
governance menjadi mekanisme penyitaan tanpa batas.

### 13.5 Community Asset Recovery

Jika member yang diusir mengontrol aset yang tercatat community-owned,
komunitas dapat menjalankan prosedur recovery-nya sendiri:

```
COMMUNITY VESSEL → AUTHORIZED OPERATOR → MEMBER EXPELLED
→ ACCESS REVOKED → RECOVERY PROCEDURE → VESSEL RETURNED TO COMMUNITY
```

Ini BEDA dari menyita vessel pribadi pemain. Recovery adalah tindakan
**authoritative** dan dicatat sebagai world event.

---

## 14. Governance Event Model

Aksi governance penting menjadi historical events yang persisten.

Daftar event (dari V3 proposal):

```
community.member.joined
community.member.promoted
community.member.suspended
community.member.expelled

access.granted
access.expired
access.revoked

station.lockdown.enabled
station.lockdown.disabled
station.gate.opened
station.gate.closed
station.safezone.enabled
station.safezone.disabled

community.asset.recovery.started
community.asset.recovered

information.classified
information.disclosed

leadership.transferred
```

Sebuah governance event berisi:

```
EVENT
├── eventId
├── actor
├── target
├── action
├── timestamp
├── previousState
├── resultingState
├── authorizationContext
└── references
```

> **Invariant I-7:** History cannot depend solely on client claims — event
> penting harus berasal dari state server authoritative, bukan klaim client.

---

## 15. Multi-Signature & Emergency Governance

### 15.1 Multi-Signature

Keputusan berimpak tinggi dapat memerlukan banyak persetujuan (dikonfigurasi,
jumlah & role approver ditentukan komunitas):

```
REQUEST → LEADER APPROVAL + COUNCIL APPROVAL → ACTION EXECUTED
```

Contoh: revoke akses member senior, revoke strategic access, transfer aset
besar, ubah station security policy, buka restricted access, deklarasi
emergency, ubah safe-zone protection state.

### 15.2 Emergency Lockdown (Authoritative State)

```
SECURITY INCIDENT → EMERGENCY LOCKDOWN → RESTRICTED ACCESS
→ AUDIT → GOVERNANCE DECISION
```

Selama lockdown:

- strategic access ditangguhkan sementara
- station permissions dikurangi
- informasi sensitif jadi restricted
- community-owned assets ditempatkan di bawah controlled access

> Lockdown adalah **state authoritative** — tercatat sebagai world event dan
> memengaruhi WorldValidator, bukan sekadar indikator visual.

### 15.3 Gate / Access State Transition

```
STATION
   ├── Gate CLOSED → Safe Zone ACTIVE
   └── Gate OPEN   → Protection Policy Changes
```

Transisi gate-state **bukan visual** — harus:

1. require authorization
2. modify authoritative world state
3. affect WorldValidator behavior
4. generate a world event
5. menjadi bagian persistent history

Event: `station.gate.opened`, `station.gate.closed`,
`station.safezone.enabled`, `station.safezone.disabled`.

> **Invariant I-4:** Gate state is authoritative — visual gate state ≠ actual
> permission.

---

## 16. Dynamic Safe-Zone / Gate (Governing Protection)

Safe zone statis sudah didokumentasikan (02 §8-9). V3 memperkuatnya dengan
membuat **state & policy proteksi dapat digovern secara authoritative**:

```
SAFE ZONE
├── radius
├── attack policy
├── access policy
├── community policy
└── current state
```

Saat aktif:

```
SAFE ZONE ACTIVE → TARGET INSIDE PROTECTED RADIUS → WORLD VALIDATOR → ATTACK REJECTED
```

Saat later / governance-controlled change:

```
SAFE-ZONE ACTIVE → AUTHORIZED GOVERNANCE ACTION → SAFE-ZONE DISABLED
→ WORLD EVENT → COMBAT POLICY CHANGES
```

> Perubahan proteksi harus mengubah **validasi authoritative**, bukan sekadar
> mengubah indikator visual.

Implementasi menempel pada `packages/gameserver` (validator/simulation):
state proteksi menjadi input WorldValidator — dasar untuk §13-15.

---

## 17. Community Splits & Forked Lineage

Komunitas dapat mengalami perpecahan politik internal:

```
COMMUNITY → INTERNAL DISPUTE → LEADERSHIP CONFLICT
→ MEMBER GROUP SPLITS → NEW COMMUNITY → SHARED HISTORY
```

Aset & repository mengikuti aturan ownership/governance eksplisit — **bukan
duplikasi otomatis yang sewenang-wenang**.

Kedua komunitas hasil pecahan dapat mempertahankan referensi asal:

```
COMMUNITY A → INTERNAL SPLIT → (A1, A2) → Origin: Community A
```

sambil mengembangkan identitas independen setelahnya — sejarah organisasi
bertahan melintasi garis keturunan komunitas.

---

## 18. Vessel Identity, Provenance & 3D Representation

### 18.1 Vessel Identity Layer

1 repository → 1 vessel. Namun vessel bukan sekadar kontainer stat combat — ia
punya identitas persisten:

```
Vessel
├── Repository Identity
├── Owner
├── Community
├── VesselModel
├── Systems
├── Components
├── World State
├── Provenance
├── Governance References
└── Visual Representation
```

Lifecycle persisten:

```
REPOSITORY → CONNECTED → VESSEL SPAWNED → MODIFIED → COMBAT → DAMAGED
→ RECOVERED → REPAIRED → HISTORY RETAINED
```

### 18.2 Authoritative vs Client Representation

```
AUTHORITATIVE WORLD              CLIENT REPRESENTATION
packages/universe                    ↓
  → VesselModel                     3D Vessel
  → gameserver                    mesh / materials / animation /
  → WorldEntity                  lighting / effects / camera
```

- Server menentukan: position, velocity, heading, ownership, systems, world
  state, combat results.
- Client menentukan: mesh, materials, lighting, effects, camera, presentation.

> **Invariant I-1:** Client is not authoritative — client representation never
> becomes the source of truth.

### 18.3 Damage → Visual State (Non-Authoritative)

```
Weapons: 100 → Combat → Weapons: 88 → Client Visual State
  (ACTIVE / DAMAGED / DISABLED / DESTROYED)
```

> Visual state is never authoritative. State authoritative tetap di game server.

### 18.4 Provenance + Governance Coexist

```
COMPONENT X
Technical:  Original Owner: A · Vessel: Alpha · Battle: War #27
            Recovered By: B · Integrated: Beta · Current: B
Governance: Community A → granted engineer access → Engineer X
            → access revoked → Engineer X → expelled
```

Sejarah teknikal & sejarah sosial hidup berdampingan — governance tidak pernah
menghapus provenans teknis.

### 18.5 Kapal = Kode, dan Kerusakan Ikut Menyentuh Kode

Kapal adalah repository (D-007). Ini bukan metafor belaka — **kerusakan kapal
berdampak ke "kode" kapal**, dan pemain harus *debug*:

```
KAPAL RUSAK (thermal/collision/combat)
   ↓
BASELINE / SUBSYSTEM TERPENGARUH (imun hilang? sistem dasar turun?)
   ↓
KAPAL "TIDAK BERFUNGSI" → harus diperbaiki / debug
   ↓
REPAIR → berfungsi lagi (lihat 03 damage, 04 recovery)
```

- Kerusakan (termasuk thermal melt dari 01 §2.6, collision dari 03 I.9) memengaruhi
  sistem kapal.
- **ARCLUX Universal Baseline** (05 §7.1) ikut terdampak: mis. kehilangan sebagian
  baseline → kapal kehilangan kemampuan dasar/angkasa sampai diperbaiki.
- Repair/recovery mengembalikan fungsi (04 §recovery); provenance tetap mencatat
  sejarah kerusakan.

### 18.6 Identitas Sosial / Callsign (label faksi & nama)

Setiap vessel/player tampil di HUD/overlay dengan **identitas sosial** agar pemain
langsung tahu kawan vs lawan:

```
[KOMUNITAS A]  [GSF-xxxx]  [username]   ← label di overlay (01 §20)
```

- **Authoritative**: siapa owner/community ditentukan server (06 §18.2, I-1);
  label cuma representasi client.
- Nama frame berasal dari vessel identity (§18.1: Repository Identity + Owner +
  Community) dan repo unik prefix user.
- Tidak ada "pemenang/loser" — label murni penanda kawan/lawan, bukan sistem skor.

### 18.7 Intel, Kordinat & Mobilisasi Armada (drama EVE-style)

Pemain/kapal dapat **membagikan titik (koordinat/waypoint)** medan atau titik
kumpul ke aliansi, untuk koordinasi armada pada konflik besar:

```
PERANG BESAR
   ↓  kapal berbagi TITIK (koordinat / titik kumpul / waypoint medan)
   ↓  tersebar ke ALIANSI (beberapa komunitas bersekutu; intel, lihat §3)
   ↓  kapal sekutu melihat titik di peta (tactical marker, 01 §2)
   ↓  terima → GERAK terbatas (lihat §18.8) → mobilisasi
```

- Berbagi posisi ber-label: muncul **nama kapal/nama org** pengirim (18.6) + koordinat.
- Restriksi intel mengikuti access/trust (§3.2/§3.3); intel bisa bocor (§3.6) →
  drama tambahan.
- **Alian/i** = beberapa community yang bersekutu (diplomasi, §8). Bukan konsep
  "sisi vs sisi dengan hasil menang/kalah" — open world, hasil dari keputusan &
  gerak.

### 18.8 Mobilisasi Terbatas (2-Teleport) + Portal

Kapal yang menerima titik dapat bergerak ke sana dengan jendela pergerakan
terbatas — **bukan teleport bebas**, bukan jump gate navigasi (01 §14):

```
TERIMA TITIK  →  catat TITIK ASAL (anchor)
   →  TELEPORT #1 (portal)  →  masuk medan perang
   →  (bertempur / membantu / batal)
   →  TELEPORT #2 (portal)  →  BALIK ke TITIK ASAL
```

- **Batas 2 teleport per aktivasi bantuan**: 1 ke titik, 1 balik ke titik asal.
  Tidak bisa teleport ke tempat lain.
- **Cooldown panjang** → bukan "mobil gratis"; ada harga keputusan.
- **Animasi portal** cinematic saat masuk/keluar (feedback EVE-level, lihat UI 01).
- Bukan teleport antar-map/maintenance; murni **mobilisasi respon konflik** (bukan SOS
  instan — melainkan koordinat yang dibagikan, §18.7).

---

## 19. Definition of Done (V3)

Dianggap konseptual lengkap ketika:

- [ ] Community dapat mendefinisikan access policy
- [ ] Roles & permissions terdiferensiasi dari ownership (I-8)
- [ ] Assets punya klasifikasi kepemilikan eksplisit (§12)
- [ ] Access dapat expire (§13)
- [ ] Access dapat direvoke (§13)
- [ ] Exclusion community-specific ada, tanpa auto-confiscation (§13)
- [ ] Community-owned assets dapat memulai recovery (§13.5)
- [ ] High-impact governance dapat memerlukan multi-approval (§15)
- [ ] Emergency lockdown ada sebagai state authoritative (§15)
- [ ] Station permissions authoritative (§15)
- [ ] Safe-zone state dapat digovern (§16)
- [ ] Governance events persisten (§14)
- [ ] Accusations terdiferensiasi dari verified events (kepercayaan, §8)
- [ ] Intelligence events mempertahankan attribution (intelijen, §3)
- [ ] Community history persisten (§9)
- [ ] Community splits melestarikan lineage (§17)
- [ ] Vessel identity persisten (§18)
- [ ] Repository tetap sumber vessel (§18 + 05)
- [ ] Vessel provenance bertahan melalui recovery & pergantian pemilik (04)
- [ ] Representation 3D tetap client-side (§18)
- [ ] Client tidak bisa override state authoritative (I-1)
- [ ] Self-hosted regions tetap kompatibel
- [ ] Private repository secrets tetap di luar gameplay (§3.5)

---

## 20. Ringkasan Model (V3)

```
                          ARCLUX UNIVERSE
                                │
                ┌───────────────┴───────────────┐
                │                               │
          COMMUNITIES                        VESSELS
                │                               │
          GOVERNANCE                         SYSTEMS
                │                               │
             TRUST                         COMPONENTS
                │                               │
             ACCESS                            CODE
                │                               │
          INFORMATION                          │
                │                               │
                └───────────────┬───────────────┘
                                │
                         PLAYER ACTION
                                │
                   ┌────────────┴────────────┐
                   │                         │
              COOPERATION                CONFLICT
                   │                         │
                   │                    INTELLIGENCE
                   │                         │
                   │                       LEAK
                   │                         │
                   │                    GOVERNANCE
                   │                         │
                   └────────────┬────────────┘
                                │
                       ACCESS / OWNERSHIP
                                │
                           CONSEQUENCE
                                │
                            PROVENANCE
                                │
                             HISTORY
                                │
                         COMMUNITY MEMORY
                                │
                       NEW SOCIAL RELATIONS
```

Code creates the vessel.
The vessel creates gameplay.
Gameplay creates relationships.
Relationships create trust.
Trust creates access.
Access creates responsibility.
Actions create consequences.
Consequences create governance.
Governance creates history.
History creates community identity.

Players create the events. ARCLUX preserves the consequences.
