# ASSET PIPELINE — user membangun dunia (vessel tetap, aset baru)

> Status: **SPEC-FINAL (eksekusi: fase UE, setelah 10.V DONE).**
> Induk: 05 (vessel pipeline, pola), 02 §11 (market), 07 (cap),
> 04 (wreckage/ruins), 08 (persist), R1.1/R1.2 (discovery/plaque).
> Prinsip satu kalimat: **vessel = otak, aset = badan; pemain
> membangun, ARCLUX memvalidasi; dunia yang memutuskan.**
> Anti-duplikasi: cap kapal/induk = lama (07). Crafting queue,
> lifecycle 30-hari, dan konten infrastruktur = BARU (keputusan
> creative director, sesi ini).

## 0. Split FINAL: badan vs otak (tidak bisa ditawar)

```
ASSET (badan)                 VESSEL (otak)
mesh + material               systems + operation
kapal, hangar, rumah,         engine/reactor/weapon/
reruntuhan, monumen, props    defense/nav + crew
di-upload + dirakit           mengoperasikan
```

- Kapal terbang = badan (asset) + otak (vessel) kawin.
- Hangar/rumah/stall = badan saja.
- Reruntuhan/monumen = badan tanpa otak (lore/POI).
- Aturan lama TETAP: kapal aktif per pemain = 1 (ganti bebas),
  kapal induk per community = 2 (07 §5 — `enforceCapitalLimit`
  yang mati WAJIB dihidupkan saat fase ini).

## 1. Manifest + submit (mirror vessel, lebih enteng)

```
repo-user/.arclux/assets/<nama>/
  model.glb (+ tekstur)
  asset.arclux.json:
    { kind, license: open|shared|private, kelas: kecil|besar,
      poly, lod: true, biome: [gurun, hutan, ...],
      poi: none|discovery|wreck|landmark }
```

- Validasi (server, murah — TANPA sim): schema + budget poly/VRAM +
  kelas + biome-fit + whitelist infrastruktur (§5) + moderation
  (pola 05 §9). Gagal = tolak + alasan. Lolos = antre rakit (§3).
- Aset = NOL authority (murni visual). Pipeline paling aman:
  file jahat tidak bisa menyentuh gameplay APAPUN.

## 2. Cap per pemain (FINAL)

| Kelas | Cap aktif | Contoh |
|---|---|---|
| Besar | 5 | hangar, rumah, kastil kecil, kapal-badan |
| Kecil | 30 | peti, lampu, patung, stall, monolit mini |

- Bebas pindah/susun ulang dalam cap (move se-region = re-deploy
  singkat; lintas region = rakit ulang penuh §3).
- Repo diganti/ dihapus SETELAH deploy = TIDAK NGARUH (deploy =
  snapshot beku — anti bait-and-switch: taro gubuk → ganti file
  jadi patung vulgar = MUSTAHIL, update = submit + rakit ulang).

## 3. Crafting queue (upload ≠ jadi)

File lengkap (tempel sekali), WUJUD dirakit drone (fiksi, bukan
loading murahan). Antrean di SERVER (timestamp + persist 08 —
restart tidak reset). 1 slot rakit per pemain (+1 tier veteran).

| Kelas | Contoh | Waktu rakit | Visual saat dibangun |
|---|---|---|---|
| Kecil | props | menit | crate + drone |
| Struktur | hangar/rumah | jam | scaffold + crane |
| Besar | kastil/modul | belasan jam | site konstruksi |
| Capital | induk | hari | drydock + las |

- Spam mustahil (100 file siap pun antre). Scaffold = eye candy +
  target raid (gameplay gratis). Instant-finish = PARKIR
  (monetisasi — JANGAN disentuh sampai komersil).

## 4. Lifecycle: klaim 30-hari + usia 1–2 tahun (FINAL)

- Aset berdiri 30 hari TANPA diubah/dipindah → ARCLUX KLAIM OTOMATIS
  jadi MONUMEN PERMANEN (kepemilikan pindah ke DUNIA, nama builder
  di plaque — abadi + credited). Hapus repo pun monumen tetap.
- Monumen berumur 1–2 tahun (seeded per aset) → meluruh jadi
  RERUNTUHAN/puing (tetap POI, pola 04 — kehancuran = konten).
- Loop penuh: bangun → klaim → monumen → reruntuhan → sejarah.
  NOL yang terbuang — bahkan lapuk pun jadi isi dunia.

### Usang, lumut & karat — aset hidup, bukan patung (FINAL)

Berdiri ≠ abadi. Semua aset/badan kapal punya USIA PAKAI yang
berjalan saat TIDAK DIGUNAKAN (validator: `lastActiveTick` per aset,
otoritas server — client tidak bisa memalsukan umur):

| Tahap | Pemicu | Visual (numpang rel EXISTING) | Efek |
|---|---|---|---|
| BERSIH | dipakai/dirawat | normal | penuh |
| BERDEBU | 30 hari tak aktif | tint kusam + lumut tepi (aset karat/lumut gudang!) | -5% (peringatan HUD) |
| BERKARAT | 60 hari tak aktif | rust patch D1.4 + roughness naik (M1 map digeser!) | -15% + subsystem flicker (D1.2) |
| RUSAK | 90 hari tak aktif | scar penuh + panel hilang (D1.4) | NONAKTIF sampai repair |

- Aktivitas me-reset timer: terbang, pindah, repair, atau BERSIHKAN
  (aksi murah 5 menit — pelaut merawat kapal; pajangan berdebu).
- Hangar TIDAK melindungi (keputusan FINAL — besi diam = besi mati).
- Repair = commit (pola 02 §12 EXISTING: biaya + waktu + station) —
  BUKAN tombol gratis. Kapal hancur = rebuild dari source vessel
  (aturan lama, tetap).
- Aset karat/lumut yang DIBELI = tekstur tahap BERDEBU/BERKARAT
  (gudang sudah kaya — tinggal tempel ke stage, NOL kerja art baru).
- Monumen klaim (§4 atas) KEBAL usang tahap RUSAK (sejarah tidak
  boleh mati total) tapi tetap BERLUMUT visual (tua = wibawa —
  lumut monumen = FITUR, bukan bug).

### Gotong-royong — bangun bareng pake aset sendiri (FINAL)

Pemain/komunitas boleh deploy aset SENDIRI (masuk cap sendiri §2)
di radius proyek komunitas (flag site PUBLIC, radius 2km):

- Bantu bangun = aset nempel di site orang, milik TETAP milikmu
  (registry tidak pindah — beda dengan klaim 30-hari §4).
- Site owner bisa ENDORSE (plakat "dibangun bersama X, Y, Z" —
  reputasi 06, bukan bayaran).
- Batas: 1 pemain max 5 aset per site orang (anti-aneksasi:
  bantu ≠ jajah).
- Cabut kapan saja (aset kembali ke cap-mu, site berlubang —
  konsekuensi sosial, bukan hukuman sistem).

## 5. Konten: infrastruktur SAJA (ARCLUX aman)

- Whitelist kelas (mirror vessel): hunian, hangar, ibadah, niaga,
  monumen, jalan/lampu, pertahananSETTLEMENT (bukan senjata aktif).
- DITOLAK: vulgar, ilegal, lore-breaker (air jadi lava, kastil
  melayang, teks iklan). Biome-fit wajib (iglo di gurun = tolak).
- Penempatan = wewenang DUNIA (empty-land + jarak min 5km POI +
  biome). User NGAJUIN, sistem NARO. Kastil di orbit = mustahil
  struktural, bukan dimarahi GM.

## 6. Marketplace + discovery (flywheel)

- Builder publish → explorer discovery (R1.1 ping/label/suara) →
  plaque + marketplace (pola 02 §11: beli/sewa/lisensi) → builder
  semangat → loop. Konten tumbuh sendiri, tim konten = pemain.
- Wreck kapal perang (04) OTOMATIS jadi aset dunia (bukan submit) —
  sejarah menulis dirinya sendiri.

## 7. Eksekusi (fase UE, setelah 10.V DONE)

1. Manifest + validator + registry (server, murah).
2. Crafting queue + persist + scaffold visual.
3. Placement system + discovery/plaque wiring.
4. Cap enforcement + 07 limit dihidupkan + lifecycle timer.
5. Marketplace aset (ikut ekonomi 02/06).
- Acceptance: submit → scaffold → jadi → 30 hari → monumen →
  2 tahun → reruntuhan. Satu loop penuh, tercatat di ledger.
