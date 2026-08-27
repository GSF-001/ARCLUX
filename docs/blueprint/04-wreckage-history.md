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
