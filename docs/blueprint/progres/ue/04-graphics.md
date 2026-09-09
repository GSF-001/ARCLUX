# 04 — SPESIFIKASI GRAFIS ARCLUX UE5 (flagship client)

> Dokumen: spesifikasi teknis grafis. Status: SPEC-FINAL.
> Induk: `00-migrasi.md` (strategi), `10-visual-fidelity.md` (arah seni),
> `01-assets.md` (pengerahan aset), `03-implementasi.md` (peta file).
> Audiens: insinyur grafis dan artis teknis UE5.
> Konvensi bahasa dokumen ini: formal, definitif, tanpa idiom informal.

## 1. Tujuan dan ruang lingkup

1.1. Dokumen ini menetapkan arsitektur rendering, subsistem grafis,
aliran aset, anggaran performa, dan kriteria penerimaan klien
flagship ARCLUX berbasis Unreal Engine 5 (selanjutnya "Klien UE").
1.2. Ruang lingkup mencakup seluruh lapisan presentasi permainan
(world, vessel, planetary, cuaca, kokpit, UI, audio, pasca-proses).
Logika permainan, otoritas, dan persistensi berada DI LUAR ruang
lingkup (tetap pada server TypeScript — lihat `03-implementasi.md` §1).
1.3. Target platform: PC desktop, DirectX 12 / Shader Model 6.
Target resolusi maksimum: 3840×2160 (4K UHD).

## 2. Prinsip arsitektur rendering

2.1. Klien UE bersifat presentation-only. Klien tidak menentukan
kebenaran dunia; seluruh state dibaca dari snapshot server
otoritatif (10 Hz) dan diinterpolasi secara visual.
2.2. Derivasi visual bersifat deterministik dan identik antar-klien.
Rumus derivasi (mood grade, respons kokpit, noise, scatter) wajib
menghasilkan keluaran bit-identik dengan klien web untuk masukan
yang sama (diuji via uji banded — lihat §8).
2.3. Kualitas mengikuti kamera. Kamera jauh menerima anggaran murah;
kamera dekat (kokpit, hangar) menerima anggaran penuh. Penghapusan
LOD demi detail penuh di semua jarak dilarang.
2.4. Satu aset, banyak badan. Aset dibeli sekali dan digunakan ulang
antar-biome/planet melalui grade, tint, dan skala (lihat
`01-assets.md` §0.1). Pembelian varian memerlukan justifikasi tertulis.

## 3. Target platform dan tier performa

| Tier | Resolusi render | Upscaling | Lumen | Niagara | Target fps (p95, 10 dtk) |
|---|---|---|---|---|---|
| LOW | 1080p | Performance | Nonaktif | Hemat | ≥30 |
| MEDIUM | 1080p | Balanced | Aktif parsial | Standar | ≥45 |
| HIGH | 1440p | Balanced | Aktif | Penuh | ≥60 |
| ULTRA | 2160p | Quality | Aktif | Penuh | ≥60 |
| CINEMATIC | 2160p native | Quality | Aktif + HWRT* | Penuh +Dense | ≥60 (referensi) |

*HWRT = hardware ray tracing, hanya perangkat yang mendukung.
3.1. Penurunan fps di bawah target pada adegan sepi (orbit)
diklasifikasikan sebagai cacat (bug), bukan sebagai beban wajar.
3.2. Perangkat keras referensi wajib dicantumkan pada setiap laporan
pengujian (contoh: GPU diskret tahun 2021 atau lebih baru untuk HIGH).

## 4. Subsistem rendering

### 4.1. Dunia dan planet

4.1.1. Streaming dunia menggunakan World Partition (sisi klien
semata). Otoritas region tetap pada server; World Partition tidak
boleh menentukan kepemilikan atau keberadaan entity.
4.1.2. Geometri berperforma tinggi menggunakan Nanite (kapal,
struktur, batuan). Vegetasi menggunakan instanced mesh ber-LOD
dengan ketentuan jarak pada `01-assets.md`.
4.1.3. Material planet mengikuti resep anti-plastik 10.V §9:
albedo tidak pernah flat (noise ±8% + panel/garis + edge wear),
roughness bervariasi 0,35–0,75, normal mikro dari noise, emissive
hanya sebagai aksen.
4.1.4. Satu planet memuat minimum tiga biome (gurun, gunung, hutan,
laut, atau bulan — lihat `01-assets.md` §1). Biome dipilih dari
seed secara deterministik.

### 4.2. Langit dan atmosfer

4.2.1. Langit menggunakan Sky Atmosphere + HDRI 360° per mood
(cerah, senja, badai, malam). Satu HDRI dapat dipakai di beberapa
planet dengan rotasi, tint, dan lapisan awan yang berbeda.
4.2.2. HDRI berfungsi ganda: kubah langit terlihat dan sumber
pencahayaan berbasis gambar (image-based lighting) untuk material
PBR.
4.2.3. Awan menggunakan sistem berlapis prosedural (fbm + drift +
penggelapan badai). Raymarch volumetrik penuh ditunda hingga
adanya anggaran yang disetujui (biaya).

### 4.3. Kapal (vessel)

4.3.1. Setiap kapal terdiri atas badan (aset, milik pemain/komunitas)
dan otak (sistem vessel ARCLUX: engine, reactor, navigation,
defense, weapons, crew). Badan tanpa otak tidak memperoleh perilaku;
otak tanpa badan tidak memiliki representasi.
4.3.2. Efek visual ditempelkan OTOMATIS dari state (state-driven,
bukan model-driven): glow engine, shield, asap/api kerusakan,
bekas luka, dan muzzle — berlaku untuk kapal buatan pemain mana
pun tanpa kerja tambahan dari pembuat kapal.
4.3.3. Batas: satu kapal aktif per pemain (pergantian bebas); dua
kapal induk per komunitas. Penegakan di sisi server.

### 4.4. Cuaca dan efek visual (VFX)

4.4.1. Seluruh VFX cuaca diimplementasikan dalam Niagara dan dibaca
dari EnvironmentalContext yang sama dengan klien web: hujan/streak,
splash, spray, whitecap, petir, daun/debris, dan asap.
4.4.2. Momen "masuk sel badai" merupakan beat sinematik gabungan
(awan menggelap, hujan, angin, ombak, spray, flash, guncangan
kokpit, audio thunder berbasis jarak), dipicu oleh transisi state,
bukan oleh pemicu manual.
4.4.3. Pool partikel dibatasi per jenis (tracer ≤64, beam ≤8,
missile ≤12, impact ≤200 pada tier HIGH) dengan daur-ulang otomatis.

### 4.5. Kokpit dan kamera

4.5.1. Mode kamera (berurutan, tombol V): ORBIT (bawaan) → COCKPIT →
TACTICAL → CINEMATIC → FREE. Spesifikasi perilaku pada 10.V §18.
4.5.2. Efek kokpit (droplet, flash, heat vignette, dimming, shake,
exposure) aktif HANYA pada mode COCKPIT (nol biaya di luarnya).
Flash dan grade dihitung pada ruang HDR linear sebelum tone-mapping
agar diperlakukan sebagai cahaya (bloom + filmic rolloff).
4.5.3. Shake HUD berupa transformasi DOM/UMG (±3px, compositor-only)
dan tidak melawan kamera sinematik.

### 4.6. Antarmuka pengguna (UI)

4.6.1. Seluruh UI diimplementasikan dalam UMG dengan DataTable token
(warna, tipografi, glow) sebagai satu-satunya sumber kebenaran
visual. Tata letak (kiri TAC, kanan VESSEL, bawah slot) tidak boleh
dipindahkan.
4.6.2. Panel menggunakan material berlapis (kaca gelap transparan,
gradien, edge highlight, noise mikro, emissive lembut, animasi
scan). Kartu (card) gaya web dilarang pada seluruh UI.
4.6.3. Transisi 120–300 ms (token motion), suara UI (blip/scan/alarm
lembut), dan HUD kontekstual (cruise ramping, combat penuh, dock
minimal). UI diperbarui hanya saat state berubah.
4.6.4. UI tajam pada 4K dalam semua tier (DPI-aware, font SDF).
Ketajaman UI tidak dikorbankan untuk performa adegan 3D.
4.6.5. Tutorial pemain baru (5 langkah, centang otomatis dari state)
wajib diselesaikan pemain baru dalam 5 menit hingga hangar.

### 4.7. Audio

4.7.1. Audio disintesis via MetaSounds (parameter: frekuensi, durasi,
gain) mengikuti desain `audio.ts` yang ada. Berkas musik eksternal
tidak digunakan untuk SFX/UI (ukuran + lisensi).
4.7.2. Musik kustom pemain (lokal, format umum) didukung pada tingkat
klien. Thunder delay = jarak/343 (fisika, bukan konstanta).

### 4.8. Pasca-proses (urutan final, tidak boleh dibolak-balik)

```
Render → Bloom → Grade (mood) → CockpitGrade → FinalTouch → Output
```

4.8.1. Grade pada ruang HDR linear (warm senja, storm, night +
moon). Touch terdiri atas vignette, grain hash-based (jam tick,
bukan jam dinding), dan chromatic aberration tepi (<1,5px @1080p,
zona tengah steril untuk keterbacaan teks taktis).
4.8.2. Anggaran: ±0,4 ms per pass @1080p, mengikuti resolutionScale.
LOW menonaktifkan seluruh pass kecuali Render→Output (dengan
fallback kilat DOM + kokpit kering sebagai degradasi yang sah).

## 5. Aliran aset (gatekeeper, bukan impor langsung)

5.1. Format masukan pipeline: glTF 2.0 / GLB (scene, data biner, dan
tekstur dalam satu berkas). Format ini didukung UE dan klien web
sehingga satu pembelian berlaku untuk dua klien.
5.2. Berkas pengguna TIDAK PERNAH langsung menjadi `.uasset` pada
klien. Aliran wajib:

```
BERKAS PENGGUNA → VALIDATOR ARCLUX → REGISTRY ASET
→ CRAFTING/DEPLOYMENT → IMPOR UE (.uasset) → PRESENTASI
```

5.3. Validator memeriksa: skema, anggaran poly/VRAM, kelas,
kecocokan biome, whitelist infrastruktur, dan moderasi (lihat
`02-asset-pipeline.md` §1, §5). Kegagalan disertai alasan tertulis.
5.4. Hasil deploy merupakan snapshot beku: perubahan/penghapusan repo
setelah deploy tidak memengaruhi versi terdeploy (anti-bait-and-
switch). Pembaruan memerlukan submission + crafting ulang.
5.5. Siklus hidup: klaim dunia otomatis pada hari ke-30 stabil
(monumen + plakat, kebal tahap RUSAK namun berlumut sebagai fitur),
peluruhan menjadi reruntuhan pada usia 1–2 tahun (tetap POI,
pola wreckage 04). Sistem usang 4 tahap (bersih/berdebu/berkarat/
rusak) menumpang pada sistem damage, material, dan repair yang
sudah ada.
5.6. Gotong-royong: aset milik sendiri dapat ditempatkan pada radius
proyek komunitas (maksimum 5 per site orang; kepemilikan tidak
berpindah; dapat dicabut kapan saja).

## 6. Anggaran performa (ukur, bukan klaim)

6.1. Draw calls per adegan: ≤150 (LOW) / ≤250 (MEDIUM) / ≤400 (HIGH).
6.2. VRAM tekstur: ≤768 MB (LOW) / ≤1,5 GB (MEDIUM) / ≤3 GB (HIGH).
Pool tekstur master 4K dengan streaming.
6.3. Lampu: interior ≤6 point (HIGH) / ≤2 (LOW). Setiap point light
menambah biaya seluruh shader (forward renderer) sehingga jumlahnya
dibatasi keras.
6.4. VFX: batas pool §4.4.3 + pembaruan pool ≤0,8 ms/frame (HIGH,
adegan duel).
6.5. Setiap PR grafis mencantumkan: tangkapan layar + angka fps
(p95) + `stat unit`/`stat rhi`. Tanpa ketiganya = belum selesai.

## 7. Risiko dan mitigasi

| Risiko | Mitigasi |
|---|---|
| Shader/device fragmentation PC | Tier + scalability otomatis; LOW dijamin jalan |
| HOARDING aset (ribuan file) | Ledger per file; tanpa baris ledger = tidak ada di universe |
| Gaya visual tabrakan antar-pack | Kurasi per pack; grade + token menyatukan |
| Cheat visual klien | Ekonomi dan state tetap server; klien hanya render |
| Scope creep grafis | Baris ⬜ 10.V dilarang di-port; gate slice mengikat |

## 8. Kriteria penerimaan (DONE = semua lulus)

8.1. Sembilan komposisi (6 dunia + fleet battle + interior hidup +
hangar hero) lulus pada tiap tier beserta tangkapan layar banded
(browser vs UE, adegan sama — dua klien wajib tampak sekeluarga).
8.2. Tabel fps 27 angka (9 komposisi × 3 tier) memenuhi §3.
8.3. NOL `Date.now` pada kode visual baru; NOL material full-custom
di luar pass yang ditetapkan; NOL file sprawl (satu wire per layer).
8.4. Regression lock: perilaku lama (sway, wetness, animasi NPV,
mount, discovery) tetap lolos uji perilaku.

## 9. Referensi dokumen

`00-migrasi.md` (strategi) · `01-assets.md` (pengerahan) ·
`02-asset-pipeline.md` (konten pengguna) · `03-implementasi.md`
(peta file) · `10-visual-fidelity.md` (arah seni) · Blueprint
01–10 (desain permainan).
