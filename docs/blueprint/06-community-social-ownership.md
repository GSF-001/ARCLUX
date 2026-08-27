# 🛰️🤝 ARCLUX — Community, Social Connection & Battlefield Ownership

> A battle should not simply determine who wins. It should determine what
> survives, who owns it, what knowledge is lost, what knowledge is gained,
> who trusts whom, who joins whom, and what history remains.

Bagian dari blueprint ARCLUX (Repository War Universe). Extension V2.

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
