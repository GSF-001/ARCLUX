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
- F9. Chunk server vs chunk client tidak nyambung: Blueprint 10 §5
  nyuruh chunk di-tick + persist via `claimRegion`
  (`world.ts` + `relay/registry.ts`); realitanya chunking yang jalan
  adalah streaming visual client + persist `Vec3`, sementara
  `claimRegion` yang hidup adalah vessel-handoff (barang beda).
  Pilih satu, jujur: (a) bangun chunk-tick server beneran
  (`planetId:chunkX:chunkZ` aktif hanya bila ada pemain/fasilitas,
  state di `persistence.ts`), atau (b) revisi blueprint: nyatakan
  chunking = client-side streaming + persist koordinat. Jangan
  klaim (a) sambil menjalankan (b).

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

## 4. Fase eksekusi (satu fase = satu PR + ceklist, wired, verified)

Aturan main: tiap fase di bawah ini dikerjain sampai centang SEMUA
kotaknya baru PR. Klaim tanpa centang = belum DONE. File mapping
eksplisit pola Blueprint 10 §14. Dilarang: rewrite arsitektur,
ShaderMaterial full-custom, file sprawl (satu wire per layer).

### F0 Correctness (tutup gap kejujuran dulu)

Scope: F1–F9 §1 + backlog verifikasi §7.
File: `vesselState.ts`, `simulation.ts`, `index.ts` (hook),
`environment.ts` (F6/F7), `ocean.ts`+`wireX/G` (F8),
keputusan F9 (code atau revisi blueprint).

- [ ] F1: `landingOutcome()` dipanggil saat settle + log `crash_impact`
- [ ] F2: jarak petir dari posisi strike beneran, bukan 2800
- [ ] F3: tag `ADRIFT` kapal orang lain di daftar kontak
- [ ] F4: massa+radius per planet dari environs (`g` bervariasi)
- [ ] F6: waktu lokal longitude + interpolasi batas chunk
- [ ] F7: overlay anomali->cuaca + `chunkKey` di payload anomali
- [ ] F8: amplitudo mesh ikut state + trigger STORM per chunk vessel
- [ ] F9: putuskan chunk-server vs revisi blueprint, eksekusi
- [ ] F5: SEMUA backlog §7 berubah jadi verified (cek per file)
- [ ] Verify: `tsc 0` + build + smoke tiap item di atas

### A1 Vegetation (pembunuh kartun #1)

Scope: §2.2. File: `vegetation.ts` (+ `wireX` bila perlu),
tidak sentuh kontrak.

- [ ] Pinus cross-plane + rumput instanced blade
- [ ] Kanopi icosahedron + noise (prioritas udara, bukan batang)
- [ ] Bark/leaf canvas texture (pola `makeCloudTexture`)
- [ ] Rumput -> material kena cahaya (bunuh Basic flat)
- [ ] Sway phased + wetness tetap jalan (regresi dilarang)
- [ ] Verify: screenshot forest flight before/after + draw call
      dihitung + fps guard

### A2 Terrain + rock (§2.1 + §2.3)

Scope: material + strata + scatter. File: `terrain.ts`
(+ resolver/fungsi baru seperlunya, arsitektur tetap).

- [ ] Tekstur prosedural per-biome (albedo/normal/roughness)
- [ ] Strata tebing berdasar slope/altitude
- [ ] Scatter kerikil/boulder instanced + cull existing
- [ ] Wet/snow response numpang state yang sudah ada
- [ ] Verify: screenshot ridge + cliff dekat/jauh + fps guard

### A3 Water + shore + dust (§2.4 + §2.5 + sebagian §2.8)

Scope: air hidup + pantai gradasi + debu 4 fase ber-badan.
File: `ocean.ts`, `oceanSystem.ts`, `coastal.ts`,
`emergencyLanding.ts` (dust), `rain.ts` (streak/splash).

- [ ] Foam texture + fresnel (`onBeforeCompile`, BUKAN ShaderMaterial)
- [ ] Shoreline `WET SAND -> FOAM -> SHALLOW -> OPEN` tanpa seam
- [ ] Amplitudo mesh ikut state badai + whitecap ∝ wind (F8)
- [ ] Debu 4 fase per permukaan (desert/forest/wet/snow)
- [ ] Rain streaks + splash + ripple puddle/ocean
- [ ] Verify: screenshot low-pass ombak + ocean storm + GIF dust
      + fps guard

### A4 Sky + night + grade (§2.6 + §2.7 + §2.11 + §2.12)

Scope: langit + bulan + post murah. File: `atmosphere.ts`,
`sun.ts`, `fog.ts`, `lightning.ts` (flash consumer), composer.

- [ ] Awan fbm (ganti generator blob) + edge-lit + storm darkening
- [ ] Sunset ramp 3-stop + horizon haze + limb orbit
- [ ] Moonlight directional biru + disk + moon glint di air
- [ ] Flash petir menerangi terrain/ocean/facility + thunder delay
- [ ] Vignette + night grade (TAA/SSAO/DOF DITOLAK di fase ini)
- [ ] Verify: 6 komposisi §5 lulus screenshot + fps guard

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

## 7. Gap implementasi sisi session 1 (fakta + backlog verifikasi)

Aturan bagian ini: hanya yang terverifikasi ditulis sebagai fakta;
sisanya ditulis sebagai backlog cek (F5), BUKAN vonis. Tujuannya
satu: tidak ada klaim DONE yang berdiri di atas file yang belum
dibaca ulang.

### 7.1 Fakta terverifikasi

- G1. Tick C6-C10 di-merge dengan `cinematic: null,
  turbulence: null` (terbaca di `index.ts` saat itu) — response
  jalan tanpa input core. SUDAH DIPERBAIKI: dilipat ke `wireC`,
  sekarang disuapi konteks + turbulensi hidup. File resolver
  session 1 tidak diubah.
- G2. Commit berlabel "full enrich"/"super detail" berisi helper
  kecil (terverifikasi: diff 128 baris). Pelajaran proses, bukan
  tuduhan: label PR wajib sebanding isi diff. Aturan §4 berlaku
  untuk semua pihak.
- G3. Centang [x] checklist blueprint (§13/§17) dibuat di atas
  item yang belum diverifikasi baris-per-baris. Backlog §7.2
  adalah cara melunasinya.

### 7.2 Backlog verifikasi F5 (per file — centang = dibaca + dites)

Riwayat tiap file: versi proto TERBUKTI punya cacat X, versi baru
MENGKLAIM Y. Sampai dibaca ulang, status = UNVERIFIED.

Substrate (klaim: rewrite AAA):

- [ ] `planetary/terrain.ts` — klaim FBM+erosi+LOD; cek: deterministik
      per-koordinat? seam antar-chunk? LOD beneran streaming?
- [ ] `planetary/ocean.ts` — klaim 4 Gerstner; cek: Gerstner beneran
      (displace XZ) atau sinus-Z? foam hidup? preservasi base?
- [ ] `planetary/atmosphere.ts` — klaim scattering; cek: scattering
      fisik atau gradien + konstanta? `depthWrite:false` utuh?
- [ ] `planetary/chunks.ts` (+ server) — klaim LOD + hybrid mesh;
      cek: bug jarak indeks-vs-pos? planetId hardcode? frustum cull?
- [ ] `planetary/surface.ts` — klaim Kepler + GateLink; cek: Kepler
      beneran atau sudut linear? threshold magic terdokumentasi?
- [ ] `planetary/facilities.ts` — klaim 10 geometri distinct; cek:
      masih ada fallback kotak? aturan empty-land dobel otoritas?
- [ ] `planetary/geography.ts` — cek: import server-ke-client masih
      ada? marker LOD/cull?
- [ ] `planetary/night.ts` — cek: draw-call per facility? traverse
      per-tick?

Gaps G1-G4 (klaim: state machine + zona + river + continuity):

- [ ] `planetary/environmentalEvent.ts` — fase `landing`/`post`
      tercapai? `startedAt` reset? mist tidak nol-mati?
- [ ] `planetary/coastal.ts` — bug arah (windSpeed sebagai sudut)?
      drift unbounded? baca `EnvironmentalContext` sekarang?
- [ ] `planetary/hydrological.ts` — quad hanyut selamanya?
      recycle? `river->ocean` beneran ketemu?
- [ ] `planetary/atmosphericContinuity.ts` — konflik tulis fog
      dengan sun/fog resolver? `dt` dipakai?

Sinematik C6-C10 (klaim: 5 resolver + wire):

- [ ] `EnvironmentalAudioResolver.ts` — sync wind/rain/thunder,
      delay thunder = jarak/343?
- [ ] `CockpitResponseResolver.ts` — presentation-only murni?
- [ ] `ImpactPresentation.ts` — rantai impact->wreck utuh?
      transient vs persistent dipisah?
- [ ] `FacilityDiscovery.ts` — `AtmosphericReveal.ts` (blueprint
      C.9 minta) ada atau tidak?
- [ ] `CinematicBudget.ts` — hysteresis? kompatibel qualityBudget?
- [ ] `wireG.ts` — tick signature konsisten? tidak tulis authority?

Cara verifikasi tiap kotak: baca file + `tsc` + smoke perilaku
(pola smoke yang sudah ada) + tulis HASILnya di PR. Kotak centang
tanpa ketiga itu = belum centang.

## 8. UI Visual Fidelity (audit + blueprint)

Hasil audit read-only seluruh UI existing (`hud.ts`, `menu.ts`,
`landing.ts`, `tokens.ts`, overlay character/stadium/bazaar,
`CockpitResponseResolver.ts`, `index.html`). Tidak ada file diubah
saat audit.

### 8.1 Yang sudah bagus — JANGAN disentuh strukturnya

- `tokens.ts`: satu sumber warna/tipografi/glow + konverter
  CSS↔THREE. Fondasi identitas, hanya boleh DITAMBAH (§8.3 U1).
- Grammar layout HUD: kiri TAC, kanan VESSEL, bawah slot, atas
  region. Pindah satu panel saja = merusak identitas.
- Disiplin XSS (`textContent`, hash-guard update 10Hz).
- Konsep landing CCTV + live stats + persist settings menu.

### 8.2 Gap terverifikasi (8 temuan)

- V1. Pengecatan flat: palet punya depth, eksekusi flat (bar/slot/
  stat fill polos, glow single-layer).
- V2. Compositing liar: blur backdrop 2/3/6/12px tanpa skala,
  panel numpuk di atas bloom tanpa isolasi (risiko washout).
- V3. Landing langgar token: hardcode `#eaf0ff` + font stack +
  `@import` Google Fonts yang DIBLOKIR CSP (`default-src 'self'`)
  -> font landing fallback diam-diam.
- V4. Overlay kasta dua: character/stadium/bazaar = kotak tengah
  generik, tanpa corner bracket taktis ala HUD.
- V5. Animasi generik: semua `0.15s ease` + `translateY(-2px)`;
  tidak ada motion token.
- V6. KABEL MATI KOKPIT (kritis): `CockpitResponseResolver`
  menghitung droplet/flash/vignette/shake -> hasilnya DIBUANG
  (`applyCockpitToOverlay` nulis objek tak terbaca, tidak ada
  overlay yang render). Efek hujan/flash/heat di kaca = TIDAK
  TERLIHAT hari ini. Plus `Date.now` di dalamnya.
- V7. Time-bomb perf: `backdrop-filter: blur()` fullscreen di atas
  canvas WebGL (landing + 3 overlay + menu).
- V8. HUD target pulse + scanline pakai `Date.now` inline (kosmetik,
  tapi tidak deterministik).

### 8.3 Fase eksekusi (satu fase = satu PR + ceklist)

- [ ] **U1 Token** (`ui/tokens.ts` SAJA): tambah `motion`
      (durasi/easing), glow berlapis, skala z-index, skala blur.
      Verify: grep nol nilai motion/glow/z di luar token.
- [ ] **U2 HUD** (`hud.ts`): glow lapis, bar gradien, corner
      bracket, ganti `Date.now` pulse -> jam tick. Layout JANGAN
      pindah. Verify: screenshot HUD + fps guard.
- [ ] **U3 Overlay kit** (`menu.ts`): satu builder panel (corner +
      header + footer) untuk character/stadium/bazaar. Isi form
      tetap. Verify: screenshot 3 overlay + `tsc 0`.
- [ ] **U4 Cockpit presentation — High-Fidelity Cockpit Presentation**
      (technology selected per effect after rendering-path audit;
      BUKAN "canvas 2D untuk semua"). Status tiap klaim ditandai:
      `[FACT]` terverifikasi di code, `[DESIGN]` keputusan desain,
      `[TARGET]` budget yang wajib diukur.
      - [FACT] Rantai composer aktual: RenderPass -> UnrealBloomPass
        -> OutputPass (`scene3d/post.ts`, `three/addons`, tanpa dep
        baru, CSP-aman). Overlay DOM duduk DI ATAS canvas dan tidak
        pernah kena bloom/tone-mapping.
      - [FACT] `updateCamera` menulis ulang position+lookAt tiap frame
        di semua mode (`scene3d/camera.ts`) — offset kamera hanya aman
        dipasang SESUDAH update (pola `wireC` sekarang).
      - [FACT] Lima output kokpit mati hari ini: droplet, flash,
        vignette, `hudShake`, `exposureOffset` dihitung
        `CockpitResponseResolver` tapi tidak dibaca siapa-siapa.
      - [FACT] Akumulasi `toneMappingExposure` (baca-tambah,
        upstream-reset tiap frame) sudah berjalan (`wireX` set base,
        `wireC` tambah offset).
      - [DESIGN] Satu `CockpitGradePass` (ShaderPass, antara Bloom
        dan Output): uniform flash + heat + dim. Flash di ruang
        linear HDR -> filmic rolloff + bloom = terbaca cahaya;
        versi DOM = putih flat. Alasan per efek: flash/heat/dim
        BUTUH shader (alasan di atas); droplet = canvas 2D overlay
        di bawah HUD (stamp per-partikel murah 0.5x; refraksi
        transmission = overkill, deferred); hudShake = DOM
        transform root HUD (gratis, tidak berantem kamera);
        exposure = lipat ke akumulasi existing; vessel motion =
        milik 10C, jangan dobel.
      - [DESIGN] Compositing akhir: Scene -> Bloom -> CockpitGrade
        -> Output -> canvas -> droplet-canvas -> HUD.
        `wireC` = satu-satunya sumber update uniform (sudah pegang
        konteks + turbulensi hidup). Hapus helper mati
        `applyCockpitToOverlay`; bunuh `Date.now` di resolver
        (pola `timeSec` seperti flight resolver).
      - [DESIGN] File: BARU `cockpitGradePass.ts` + `cockpitOverlay.ts`
        (canvas droplet, lifecycle create/tick/dispose aman);
        numpang `post.ts` (sisip pass) + `bootstrap.ts` (+1 field
        ctx) + `wireC.ts` (umpan uniform) + `hud.ts` (expose root)
        + `quality.ts` (gating). Otoritas nol (semua baca state ada).
      - [DESIGN] Gating tidak boleh langgar kontrak sinematik di LOW:
        pass mati + fallback DOM flash + kokpit kering = degradasi
        yang SAH (kontrak: panduan RENDER, bukan efek wajib).
        MEDIUM: pass nyala, droplet 0.5x. HIGH+: full.
      - [TARGET] +1 fullscreen pass ~0.5ms @1080p ikut
        resolutionScale; droplet update hanya saat basah (>0.02).
        Angka ini TARGET ukur, BUKAN fakta — verifikasi di
        hardware/profile yang ditentukan + fps guard per tier.
      - [ ] Verify: smoke assert uniform ter-update + canvas ada
        piksel non-transparan + urutan pass
        `[render, bloom, cockpit, output]` + screenshot
        storm/flash/heat + fps guard.
- [ ] **U5 Landing fix** (`landing.ts`): buang `@import`, self-host
      font (kontrak token), token-ify hardcode. Verify: nol error
      CSP di console + screenshot.
- [ ] **U6 Motion** (semua file UI): transisi ad-hoc -> 
      `tokens.motion`. Verify: grep nol `0.15s ease` sisa.
- [ ] **Budget global**: blur hanya panel <50% layar; animasi
      transform/opacity only; DOM tetap 10Hz hash-guard.
      Verify: tidak ada frame drop vs baseline di skenario sama.

---

# ADENDUM MMORPG-GRADE (docs-only, belum implementasi)

> Status bagian §9–§17: **SPEC, bukan klaim.** Acuan kualitas: EVE
> Online — stylish tactical neon, bukan arcade. Tiap kotak di bawah
> WAJIB mencantumkan: file exact, fungsi, pola, budget ms, fallback
> tier LOW, dan cara verifikasi. Aturan besi: **no screenshot =
> tidak jadi.** Bagian U4 (§8.3) SUDAH final — di sini hanya
> direferensi, tidak diubah. Aturan §4 tetap berlaku: satu fase =
> satu PR + semua kotak centang + `tsc 0` + build + smoke.

## 9. Sistem tekstur & material (A) — bunuh plastik

Fakta hari ini: `vessels.ts` pakai flat color + metalness/roughness
tunggal per part (`hullMat`, `hullHighMat`, `engineMetalMat`,
`accentMat`, `canopy` Physical); `stations.ts` 2 warna flat +
1 beacon; `interior.ts` reuse material Fase 3. Hasilnya "plastik":
pantulan seragam di seluruh permukaan, tidak ada panel yang matte
dan panel yang aus. Resep EVE: metal MATTE + roughness bervariasi
+ emissive tipis sebagai aksen, BUKAN chrome mengkilat semua.

Anti-plastik recipe (berlaku untuk semua item di §9):

1. Albedo tidak pernah flat: noise ±8% + panel lines + edge wear.
2. Roughness SELALU bervariasi 0.35–0.75 antar panel (satu angka
   untuk seluruh hull = plastik, dilarang).
3. Normal micro dari noise (bukan geometri) — murah, bunuh
   "permukaan licin sempurna".
4. Emissive hanya aksen (strip/lampu/jendela), tidak pernah
   menerangi seluruh badan.

### Fase M1 — Material kit + re-material (satu PR)

- [x] **M1.1 Texture kit prosedural** — BARU
      `apps/game/src/renderer/scene3d/materials.ts`: fungsi
      `makeHullAlbedo(base, seed)`, `makeRoughnessMap(seed, lo, hi)`,
      `makeNormalMapFromNoise(seed)`, `makePanelLines(w, h, seed)`.
      Pola: canvas 2D seperti `makeCloudTexture`/`makeGlowTexture`
      yang sudah ada di `bootstrap.ts`. RNG pakai `scene3d/rng.ts`
      yang sudah ada (seeded) — JANGAN `Math.random` (tekstur harus
      stabil antar load). Budget: one-time ~50–200ms saat load di
      HIGH (boleh di splash/loading, BUKAN di frame gameplay);
      0ms/frame. Fallback LOW: kit tetap ada tapi resolusi turun
      (lihat M1.5). Verify: screenshot 4 tile tekstur + catat waktu
      generate (console.time) + `tsc 0`.
- [x] **M1.2 Vessel re-material** — sentuh
      `apps/game/src/renderer/scene3d/vessels.ts` SAJA (fungsi build
      yang sudah ada, baris ~36–140): `hullMat`/`hullHighMat` dapat
      albedo+roughnessMap M1.1 (roughness 0.45–0.7 bervariasi per
      part), `engineMetalMat` roughness 0.35 + normal micro,
      `accentMat` tetap emissive tapi intensity turun ke 0.8–1.0
      (sekarang "menyala" — neon taktis itu tipis, bukan lampu
      sorot), `canopy` Physical roughness 0.08 -> 0.15 + clearcoat
      tetap (kaca kokpit butuh cacat dikit biar bukan cermin).
      Pola: material dibuat SEKALI saat build, disimpan di
      `group.userData.mats` (jangan bikin material per frame —
      itu leak). Budget: 0ms/frame tambahan (tekstur di-upload
      sekali). Fallback LOW: roughnessMap/normal dimatikan,
      albedo 128px, sisanya flat + vertex color. Verify: screenshot
      hangar close-up before/after + `renderer.info.memory.textures`
      + fps guard adegan hangar (§17).
- [x] **M1.3 Station re-material** — sentuh
      `apps/game/src/renderer/scene3d/stations.ts` (fungsi
      `buildStation`): hub dapat panel-lines albedo + roughness
      0.5–0.7, ring dapat stripe emissive tipis (numpang warna
      `colors.stationRing`), beacon dipertahankan. Pola sama seperti
      M1.2 (material sekali saat build). Budget: 0ms/frame.
      Fallback LOW: flat seperti sekarang (itu SUDAH tampilan LOW).
      Verify: screenshot station orbit before/after + fps guard.
- [x] **M1.4 Interior kit** — sentuh
      `apps/game/src/renderer/interior.ts`: lantai roughness TINGGI
      (0.8, anti-lantai-kaca-kantor), dinding panel albedo M1.1,
      amber strip + window warm existing DIPERTAHANKAN intensitasnya
      (itu identitas, bukan plastik). Pola: 3 material shared untuk
      seluruh interior (jangan per-room material baru — draw call +
      VRAM jebol). Budget: 0ms/frame. Fallback LOW: 1 material
      dinding + 1 lantai. Verify: screenshot corridor/plaza
      before/after + hitung material count via
      `renderer.info.memory` + fps guard interior (§17).
- [x] **M1.5 VRAM guard + tier gating** — sentuh
      `apps/game/src/renderer/scene3d/quality.ts` (+ field di
      `settings.ts` bila perlu, tidak bikin settings baru):
      resolusi tekstur 512 HIGH / 256 MEDIUM / 128 LOW; LOW boleh
      mematikan normal map total. Anggaran VRAM TEKSTUR (di luar
      framebuffer): HIGH ≤48MB, MEDIUM ≤24MB, LOW ≤8MB. Cara hitung:
      512² RGBA = 1MB, jadi HIGH ≈ 30–40 tile max. Verify: catat
      `renderer.info.memory.textures` + estimasi MB di PR + fps
      guard 3 tier adegan hangar.
- [ ] **M1.6 Recipe check** — tiap PR material wajib lolos 4 aturan
      anti-plastik di atas (reviewer centang manual). Verify:
      screenshot macro 1 panel hull: terlihat noise + panel line,
      tidak licin sempurna.

## 10. Weapon VFX (B) — ganti ledakan generik

Fakta hari ini: `scene3d/explosions.ts` = SATU ledakan generik untuk
semua sebab mati (5 burst sprite orange 0.8s + shield flash putih
0.2s + 30 sparks garis 0.3s + 12 debris kotak 2s). Blueprint 01 §10
menuntut 5 archetype visual (Projectile/Beam/Missile/Drone/Area
Effect) + taxonomy impact (shield flash, sparks, electrical, smoke,
subsystem shutdown, directional impact, debris, controlled
explosion). Satu ledakan untuk semua senjata = arcade, bukan EVE.

Bahasa visual per senjata (final, jangan diutak-atik tiap PR):

| Archetype | Tracer/proyektil | Muzzle | Impact khas |
|---|---|---|---|
| Projectile | garis-garis ramping cyan/amber per faksi, panjang ∝ kecepatan | flash 60ms + puff kecil | sparks kuning + puff |
| Beam | quad kontinu + bloom spike + shimmer panas | glow charge 200ms SEBELUM tembak (telegraph) | titik panas putih + smoke tipis |
| Missile | badan kecil + engine glow + trail asap spiral tipis | asap tebal 300ms | ledakan area kecil + debris |
| Drone | kecil + blink navigasi (numpang pola nav-blink) | — (launch tube puff) | sparks kecil |
| Area | ring shockwave mengembang + flash | charge glow | flash + debris + smoke |

### Fase W1 — Weapon kit (satu PR, `explosions.ts` dipecah, bukan dihapus)

- [ ] **W1.1 Weapon kit** — BARU
      `apps/game/src/renderer/scene3d/weapons.ts`: fungsi
      `spawnProjectileTracer(ctx, from, to, tint)`,
      `spawnBeam(ctx, from, to, width, heat)`,
      `spawnMissile(ctx, from, dir, tint)` (trail asap spiral),
      `spawnMuzzle(ctx, hardpointPos, kind)`,
      `spawnImpact(ctx, pos, kind, surface)` dengan
      `kind = shield|sparks|electrical|smoke|directional`,
      `spawnShockwave(ctx, pos, radius)`. Pola: OBJECT POOL per jenis
      (pre-alloc, reuse — pola sama seperti rain streak pool di
      `rain.ts`; dilarang `new Geometry` per tembakan di frame
      panas). Jitter visual boleh non-deterministik (itu presentasi,
      bukan authority — hasil damage tetap milik sim). Budget:
      update pool ≤0.8ms/frame HIGH di adegan duel; pool cap:
      tracer ≤64, beam ≤8, missile ≤12, partikel impact ≤200.
      Fallback LOW: tracer + flash saja (no smoke, no debris, no
      shockwave). Verify: GIF tiap archetype 3 detik + hitung draw
      call duel + fps guard adegan perang (§17).
- [ ] **W1.2 Muzzle per hardpoint** — sentuh
      `apps/game/src/renderer/scene3d/vessels.ts` (mountL/R baris
      ~139+): tiap mount dapat socket posisi (disimpan di
      `userData.mounts`), `weapons.spawnMuzzle` dipanggil di socket
      itu. Beam: charge-glow 200ms dulu (telegraph — pemain lihat
      "mau ditembak", itu EVE). Budget: muzzle ≤0.1ms (sprite 1–2).
      Fallback LOW: flash sprite saja. Verify: screenshot freeze
      frame muzzle + beam charge + fps guard.
- [ ] **W1.3 Impact taxonomy** — sentuh `weapons.ts` (BARU, W1.1) +
      baca state shield dari sim (read-only): shield = flash biru +
      sprite heksagonal-ish (canvas, bukan geometri baru); sparks =
      garis kuning (reuse pola sparks existing); electrical = garis
      zigzag ungu 150ms; smoke = sprite abu ikut `WindState`
      (numpang pola spray advect); directional = cone searah datang.
      Budget: impact ≤0.3ms (pool, auto-recycle ≤1s). Fallback LOW:
      flash saja. Verify: screenshot tiap jenis impact + fps guard.
- [ ] **W1.4 Ledakan besar + wreck hook** — pecah
      `apps/game/src/renderer/scene3d/explosions.ts`:
      `spawnExplosion` existing jadi `spawnExplosionLarge` ( dipakai
      missile + kill), tambah `spawnControlledExplosion` (kecil,
      untuk subsystem — dipakai §11), dan hook persistent wreck
      (carcass diserahkan ke §16 R1.2 — transient vs persistent
      DIPISAH, pola `ImpactPresentation.ts`: transient = partikel
      yang hilang, persistent = mesh yang tinggal). Otoritas nol
      (semua baca event mati yang sudah ada). Budget: large ≤0.5ms
      sesaat, debris existing 2s dipertahankan. Fallback LOW: burst
      2 sprite + flash (itu tampilan LOW yang sah). Verify: video
      kill full 2s + screenshot carcass sisa + fps guard.

## 11. Damage → visual mapping (C) — luka terbaca di mata

Blueprint 01 §11: subsystem damage (ENGINE/NAVIGATION/WEAPONS/
DEFENSE/REACTOR) memengaruhi world-state DAN representasi visual
(rantai `DEFENSE 48% -> shield instability -> visual flicker`).
Fakta hari ini: rantai itu PUTUS di visual — `vessels.ts` NOL
damage visual, HUD kanan VESSEL cuma bar. Kapal 10% dan 100% terlihat
SAMA. Itu tidak MMORPG-grade.

Level final (berlaku untuk semua subsystem): `OK (>0.6)` /
`DAMAGED (0.25–0.6)` / `DISABLED (<0.25)` / `DEPLETED (=0, khusus
REACTOR/ammo)`. Tiga level terakhir WAJIB beda di mata TANPA baca
angka HUD.

### Fase D1 — Damage kit (satu PR)

- [ ] **D1.1 Damage resolver** — BARU
      `apps/game/src/renderer/scene3d/damage.ts`: tipe
      `DamageVisualState { engine, nav, weapons, defense, reactor }`
      (0..1, read-only dari sim) + `resolveDamageVisuals(health)`
      -> level per subsystem. Murni fungsi (testable tanpa THREE).
      Verify: unit/smoke assert tiap batas level + `tsc 0`.
- [ ] **D1.2 Apply ke vessel** — sentuh
      `apps/game/src/renderer/scene3d/vessels.ts` + BARU `damage.ts`
      (D1.1): `applyDamageVisuals(group, state)` dengan material refs
      di-cache di `userData.mats` SEKALI saat build (numpang M1.2).
      DILARANG traverse per frame (pelajaran `night.ts`, backlog
      §7.2). Tabel visual per subsystem:
      ENGINE -> engine glow flicker + smoke knalpot + trail
      putus-putus; WEAPONS -> mount hangus (tint gelap) + muzzle
      redup; DEFENSE -> shield flicker instability + retak emissive;
      REACTOR -> dim global lampu kapal + heat glow; NAV ->
      nav-blink mati + label TAC kuning. Budget: apply hanya saat
      level BERUBAH (event, bukan per frame) + flicker ≤0.2ms.
      Fallback LOW: tint + HUD saja (no smoke/api). Verify:
      screenshot 5 subsystem × 3 level (15 shot, boleh kolase) +
      fps guard.
- [ ] **D1.3 Asap + api** — sentuh `damage.ts` (D1.1) + numpang pool
      `weapons.ts` (W1.1): smoke = sprite abu pool ≤24, advect ikut
      `WindState` di atmosfer (pola spray); api = 2–3 sprite additive
      flicker 8–12Hz pakai JAM TICK (`timeSec`, pola flight resolver
      — BUKAN `Date.now`, pelajaran V8). Budget: ≤0.5ms HIGH.
      Fallback LOW: mati total (tint D1.2 sudah cukup). Verify: GIF
      kapal DAMAGED 5 detik + fps guard.
- [ ] **D1.4 Deformasi murah + bekas luka** — sentuh `vessels.ts`:
      DISABLED = skew/scale nacelle 3–5° + 1 panel disembunyikan
      (hide mesh spesifik — murah, permanen sampai repair);
      scar = dark patch decal (plane + MultiplyBlending, 1–3 per
      kapal). DILARANG vertex surgery per frame (cost + risiko).
      Budget: 0ms/frame (one-time saat level berubah). Fallback LOW:
      scar saja. Verify: screenshot DISABLED vs OK + fps guard
      (harus NOL delta).
- [ ] **D1.5 HUD subsystem** — sentuh
      `apps/game/src/renderer/hud.ts`: bar gradien + ikon status per
      subsystem (OK/DAMAGED/DISABLED/DEPLETED), flicker CSS saat
      DAMAGED + blink merah saat DISABLED (motion numpang token U6,
      DOM 10Hz hash-guard tetap). Layout JANGAN pindah (§8.1).
      Verify: screenshot HUD tiap level + grep NOL `Date.now` baru.

## 12. Post chain penuh (D) — grade + touch, U4 direferensi

Fakta hari ini (`post.ts`): `RenderPass -> UnrealBloomPass
(1.15/0.45/0.65) -> OutputPass`. U4 (§8.3, FINAL) menyisipkan SATU
`CockpitGradePass` (ShaderPass: flash + heat + dim) ANTARA Bloom dan
Output, plus droplet-canvas + hudShake DOM. Bagian ini MENAMBAH 2
pass di sekitarnya — spec U4 tidak ditulis ulang di sini.

Urutan composer FINAL (jangan dibolak-balik — alasannya teknis):

```
Render -> Bloom -> Grade (§12) -> CockpitGrade (U4)
  -> FinalTouch (§12) -> Output
```

Kenapa: grade di ruang linear HDR SEBELUM Output (tone-map butuh
gambar yang sudah di-mood); kokpit DI ATAS grade (kaca kokpit
mewarnai dunia yang sudah jadi, bukan sebaliknya); touch
(vignette/grain/CA) PALING AKHIR sebelum encode (itu cacat lensa +
film, bukan cahaya dunia).

### Fase P1 — Grade + touch (satu PR, U4 disentuh HANYA di wiring urutan)

- [ ] **P1.1 Grade pass** — BARU
      `apps/game/src/renderer/scene3d/gradePass.ts`: SATU ShaderPass
      uniform `mood (clear|dusk|storm|night) + weatherMix` dibaca
      dari `EnvironmentalContext` via `wireX`/`wireC` (pola U4:
      `wireC` satu-satunya sumber update). Numpang akumulasi
      exposure existing (jangan bikin exposure kedua). Budget:
      ~0.4ms @1080p ikut resolutionScale. Fallback LOW: pass mati,
      mood diabaikan (tampilan LOW yang sah). Verify: screenshot 6
      komposisi §5 grade on/off + fps delta per pass.
- [ ] **P1.2 Final touch pass** — BARU
      `apps/game/src/renderer/scene3d/finalTouchPass.ts`: vignette +
      grain halus (hash-based, uniform `timeSec` — BUKAN `Date.now`)
      + chromatic aberration radial tipis (tepi saja, <1.5px @1080p,
      zona tengah STERIL — teks TAC tidak boleh beleber). SATU pass
      gabungan biar hemat (3 pass terpisah = boros bandwidth).
      Budget: ~0.4ms @1080p. Fallback LOW: mati total. Verify:
      screenshot crop tepi 200% (CA terlihat tapi tipis) + grain
      tidak merusak teks + fps guard.
- [ ] **P1.3 Wiring urutan + gating** — sentuh
      `apps/game/src/renderer/scene3d/post.ts` (rakit urutan final +
      expose `setGradeEnabled`/`setTouchEnabled`) +
      `apps/game/src/renderer/scene3d/quality.ts` (gating: LOW =
      Render->Output saja + fallback DOM flash U4; MEDIUM = +Bloom
      low + Grade; HIGH+ = full). Budget total post: LOW ~0ms,
      MEDIUM ~1ms, HIGH ~1.5ms @1080p. Verify: assert urutan pass
      `[render, bloom, grade, cockpit, touch, output]` di smoke +
      screenshot per tier + fps guard 3 tier.
- [ ] **P1.4 Night grade** — numpang `gradePass.ts` (P1.1), BUKAN pass
      baru: exposure turun + blue lift saat malam (baca `moonState`/
      sun elevation yang sudah ada, pola §2.11). Verify: screenshot
      night facility grade on/off.

## 13. Cahaya & bayangan (E) — bunuh cahaya datar

Fakta hari ini: `suns.ts` = 1 DirectionalLight (2.2×massRatio) + 1
AmbientLight (0.5) — itu definisi "datar": tidak ada arah, tidak ada
pantul, tidak ada titik gelap. Shadowmap beneran TIDAK ADA (yang ada
cuma `shadowPlane` fake di `atmosphericContinuity.ts` + blob circle
di `facilities.ts`). Interior hangar cuma 1 PointLight. Langkah EVE:
sedikit lampu TAPI berarah + kontras, bukan banyak lampu.

Keputusan eksplisit: SHADOW MAP beneran DITOLAK untuk fase ini
KECUALI 1 spotlight 512px di hangar interior (alasan: cost +
acne di skala game-unit + LOD §0 butir 5). Bayangan = blob/AO
murah di mana-mana, shadowmap = 1 titik pamer saja.

### Fase L1 — Lighting rig (satu PR)

- [ ] **L1.1 Key/fill/rim** — sentuh
      `apps/game/src/renderer/scene3d/suns.ts` (+ `bootstrap.ts`
      untuk field ctx): key = directional existing (warm, ikut sun
      elevation); fill = HemisphereLight (sky/ground — INI yang
      bikin rumput §2.2 + hull merespons langit, bukan cuma
      matahari); rim = directional biru redup 0.3 dari belakang
      (siluet kapal pecah dari background gelap — trik EVE paling
      murah). 3 lampu statis, 0ms tambahan yang berarti. Fallback
      LOW: key + ambient saja (seperti sekarang). Verify: screenshot
      vessel against-dark before/after + fps guard (harus ~NOL delta).
- [ ] **L1.2 Contact shadow + AO murah** — sentuh `vessels.ts` +
      `planetary/facilities.ts`: blob disc radial-gradient (canvas,
      pola `makeGlowTexture`) di bawah vessel/facility, opacity ∝
      altitude (lepas landas = bayangan memudar — storytelling
      gratis); interior: AO strip = dark gradient plane di sudut
      koridor/plaza (numpang `interior.ts`). Budget: 1 draw call per
      blob, ~0ms. Fallback LOW: blob saja, AO mati. Verify:
      screenshot landing + hangar before/after.
- [ ] **L1.3 Fasilitas kaya** — sentuh
      `apps/game/src/renderer/scene3d/planetary/night.ts` (numpang
      yang sudah ada: 96 windows + PointLight runway): runway edge
      lights instanced (1 draw call), window intensity noise +
      10% jendela mati acak seeded (dihuni, bukan pola), beacon pulse
      pakai `timeSec`. Traverse di-cache SEKALI (pelajaran §7.2 —
      jangan traverse per tick). Budget: ≤0.2ms. Fallback LOW:
      emissive statis seperti sekarang. Verify: screenshot night
      facility before/after + light count `renderer.info` + fps guard.
- [ ] **L1.4 Interior kaya** — sentuh
      `apps/game/src/renderer/interior.ts`: corridor strip existing
      + plaza downlights + hangar 3-point (`hangarLight` existing +
      2 fill redup) + 1–2 lampu RUSAK flicker (storytelling, bukan
      bug — didokumentasikan di code comment); bazaar stall glow
      warna-warni redup (numpang H1.1 §14). Cap lampu: interior ≤6
      point total di HIGH (forward renderer: tiap point nambah cost
      SEMUA shader). Fallback LOW: 2 point saja. Verify: screenshot
      corridor/plaza/hangar/bazaar + light count + fps guard.
- [ ] **L1.5 Flash consumer** — sentuh `planetary/lightning.ts`
      (PointLight `FLASH_RANGE` yang SUDAH ADA dipakai beneran) +
      `suns.ts`: `flashLevel` -> boost directional sesaat + trigger
      point (§2.9 F2 dibayar di sini). Verify: frame flash gunung
      ke-reveal (kriteria §2.9) + fps guard.

## 14. Dunia hidup (F) — interior bernyawa, Ark tetap, planet final

Doktrin §3: DITOLAK NPC/fauna dan kota prosedural. "Hidup" di sini
= lampu + crowd SIMPLE + mesin bergerak + traffic cahaya. Bukan
simulasi orang. Kamera tidak pernah ngobrol — tapi ruangan yang
lampunya mati total dan koridor yang sepi = mati.

### Fase H1 — Dunia hidup (satu PR, `ark.ts` hanya re-material)

- [ ] **H1.1 Lampu animasi interior** — sentuh `interior.ts`: advert
      board scan (emissive offset jalan pakai `timeSec`), koridor
      strip pulse halus 0.5Hz, bazaar stall glow gantian (cap: update
      emissiveIntensity ≤8 material/frame — murah, bukan per-lampu
      traverse). Budget: ≤0.1ms. Fallback LOW: statis. Verify: GIF
      5 detik plaza + fps guard.
- [ ] **H1.2 Crowd simple** — BARU
      `apps/game/src/renderer/scene3d/crowd.ts`: agen = capsule
      low-poly 2–3 warna (crew/merchant/guard) + waypoint loop di
      promenade/plaza (12–24 agen HIGH, 6 MEDIUM, 0 LOW dengan
      fallback billboard jauh). BUKAN AI: posisi = fungsi
      `timeSec` (deterministik, 0 state, 0 authority). Pola:
      InstancedMesh per warna (3 draw call total). Budget: ≤0.5ms.
      Fallback LOW: NOL agen (ruangan "sepi jam malam" = sah).
      Verify: GIF interior 10 detik + fps guard + screenshot jauh
      (billboard terbaca sebagai orang).
- [ ] **H1.3 Mesin bergerak** — sentuh `interior.ts`: hangar door
      cycle (`hangarDoors` existing DIDIPAKAI akhirnya — open/close
      8 detik loop saat docking mode), kipas ventilasi putar,
      crane hangar geser 2m loop, conveyor bazaar texture-offset
      jalan. Semua fungsi `timeSec`, semua 0 authority. Budget:
      ≤0.1ms (transform doang). Fallback LOW: pintu saja. Verify:
      GIF hangar door cycle + fps guard.
- [ ] **H1.4 Ark dipertahankan + glow hidup** — sentuh
      `apps/game/src/renderer/scene3d/ark.ts` MINIMAL: animasi NPV
      yang ada JANGAN DIUBAH (regresi dilarang — tulis test/smoke
      yang mengunci perilaku existing sebelum PR ini); yang boleh
      ditambah: engine glow pulse + nav-blink + re-material M1.3.
      Verify: smoke perilaku NPV lama lolos + screenshot Ark
      before/after (harus "sama tapi lebih kaya", bukan beda kapal).
- [ ] **H1.5 City lights final** — sentuh `planetary/night.ts`:
      kriteria FINAL = per-window intensity noise + 10% mati (L1.3)
      + runway amber + orbit readability (dari orbit malam: facility
      = cluster cahaya hangat di atas terrain gelap, BUKAN titik
      putih tunggal). Verify: screenshot orbit night + descend
      sequence 3 frame (orbit -> approach -> runway).
- [ ] **H1.6 Traffic malam** — BARU (numpang `night.ts`): moving
      light dots di runway/facility road = InstancedMesh kecil loop
      bolak-balik (fungsi `timeSec`, 1 draw call, ≤16 dots). Ini
      "kendaraan" tanpa model kendaraan — dari kokpit malam yang
      terlihat cuma lampunya (doktrin §0 butir 1). Budget: ~0ms.
      Fallback LOW: mati. Verify: GIF 5 detik + fps guard.
- [ ] **H1.7 Vegetasi/ocean final pass** — definisi FINAL (numpang
      A1/A3/A4, bukan kerjaan baru): vegetasi = kanopi + sway +
      wetness + hemisphere response (ceklist A1 SEMUA centang);
      ocean = foam texture + fresnel + whitecap ∝ wind + moon glint
      (ceklist A3 + P1.4 centang). H1.7 = audit silang, bukan code:
      buka tiap kotak A1/A3/A4, buktikan di screenshot. Verify:
      kolase forest-flight + ocean-storm + night-ocean.

## 15. UI bar MMORPG (G) — acuan EVE, lampaui

EVE bukan "panel cantik" — EVE = tiap panel punya DEPTH (lapis),
MOTION (karakter), dan SUARA (klik/scan berdenging). Ditambah NPE
(new-player experience): pemain baru 5 menit pertama harus bisa
terbang-tembak-dock TANPA baca wiki. Dan zero-placeholder rule:
yang belum ada datanya DISEMBUNYIKAN dengan empty-state taktis,
bukan "coming soon".

Suara: synth WebAudio kecil di file existing (bukan mp3 — CSP
`default-src 'self'` + size, pelajaran V3). Default ON volume 0.15,
ada toggle di settings.

### Fase U7–U12 (boleh 2 PR: U7–U9 satu, U10–U12 satu)

- [ ] **U7 Tactical windows kit** — sentuh
      `apps/game/src/renderer/menu.ts` (builder panel U3 DIPAKAI,
      bukan builder baru): jendela target-info, fleet, directory/
      scan, combat-log. Tiap jendela = corner bracket + header +
      scan-in animation (opacity + slide 120ms, token U6) + suara
      scan (U9). Isi baca state existing (read-only). Verify:
      screenshot 4 jendela + rekaman open/scan + `tsc 0`.
- [ ] **U8 Transisi global** — sentuh semua file UI (numpang token
      motion U6): open/close/scan/pindah-mode (landing->cockpit =
      boot sequence 600ms: fade + scanline + blip). DILARANG animasi
      layout (width/height/top — itu jank; transform/opacity only,
      budget §8.3). Verify: rekaman 3 transisi + fps guard (NOL
      frame drop vs baseline).
- [ ] **U9 Suara UI** — sentuh
      `apps/game/src/renderer/audio.ts` (existing, tambah fungsi
      synth `uiBlip/scanConfirm/alarmSoft`, WebAudio osc 30–80ms,
      TANPA file baru) + toggle di settings. UX: klik = blip,
      lock = confirm, damage = alarmSoft (JANGAN alarm keras tiap
      hit — itu bikin mute permanen). Verify: test manual 3 suara
      + toggle off = sunyi total + `tsc 0`.
- [ ] **U10 Tutorial/NPE** — BARU overlay di `menu.ts` (atau file
      baru `apps/game/src/renderer/npe.ts` bila `menu.ts` >500
      baris — cegah file sprawl §4): 5 langkah (move -> lock ->
      fire -> dock -> hangar), step dibaca dari state game beneran
      (langkah centang OTOMATIS saat pemain melakukannya, bukan
      tombol "next"), skippable, flag `npeDone` persist. Veteran
      tidak pernah diganggu (flag cek SEKALI saat boot). Verify:
      test fresh-profile 5 menit sampai hangar + screenshot tiap
      step.
- [ ] **U11 Landing page redesign** — sentuh
      `apps/game/src/renderer/landing.ts`: hero = CCTV live existing
      + stats live + 2 CTA (Terbang / Lanjut) + strip 3 kartu fitur
      (data live semua); numpang U5 (buang `@import`, token-ify).
      Zero-placeholder: slot tanpa data DISEMBUNYIKAN, bukan
      "coming soon". Verify: screenshot + NOL error CSP + test 3
      resolusi (1080p/768p/360p).
- [ ] **U12 Zero-placeholder rule global** — semua file
      `apps/game/src`: `grep -rin "lorem\|coming soon\|placeholder\|todo("`
      = NOL hasil; tiap daftar kosong = empty-state taktis
      ("NO CONTACTS — widen scan", "NO WRECKS in range") bukan
      kotak kosong. Verify: output grep ditempel di PR.

## 16. Planetary visual gaps 10 + 01 (H) — sistem jalan, presentasi mati

Cross-check `docs/blueprint/10-planetary-runtime.md` +
`docs/blueprint/01-spatial-ux.md`: yang di bawah ini SISTEMNYA
sudah centang [x] tapi MATANYA belum ada. Tiap item =
presentasi-only, otoritas tidak berubah.

- [ ] **R1.1 Discovery reveal** — sentuh
      `apps/game/src/renderer/scene3d/cinematic/FacilityDiscovery.ts`
      (+ `AtmosphericReveal.ts` BILA backlog §7.2 membuktikan dia
      tidak ada — cek dulu, jangan bikin dobel) + `hud.ts`: saat
      facility pertama ter-radar (Radar `entitiesWithin 50000`
      existing): ping ring mengembang + label fade-in + suara scan
      (U9). Blueprint 10 §11 "descend -> runway -> hangar feels
      inhabited" butuh momen "ketemu" — ini momennya. Verify:
      video discover 5 detik + fps guard.
- [ ] **R1.2 Wreckage visual** — sentuh `vessels.ts` (varian carcass:
      gelap + panel hilang + tilt, reuse D1.4) + `damage.ts` (smoke
      tipis persistent) + `hud.ts` (plaque arsip: nama, battle,
      recovered — data dari `04-wreckage-history.md`, read-only):
      wreck = carcass + smoke tipis + beacon SOS blink + plaque
      saat dekat. Blueprint 01 §18 "tetap dapat ditemukan fisik".
      Verify: screenshot wreck dekat/jauh + plaque + fps guard.
- [ ] **R1.3 Cosmic event visual** — sentuh
      `apps/game/src/renderer/scene3d/cosmic.ts` +
      `scene3d/nebula.ts` + `gradePass.ts` (P1.1): solar wind =
      sky tint aurora-ish + radio crackle (audio existing);
      anomaly gravity = particle drift + HUD warning + grade shift
      (LENS DITOLAK — cost; drift + grade sudah "terasa" tanpa
      postur mahal). Numpang overlay F7 (§6): cuaca yang ke-flip
      storm OLEH anomali dapat tint ungu-hijau tipis (satu dunia,
      §0 butir 3). Verify: screenshot anomali vs normal + fps guard.
- [ ] **R1.4 Geography readability** — sentuh
      `planetary/geography.ts` (6 niches existing) + `hud.ts` (TAC):
      tiap niche = tint terrain beda + ikon TAC + label saat
      di-scan ("chokepoint", "bay", "ridge"...). Blueprint 10 §10
      "terrain creates opportunity" — opportunity yang tidak
      TERLIHAT = tidak ada. Verify: screenshot TAC overlay 6 niche.
- [ ] **R1.5 Bahasa transisi orbit↔surface** — sentuh `camera.ts` +
      grade + audio: SATU bahasa untuk 3 transisi: GateLink jump =
      flash + streak; entry atmosfer = heat glow (numpang Heat
      resolver C-session-1) + shake; docking hangar = iris wipe
      (fade lingkaran, DOM 300ms, murah). Pemain harus TAHU dia
      pindah lapisan TANPA baca teks. Verify: GIF 3 transisi + fps
      guard.
- [ ] **R1.6 Coastal/hydro final visual** — sentuh `coastal.ts` +
      `hydrological.ts` + `atmosphericContinuity.ts` (numpang A3):
      foam line + river glint (sun glint path existing) + mist
      post-storm tidak nol-mati (bug G-§7.2 bila terbukti).
      Verify: screenshot shoreline + river + post-storm mist.

## 17. Definition of Done MMORPG-grade (I) — kapan boleh klaim DONE

Sembilan komposisi (6 lama §5 + 3 baru). SEMUA lulus baru DONE.
Tiap komposisi = SATU dunia bereaksi (aturan §5), bukan efek
sendiri-sendiri.

Komposisi baru:

7. `fleet battle` — 3+ vessel + beam + tracer + impact + 1 kill
   (large explosion + carcass) + damage smoke di penyintas.
8. `living interior` — plaza: crowd + stall glow + advert scan +
   hangar door open + 1 lampu rusak flicker.
9. `hangar hero` — vessel textured close-up + contact shadow + rim
   light + engineer crowd 2 agen + grade on.

### Guard angka (ukur, bukan klaim)

- [ ] **I.1 FPS guard per tier per adegan** — 9 komposisi × 3 tier.
      Target @1080p hardware referensi (tulis spek di PR, contoh:
      discrete 2021+ / integrated dilarang jadi patokan HIGH):
      LOW ≥30, MEDIUM ≥45, HIGH ≥60 (p95 selama 10 detik, overlay
      `?profile` atau `stats` existing). Adegan sepi (orbit) HARUS
      ≥60 di semua tier — kalau orbit saja drop, itu bug, bukan
      "berat". Verify: tabel 27 angka di PR.
- [ ] **I.2 VRAM + draw call guard** — `renderer.info.memory`
      (geometries/textures) per adegan: textures ≤8MB LOW / ≤24MB
      MEDIUM / ≤48MB HIGH (aturan M1.5); draw calls ≤150 LOW /
      ≤250 MEDIUM / ≤400 HIGH; lights: interior ≤6 point HIGH / ≤2
      LOW (aturan L1.4). Verify: tabel di PR + screenshot `?profile`.
- [ ] **I.3 Aturan screenshot** — tiap kotak Verify di §9–§16 =
      minimal 1 screenshot/GIF + 1 angka fps, tersimpan
      `docs/shots/<fase>-<adegan>-<tier>.png` (GIF `.gif`), nama
      ditempel di PR. **No screenshot = tidak jadi** (kotak dianggap
      belum centang walau code-nya merge). Reviewer menolak PR tanpa
      shots. Kolase before/after untuk semua item "re-material /
      re-light" (M1.2–M1.4, L1.1–L1.4, P1.1).
- [ ] **I.4 Regression lock** — PR §9–§16 wajib: `tsc 0` + build +
      smoke + sway/wetness/NP V-animasi lama tetap jalan (kunci §7
      G1 + §14 H1.4) + NOL `Date.now` visual baru (pelajaran V8) +
      NOL ShaderMaterial full-custom baru (aturan §4) + NOL file
      sprawl (satu wire per layer).

## 18. Mode kamera (EVE-style — kokpit SATU view, bukan penjara)

Koreksi doktrin: kamera UTAMA = luar (orbit), bukan kokpit. Kokpit =
satu view yang bisa di-switch. Urutan cycle tombol V (EVE-style):

1. `ORBIT` (DEFAULT) — kamera luar: kapal sendiri + semua objek
   sekitar. Ini rumah pemain.
2. `COCKPIT` — first-person instrumen. U4 (droplet/flash/vignette/
   shake) HANYA nyala di sini. Di luar kokpit U4 mati total (0 cost).
3. `TACTICAL` — top-down + overlay TAC (numpang U7).
4. `CINEMATIC` — direktor C-session-1 ambil alih (offset aditif
   berbatas, pola wireC existing).
5. `FREE` — kamera bebas debug/jelajah.

### Fase K1 — Mode kamera + V-cycle (satu PR)

- [ ] **K1.1 Mode COCKPIT** — sentuh `scene3d/camera.ts`: kamera di
      posisi canopy + look ikut heading + FOV 70 (rasa kecepatan).
      U4 membaca mode ini (overlay + pass enabled hanya saat COCKPIT).
      Verify: screenshot kokpit vs orbit (satu adegan, dua rasa).
- [ ] **K1.2 V-cycle** — sentuh `renderer/input.ts`: KeyV = next mode
      (mayat #9: key direncanain, handler GAK ADA — hidupin beneran,
      bukan stub). HUD tampilkan nama mode 1.5 detik (numpang U2).
      Konflik KeyF (nembak + interior) DIPERBAIKI di PR ini juga
      (satu tombol satu aksi — pisahkan: F = interior, J/klik = tembak).
      Verify: tekan V 5x = 5 mode berurutan + grep NOL dobel-listener.
- [ ] **K1.3 ORBIT default** — `camera.ts`: boot = ORBIT + jarak default
      baca ukuran kapal (jangan hardcode — kapal user beda-beda).
      Verify: fresh boot = kapal keliatan penuh + sekitarnya.
- [ ] **K1.4 Senjata per kamera** — ORBIT: W1/D1/P1 kerja penuh;
      COCKPIT: U4 + HUD; TACTICAL: U7 overlay + grade; CINEMATIC:
      director + touch; FREE: semua nyala (debug). Verify: matriks
      5 kamera × efek di PR (tabel, bukan klaim).
