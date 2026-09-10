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
6. **Kit modular, bukan satuan jadi.** Satu kit modular (dinding,
   lantai, pipa, pintu dalam satu grid) merakit hangar, koridor,
   dan interior outpost TAK TERBATAS via PCG dan pemain. Pembelian
   atau penerimaan model JADI per lokasi DILARANG kecuali hero
   piece (black hole, fortress) yang tidak dapat dirakit.
   Rumus: 100 aset modular × PCG × decay × grade = puluhan ribu
   variasi. Jumlah kecil, anak banyak.
7. **Graybox: geometri, material, dan penempatan TIDAK BOLEH
   campur.** Pemodel menyerahkan BENTUK (abu-abu polos = SAH,
   standar industri); SISTEM memberi RASA (material M1/Megascans/
   Material Instance); PCG/pemain menentukan TEMPAT. Model tanpa
   warna bukan cacat — model dengan UV berantakan adalah cacat.

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

## 8. Kit modular dan graybox workflow (FINAL)

8.1. Syarat ekspor potongan kit (berlaku untuk seluruh kit,
disusun pemain maupun tim internal):
1. Satuan METER (1 unit = 1 m); seluruh potongan satu kit
   mengikuti SATU grid (misalnya kelipatan 4 m).
2. Pivot pada titik snap (contoh: dinding = tengah-bawah pada
   permukaan lantai), bukan tengah massa — agar penempelan PCG
   presisi tanpa mengambang atau terbenam.
3. Penamaan = fungsi (`wall_4m`, `floor_4x4`, `pipe_L`,
   `door_frame`); nama generik (`Cube.027`) DITOLAK validator.
4. Tekstur ter-embed dalam GLB single-file.
5. UV rapi dengan skala konsisten (SATU-SATUNYA syarat geometri
   yang tidak bisa ditawar — material sistem bergantung padanya).
6. Slot material terpisah per permukaan fungsional (contoh: badan
   metal + strip lampu = 2 slot, tanpa perlu warna — sistem yang
   mengisi).
8.2. Prioritas pengadaan kit: (1) dinding/lantai/pipa sci-fi
(hangar + koridor + interior outpost, satu kit tiga guna);
(2) batuan modular (kosakata PCG nomor satu); (3) parts outpost
(gerbang, menara, kontainer, tangki); (4) lampu dan parts
landasan.
8.3. Aturan belanja: anggaran NOL sampai slice UE berjalan
(gratisan + Megascans mencukupi bukti konsep). Pembelian HANYA
apabila: celah spesifik memblokir slice + tidak ada alternatif
gratis + berbentuk kit modular (bukan satuan).

## 9. Taksonomi gudang dan lisensi (FINAL)

9.1. Struktur folder tetap (pelanggaran grammar = PR ditolak):

```
keep/
  kit-<tema>/
    walls/ floors/ pipes/ lamps/ rocks/ ...
```

Grammar: `kit-TEMA/kategori/nama_UKURAN_varian`. Pencarian
barang via folder dan ledger, bukan via ingatan.
9.2. Seluruh aset berlisensi marketplace (UCreate dan sejenisnya)
wajib berada pada repo PRIVATE. Lisensi marketplace pada umumnya
mengizinkan pemakaian DALAM permainan komersial namun MELARANG
redistribusi berkas mentah pada repo publik. Repo aset ARCLUX
bersifat private; pemisahan CC0-publik dipertimbangkan kemudian
apabila diperlukan.
9.3. Hangar privat merupakan domain pemain (dibangun pemain via
pipeline 02); hangar publik merupakan infrastruktur dunia
(dikerahkan via dokumen ini).
