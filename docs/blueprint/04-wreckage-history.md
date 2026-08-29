# 🏛️ ARCLUX — Wreckage & Hall of Fame (Museum Sejarah)

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

## Wreckage Archive

Setiap puing jadi historical artifact dengan entri permanen (ID, identitas,
event, status, komponen recover):

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

Sumber kehancuran **tidak hanya pertempuran**. Kapal yang menabrak benda
langit COLLIDABLE (asteroid, meteor, planet — lihat [01-spatial-ux.md]
(01-spatial-ux.md) §2.2 dan [03-combat.md](03-combat.md) I.9) dan hancur juga
masuk Wreckage Archive dengan provenance utuh. Entri "Last Event" mencatat
penyebabnya (battle / environmental / recovery), sehingga sejarah kehancuran
terjaga selengkap battle regular.

## Puing membawa provenance

Bagian terkuat dari konsep ini. ARCLUX menyimpan jejak hidup sebuah component:

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

### Physical Provenance vs Architectural Lineage

ARCLUX membedakan dua jenis jejak sejarah yang **tidak boleh dicampur**:

**Physical Provenance** — jejak fisik komponen:

```
Component X
   → Created by Developer A
   → Installed on Vessel A
   → Transferred to Fleet B
   → Destroyed in Battle #72
   → Recovered
   → Hall of Fame / Wreckage Archive
```

**Architectural Lineage** — jejak evolusi desain:

```
Design A
   → Redesigned after Incident #8291
   → Design B
   → Further optimized after environmental failure
   → Design C
```

Physical provenance melacak **apa yang terjadi pada komponen fisik**.
Architectural lineage melacak **bagaimana desain berevolusi karena pengalaman
dunia**. Keduanya berkontribusi ke engineering intelligence, tetapi
mewakili hal yang berbeda (cross-ref 08 §6.1 Incident Model).

## Hall of Fame = museum sejarah ARCLUX

Bukan leaderboard:
- 🏆 legendary vessels
- ⚔️ major battles
- 🧩 recovered components
- 🚀 retired vessels
- 🏛️ wreckage
- 📜 historic events
- 👥 legendary communities

Pemain baru bisa datang dan melihat sejarah: *"Kapal ini pernah terlibat
perang terbesar tahun lalu."*

## Filosofi yang konsisten

ARCLUX tidak perlu membuat semua cerita. Developer & komunitas menciptakan
kejadian → ARCLUX menyimpan & memvisualisasikan sejarahnya. Semakin lama
universe hidup, semakin banyak sejarah yang terbentuk — itulah yang membuat
ARCLUX terasa seperti **dunia**, bukan sekadar game yang punya map.
