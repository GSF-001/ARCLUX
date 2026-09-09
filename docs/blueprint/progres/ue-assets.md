# UE ASSET DEPLOYMENT — dari gudang ke universe (10.V DONE → UE)

> Status: **SPEC-FINAL (pegangan slice UE).** Induk: `migrasi-ue.md`
> (strategi) + `10-visual-fidelity.md` (ART). Dokumen ini menjawab:
> SETELAH aset dibeli/download, BAGAIMANA tiap aset dikerahkan ke UE —
> multi-fungsi, multi-biome, multi-planet. Satu aset, banyak badan.
> Bahasa dokumen dijaga sederhana — pelaksana (SAAT ini AI, nanti
> artis UE) membaca tanpa perlu tanya ulang.

## 0. Doktrin (tidak bisa ditawar)

1. **Satu aset, banyak badan (multi-fungsi).** Tekstur pasir dipakai
   di gurun + pantai + bulan (grade beda). Satu HDRI dipakai di 3
   planet (rotasi + tint + awan beda). Satu batu dipakai di tebing +
   asteroid + bulan. Beli sekali, dandanin banyak planet.
   DILARANG beli varian baru untuk beda yang bisa dicapai grade/
   tint/scale (contoh: "pasir bulan" vs "pasir gurun" = SATU tekstur,
   dua grade — bukan dua pembelian).
2. **Planet bermil-mil = multi-biome.** SATU planet WAJIB ≥3 biome
   (contoh: gurun + gunung + laut + hutan). Alam yang sama di
   semua titik = planet mati. Biome dipilih dari seed (deterministik,
   sama di semua client).
3. **Dibangun, bukan dibeli (monumen).** Piramida, obelisk, monolit,
   ring kuno = geometri prosedural KITA (murah, seeded, LOD).
   DILARANG beli monumen — bentuknya primitif monumental, seninya
   ada di SKALA + penempatan + grade, bukan di ukiran.
4. **Setiap struktur = POI bermakna.** Kastil, wreck, monumen,
   reruntuhan = discovery (ping + label + suara, pola R1.1) ATAU
   wreck bersejarah (plaque, pola R1.2). Hiasan tanpa alasan =
   sampah visual, DILARANG.
5. **Open UNIVERSE, bukan world.** Skala antar-benda = universe
   (orbit, bulan, sabuk). Skala kaki = tether (lihat §5).

## 1. Peta biome per planet (template, seed yang mengisi)

| Biome | Tanah/tekstur | Struktur (POI) | Air | Catatan |
|---|---|---|---|---|
| Gurun | pasir HDRI/tekstu | PIRAMIDA + monumen (§2) | oasis kecil | Pyramid = 1 per gurun (landmark) |
| Gunung | rock + snow cap | kastil di puncak + monumen sejarah | danau kawah | Kastil langka (R1.1 discovery) |
| Hutan | forest floor | reruntuhan + kastil kecil | sungai → laut | Kanopi prioritas udara (A1) |
| Laut/pantai | sand → shallow → open | KAPAL karam (wreck 04!) + pulau + karang | ocean shader | Wreck = sejarah beneran, bukan hiasan |
| Bulan (airless) | regolith + kawah | monolit + outpost | TIDAK ADA | Tanpa atmosfer: bayangan keras, langit hitam |

Satu planet = 3–5 baris tabel ini (seed pilih + susun). Planet kedua =
kombinasi + palet beda. **Mars = ganti baju, bukan beli planet baru.**

## 2. Monumen prosedural (dibangun — spesifikasi)

Fungsi `buildMonument(kind, seed, scale)` (UE: Blueprint/C++,
three.js: skip — UE saja):

- `PYRAMID` — stepped (5–9 undakan, proporsi emas), skala SUPER
  (tinggi 200–600m — terlihat dari orbit rendah, itu gunanya),
  material sandstone + grade gurun, pintu gelap 1 (discovery trigger).
- `OBELISK` — monolit + cap emas emissive tipis (navigasi visual
  malam), tinggi 50–150m, selalu berkelompok 2–3 (gerbang).
- `RING` — lingkaran batu (6–12 pillar), di puncak gunung/padang —
  monumen SEJARAH (plaque lore, pola R1.2).
- `MONOLITH` — bulan saja, hitam metalik, 1:4:9 (proporsi
  sengaja — easter egg, diam-diam saja).
- Semua: LOD (jauh = siluet), seeded (posisi tetap), malam =
  edge-light tipis (ditemukan dari jauh = momen).

## 3. Aturan penempatan (sistem, bukan tangan)

- Piramida: 1 per gurun, di dataran ±2km dari apa pun (kesendirian =
  keagungan). terlihat dari approach udara.
- Kastil: puncak gunung TERTINGGI region ATAU tebing laut (2 spot
  paling dramatis, pola vista §5).
- Wreck laut: situs perang beneran (arsip 04) + 2–3 wreck acak seeded
  di shallow (karang di sekitarnya — bahaya navigasi = gameplay).
- Pulau: 3–7 per laut, 1 berpenghuni POI (mercusuar/monumen),
  sisanya kosong (empty-land, bisa dibangun pemain!).
- Monumen sejarah: dekat POI gunung + plaque (lore universe,
  ditulis sekali, dibaca selamanya).
- JARAK MINIMUM antar-POI: 5km (langka = berharga; dekat-dekatan =
  pasar malam).

## 4. Kapal hanya mendarat di lahan kosong (hukum, sudah ada)

Empty-land rule (Blueprint 10 §10 + `canAutoLand` + `canBuildOnEmptyLand`):
permukaan ditempati POI/monumen/air/tebing = TOLAK; datar + kosong =
TERIMA. Di UE: visualisasikan (landing guide hijau/merah di HUD saat
approach — pilot TAHU sebelum ditolak, bukan kaget).

## 5. FPS tether — kaki tidak boleh jauh dari kapal (IDE BARU, FINAL)

Pemain turun jalan kaki = radius MAKSIMUM dari kapal sendiri
(`FPS_TETHER_RADIUS = 1000` meter, konstanta bernama, tunable):

- Alasan desain: LOD/streaming budget (microdetail LOD0 hanya
  dijamin di radius ini) + kapal = basecamp (kembali = kembali).
- Alasan fiksi: life-support tether ke kapal (ditulis di lore,
  bukan "dinding tak terlihat" murahan).
- Penegakan: client blokir gerak + HUD notice ("TETHER LIMIT —
  kembali ke kapal"); server validasi jarak saat fase otoritasnya
  tiba (backlog validator, BUKAN sekarang).
- Visual: shimmer holografik tipis di batas (numpang grade pass,
  murah) + audio warning (U9).
- Pengecualian: interior stasiun (bukan planet — bebas, aturan
  sendiri) + event khusus (director boleh longgarkan sesaat).

## 6. Urutan pengerahan (setelah 10.V DONE → UE)

1. Gudang: `ARCLUX-assets/inbox → keep/` + ledger PLANET-PACK
   (kurasi batch per pack, makna = wewenang creative director).
2. Slice UE 2–3: HDRI langit + terrain biome + ocean shader (planet
   bernyawa TANPA struktur dulu — alam dulu, misteri kemudian).
3. Slice UE 4: POI + monumen (§2–§3) + discovery/wreck UI (R1.1/R1.2).
4. Slice UE 5: FPS tether (§5) + landing guide (§4 visual).
5. Acceptance: descend sequence (orbit → monumen terlihat → laut +
   wreck → landing guide hijau → touchdown → jalan 1km + kembali).
   Satu untaian, bukan efek lepas (aturan §5 sepuluh-V).

## 7. Anti-boros (ditempel di pintu gudang)

- 1 aset multi-badan (§0.1). Beli varian = butuh alasan tertulis.
- Master EXR/HDR diarsip; runtimesesuai tier (aturan M1.5 diskala).
- LOD dulu, deploy kemudian — aset tanpa LOD = aset mentah,
  DILARANG masuk `keep/`.
- Tiap aset di ledger: `file → badan → biome → fase → LOD → MB`.
  Tanpa baris ledger = tidak ada di universe. NOL barang hilang,
  NOL barang nganggur (janji gudang).
