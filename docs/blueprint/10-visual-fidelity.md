# Blueprint 10.V - Visual Fidelity Gap & Art Engineering

> Status: **SPEC - FINAL (pegangan implementasi).** Parent: Blueprint 10
> (Planetary Runtime) + Blueprint 10 Visual (art direction). Dokumen ini
> menjawab: setelah mesin Blueprint 10 selesai, apa yang KURANG supaya
> visualnya mencapai target — dan TEKNISNYA gimana cara nutupnya.
> Scope: `docs` + `apps/game` + `packages/gameserver` (tipis). Otoritas,
> physics, persistence tidak berubah.

## 0. Doktrin (tidak bisa ditawar)

1. **Fidelity ngikutin kamera.** Planet dilihat dari kokpit (terbang
   rendah/menengah) dan dari orbit. Yang tidak pernah terlihat kamera
   gameplay tidak dapat budget: tidak ada lumut yang diinjak, tidak ada
   batu yang dipanjat, tidak ada laut yang diselami.
2. **Empty by default tetap.** Hutan/laut natural, bangunan user di lahan
   kosong. Art tidak mengisi dunia dengan kota.
3. **Visual membaca state.** `EnvironmentalContext` -> resolver -> THREE.
   Tidak ada visual yang menulis authority (Blueprint 10 §10.X.2).
4. **Satu dunia.** Planetary bukan game baru: reuse Kepler, G/1/r²,
   tokens UI, snapshot/persistence yang sudah ada.
5. **LOD adalah arsitektur, bukan placeholder.** Jauh = murah (FAR),
   dekat = mahal (CINEMATIC). Menghapus LOD demi "detail penuh di semua
   jarak" dilarang — yang mati duluan fps-nya.

## 1. Status implementasi terverifikasi (fakta, bukan klaim)

Mesin (sistem + wiring + determinism) — terverifikasi via tsc + build +
smoke test:

- Kontrak `EnvironmentalContext` + `WindState` shared, deterministik
  (`planetSeed+tick+chunkKey`). Semua resolver membaca satu angin.
- Rantai cuaca `CLEAR->OVERCAST->RAIN->STORM` + hysteresis, genangan
  akumulasi + drain, vegetasi basah pulih.
- Petir deterministik (flash + bolt +thm level lingkungan).
- Kabut dari suhu/kelembaban/lembah/haze + umpan god-ray.
- Vegetasi sway per-stage + cull jarak + budget kualitas.
- Ocean frame (amplitudo/roughness/foam/refleksi) + wake/spray advect.
- Event kontinu G1 (clear->pre->storm->post->recovery), coastal zone,
  hydrological flow, atmospheric continuity.
- Emergency `ADRIFT->FALLING->CRASHED` authority (flag persist,
  validator tolak thrust, drift/fall/settle, HUD ENGINE 0%).
- Sinematik C1-C10 (director fresh per tick, flight full-graph,
  heat lifecycle, kamera aditif berbatas, audio/cockpit/impact/
  discovery/budget — response disuapi konteks hidup).

Kesenjangan (diakui eksplisit, bukan disembunyikan):

- F1. `landingOutcome()` yatim: vonis KE tertulis + ter-test tapi sim
  belum manggil saat settle. Efek: settle selalu "landed".
- F2. `distanceToLightning: 2800` hardcode di hook sinematik.
- F3. Tag `ADRIFT` untuk kapal ORANG LAIN di daftar kontak belum ada
  (HUD ENGINE baru untuk kapal sendiri).
- F4. Gravitasi pakai skala game-unit (hukum 1/r² + arah asli,
  besaran disesuaikan) dan massa default Bumi — `g` belum bervariasi
  per planet (Bumi 9.81 vs Mars 3.71, Blueprint 10 §4).
- F5. Belum verifikasi baris-per-baris: terrain/ocean/atmosphere
  pasca-rewrite, detail enrich G, 5 resolver C6-C10. Statusnya
  "klaim DONE", harus jadi "verified DONE".
- F6. Waktu lokal belum ikut longitude: `timeOfDay` global dari jam
  dunia, padahal Blueprint 10 §6 nuntut barat-siang-timur-malam di
  planet ribuan km. Lihat §6.
- F7. Cuaca ↔ anomali kosmik belum nyambung: dua sistem jalan
  sendiri-sendiri, padahal Blueprint 10 §14 nyuruh cuaca numpang di
  `cosmicEvent`. Lihat §6.
- F8. Tinggi gelombang di mesh + momen "masuk badai kayak film"
  belum dijahit jadi satu beat sinematik. Lihat §6.

## 2. Gap fidelity per layer (ini yang bikin "kentang")

### 2.1 Terrain — bentuk ada, permukaan mati

Ada: heightmap + vertex color + LOD/cull.
Kurang: NOL tekstur (albedo/normal/roughness), strata tebing,
micro-variasi, scatter kerikil.
Spec: tekstur prosedural per-biome via canvas (pola sama seperti
`makeCloudTexture` yang sudah ada) -> peta ke material Standard;
strata = pita warna + roughness berdasar slope/altitude;
kerikil = InstancedMesh + cull yang sudah ada.
Verify: screenshot ridge + tebing dekat, fps tidak turun.

### 2.2 Vegetation — siluet placeholder

Ada: 5 stage sway phased + wetness + cull + budget.
Kurang: geometri primitif (Plane/Sphere/Cylinder), material rumput
tanpa cahaya (`MeshBasicMaterial` = definisi "kartun" secara teknis),
tidak ada kanopi dari udara.
Spec: pinus cross-plane, rumput instanced blade, kanopi icosahedron +
noise, bark/leaf canvas texture, rumput -> Standard material +
hemisphere response. Prioritas KANopi (dilihat dari kokpit), bukan
batang (tidak ada yang jalan di hutan).
Verify: screenshot forest flight vs sekarang, draw call dihitung.

### 2.3 Rock/geology — gunung kentang raksasa

Ada: slope classifier + vertex color rock.
Kurang: silhouette batu, normal/roughness, moss/wet/snow response.
Spec: library prosedural (cliff/boulder/gravel/pebble) + scatter
slope-driven + material response numpang wetness/snow state yang
sudah ada.
Verify: screenshot cliff dekat + jauh (siluet pecah, bukan blob).

### 2.4 Water — permukaan plastik

Ada: OceanState + wake/spray + sun reflection scalar.
Kurang: NOL refleksi beneran, NOL fresnel, foam opacity polos,
shoreline gradasi lemah.
Spec (DETAIL — Blueprint 10 sudah menetapkan perilaku ini):
terbang rendah di atas air (`altitude < 150m`, `speed > 20`) WAJIB
memicu: spray intensity ∝ speed × waveAmplitude, ripple ring di
bawah vessel, foam streak di belakang (wake ribbon sudah ada,
tinggal tekstur foam), refleksi matahari pecah ∝ roughness
(sudah ada, tinggal visual), shoreline `WET SAND -> FOAM LINE ->
SHALLOW (gradasi dangkal) -> OPEN` tanpa seam.
Teknik: `onBeforeCompile` di atas MeshStandardMaterial (lampu/fog
tetap hidup — JANGAN ShaderMaterial full-custom yang membuang
integrasi three.js).
Verify: screenshot low-pass di atas ombak + komposisi ocean storm.

### 2.5 Landing dust — perilaku ada, badan kurang

Ada: 4 fase (`approach->hover->touchdown->settlement`) + advect angin.
Spec (DETAIL): approach = partikel kecil intake; hover = dust radial
+ grass flatten di bawah vessel; touchdown = burst -> cloud ->
settlement ikut `WindState.direction` (bukan arah random); permukaan
beda respons (desert tebal, forest daun, wet = cipratan lumpur,
snow = powder). Exhaust takeoff = kolom -> dispersi angin.
Verify: video/GIF 4 fase + settlement hanyut searah angin.

### 2.6 Clouds — blob, bukan volume

Ada: layer + drift + shadow + intersection + feed god-ray.
Kurang: tekstur blob, NOL edge-lit/self-shadow beneran.
Spec: tekstur fbm prosedural (ganti generator `makeCloudTexture`),
edge-lit via sun elevation, darkening saat storm (sudah ada
state-nya). Raymarch volumetrik DITOLAK untuk fase ini (cost).
Verify: screenshot sunrise/sunset cloud + storm darkening.

### 2.7 Atmosphere/sky — cangkang gradien

Ada: shell + haze + fog + limb glow sprite.
Kurang: scattering fisik (Rayleigh/Mie), sunset ramp, horizon haze
dari orbit.
Spec: gradient shell diperkaya (3-stop sunset), sun glow sprite
skala elevation, horizon haze ikut fog state. Transisi
SPACE->SURFACE kontinu tanpa switch (sudah arsitekturnya).
Verify: screenshot orbit limb + sunset mountain.

### 2.8 Weather VFX — hujan titik, bukan hujan

Ada: slant angin, puddle, wetness, runoff state.
Kurang: rain streaks (garis, bukan titik), splash, droplet, ripple.
Spec: streak via stretched sprite/line segments pool, splash ring
di permukaan, ripple di puddle + ocean (state intensity sudah ada).
Verify: screenshot storm + komposisi storm-night landing.

### 2.9 Lightning — garis, bukan event dunia

Ada: bolt + flash +thm level + threat decay.
Kurang: flash belum menerangi terrain/ocean/facility (level ada,
konsumen belum), NOL refleksi air, NOL respons kokpit terpusat.
Spec: `flashLevel` -> sununiform/intensitas sesaat terrain/ocean
material + facility emissive boost + cockpit flash (C7 sudah ada
slotnya) + thunder delay = distance/343.
(F2 di §1 adalah bagian dari ini.)
Verify: frame flash — gunung ke-reveal sesaat (Blueprint 10:
`DARK STORM -> FLASH -> MOUNTAIN REVEALED -> DARK`).

### 2.10 Wind — driver ada, visual per-asset kurang

Ada: WindState shared ke semua sistem.
Kurang: daun/debris/smoke visual terpisah belum ada (smoke hanya
milik emergency; daun tidak ada minib).
Spec: leaf/debris particle pool ikut wind + gust phase (pola sama
seperti spray), smoke settlement sudah ada.
Verify: gust terlihat kompak di daun + rumput + debu sekaligus.

### 2.11 Sun/night — siang oke, malam miskin

Ada: day cycle + warm dusk + ambient + fog color, night emissive
fasilitas + runway.
Kurang: NOL moonlight (malam = ambient redup doang), NOL disk bulan,
NOL moon specular di air.
Spec: moon directional biru redup (intensitas ikut `moonState`),
moon disc sprite, moon glint di ocean via reflection path yang
sudah ada. Night grade: exposure turun + blue lift.
Verify: screenshot night facility + ocean moonlight.

### 2.12 Post/grade — setengah ada

Ada: bloom + ACES + exposure dinamis.
Kurang: vignette, grain halus, night grade, color zones per cuaca.
Spec: pass murah di composer yang sudah ada; JANGAN TAA/SSAO/DOF
di fase ini (cost + risiko, deferred).
Verify: komposisi 6 target (§5) dinilai per screenshot.

## 3. Pembagian pemilik (final)

- DUNIA (kita): §2.1–§2.12. Langit, hujan, kabut, bulan, laut,
  pantai (dilihat, bukan diinjak).
- BANGUNAN (user, di repo mereka): desain hangar dkk. Kita sediakan
  KIT: empty-land rule + placement + health/damage hook + emissive
  malam. BUKAN hangar 1:1 yang bisa diinjak.
- UI (kita): HUD/menus pakai tokens. Fondasi + kokpit sudah ada.
- DITOLAK eksplisit: sea vessels (butuh walkable shore -> langgar
  karakter-terbatas), NPC/fauna, terrain deformation, kota
  prosedural, ekonomi full, microdetail tanah (lumut/ranting/
  kerikil — kamera tidak pernah ke sana).

## 4. Fase eksekusi (satu fase = satu PR, wired, verified)

- **F0 Correctness** — tutup F1–F8 §1. Kecil, dulu. Tanpa ini
  klaim DONE tidak jujur.
- **A1 Vegetation** (§2.2) — pembunuh kartun #1.
- **A2 Terrain+rock** (§2.1 + §2.3).
- **A3 Water+shore+dust** (§2.4 + §2.5 + sebagian §2.8).
- **A4 Sky+night+grade** (§2.6 + §2.7 + §2.11 + §2.12).
- Setiap fase: file mapping eksplisit (pola Blueprint 10 §14),
  verify = screenshot komposisi §5 + `tsc 0` + build + fps guard.
  Dilarang: rewrite arsitektur, ShaderMaterial full-custom,
  file sprawl (satu wire per layer).

## 5. Acceptance (6 komposisi — lulus semua baru DONE)

`mountain sunrise`, `forest flight`, `ocean storm`,
`desert landing`, `night facility`, `storm night landing`.
Tiap komposisi: seluruh sistem bereaksi sebagai SATU dunia
(hujan -> basah -> refleksi -> runoff -> sungai -> laut;
angin -> awan -> hujan -> pohon -> rumput -> debu).
Bukan 20 efek cantik yang berdiri sendiri.

## 6. Variasi spasial cuaca, waktu & laut badai (temuan lanjutan)

Satu planet ribuan kilometer TIDAK boleh satu cuaca, satu waktu.
Momen "masuk awan gelap kayak film — petir, angin, ombak — keluar
cerah" harus terjadi ALAMI dari sistem, bukan di-trigger manual.

### F6 — Waktu matahari lokal ikut longitude (Blueprint 10 §6)

Masalah: `timeOfDay` + elevasi matahari global dari jam dunia.
Di planet besar, barat siang sementara timur malam.
Spec: jam matahari lokal = `worldTime + offset(longitude)`.
Konvensi skala eksplisit: `METERS_PER_HOUR` (meter game per jam
matahari, 1 konstanta bernama, bukan magic number).
`deriveSunState` + `createEnvironmentalContext` terima opsional
`position` -> hitung waktu lokal; tanpa posisi = fallback global
(kompatibel mundur, tidak merusak pemanggil lama).
Otoritas tidak berubah (waktu tetap derivasi murni).
Verify: dua konteks tick sama, X beda jauh -> `timeOfDay` +
elevasi beda; batas siang/malam kontinu, tidak patah per chunk
(interpolasi antar chunk, bukan step).

### F7 — Anomali kosmik menggerakkan cuaca (Blueprint 10 §14)

Masalah: `cosmicEvent` (solarWind + anomaly gravity, sudah jalan
di sim per tick) dan cuaca (seed sendiri) tidak saling kenal.
Blueprint nyuruh cuaca numpang di anomali yang sama.
Spec: overlay murni `applyAnomalyToWeather(weather, anomaly)`:
anomali badai yang mencakup chunk mendorong `kind` ke storm
(`max` arah badai, tidak pernah melemahkan badai yang sudah ada);
payload anomali dapat `chunkKey`/posisi supaya cakupannya jelas.
Batas otoritas utuh: anomali = authority, cuaca visual = derivasi.
Verify: tick anomali -> chunk target flip ke storm deterministik,
selesai -> pulih; chunk lain tidak kena.

### F8 — Laut badai + beat sinematik "masuk badai"

Masalah: state ombak (`waveAmplitude` ikut angin) ada, tapi tinggi
gelombang di mesh + respons vessel belum dijahit jadi satu momen.
Spec:
- Mesh ocean: amplitudo vertex ikut `OceanFrameState.waveAmplitude`
  (kerjaan visual A3), whitecap coverage ∝ wind.
- Vessel masuk sel badai (kind cuaca di chunk vessel berubah
  clear->storm): Turbulence ACTIVE + spray + flash + cockpit shake
  + audio — SEMUA sistem itu sudah ke-wire; yang ditambah hanya
  deteksi transisi per chunk vessel -> trigger STORM director
  (pola sama seperti trigger emergency yang sudah ada).
- Keluar sel: recovery normal (wet tetap — numpang G2).
Verify: fly-through: cerah -> gelap -> flash+shake+spray ->
cerah; whitecap skala ikut angin; tidak ada pop.
