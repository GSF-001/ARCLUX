# 10 — CANGYUAN: The Shattered Throne (blueprint gameplay planet ke-3)

> **Status: SPEC-FINAL (docs-only). Belum ada satu baris kode.**
> Eksekusi = slice PR terpisah (Phase A–E di §11), dijalankan SETELAH sprint
> `08-server-hardening.md` §4 yang menahannya — bukan menggantikan.
> Sumber: dua draft user digabung jadi satu file ini (keputusan sesi 2026-10-09):
> (A) *Persistent Political Simulation* + (B) *Biao Ren — Escort & Imperial
> Conflict Expansion*. Draft asli TIDAK disimpan terpisah — duplikat dilarang.
>
> Induk silang: `06` (skill) · `05` (hukum/wanted — OTORITATIF soal hukum) ·
> `02`+`07` (klaim/koloni/world.json) · `09` (combat depth) ·
> `08` §4 (roadmap sprint) · `MMO-CONTRACT.md`.
>
> Referensi: **alife-sdk (MIT, TS)** — port pola + NOTICE, bukan dependency
> runtime (§13) · riset 3 repo UE (license NONE → ideas-only, `09` §9) ·
> inspirasi naratif *Blades of the Guardians* (tema, bukan asset/kode).
>
> **Prinsip satu kalimat:** 1 planet = 1 peradaban yang punya kepentingan,
> konflik, dan konsekuensi sendiri. Pemain mengubah sejarah — sejarah tidak
> berhenti berjalan saat pemain pergi.

---

## 0. Anti-duplikasi (baca ini sebelum nambah ide)

Otoritas topik sudah dimiliki file lain. File ini HANYA hal spesifik Cangyuan:

| Topik | Otoritatif di | Yang file ini TIDAK ulang |
|---|---|---|
| Hukum, wanted 0–5, bounty, prison, polisi, witness | `05-hukum-kota.md` | §9 cuma nambah VARIAN eksekusi publik kota Cangyuan di atas aturan `05` |
| Skill ship/FPS, hacking, OC economy, item drop | `06-gameplay-systems.md` | §8 cuma nyebut wuxia = konten payload Sprint 5 FPS skills |
| Klaim petak, crafting, lifecycle, claims→territori | `02-asset-pipeline.md` | §7 cuma nambah field `controllerFactionId` di sistem klaim yang ada |
| Studio/founder rule, world.json, multi-koloni | `07-studio.md` | §3 cuma contek pola world.json untuk planet ke-3 |
| Lock-on, projectile, AI tempur, damage pipeline | `09-combat-depth.md` | §7–§8 cuma KONSUMEN (pakai `intercept`, NpcBrain, FPS mode) |
| Roadmap sprint, gate, slicing PR | `08-server-hardening.md` | §11 cuma fase gameplay Cangyuan, bukan sprint pengganti |

Klaim BARU wajib bertanda sumber: *(baru, sesi 2026-10-09)*, *(doc B §x)*,
*(doc A §x)*, *(alife-sdk)*, *(reuse `05`)* — tanpa sumber = dihapus.

---

## 1. Visi

Cangyuan ("The Shattered Throne") adalah planet beradaban kekaisaran di
universe ARCLUX yang sama — dipenuhi konflik politik, peperangan antarfaksi,
dunia persilatan (jianghu), dan perjalanan berbahaya antarkota melintasi
wilayah yang dikuasai berbagai kekuatan.

Dua loop yang saling mengunci:

- **Loop makro (doc A):** politik, suksesi, perang, logistik yang
  disimulasikan sendiri oleh server — aktor NPC punya kepentingan,
  bereaksi, berubah, mati permanen.
- **Loop mikro (doc B):** Biao Ren (pengawal bayaran), kontrak, bounty,
  jianghu, reputasi — pemain mendapat pekerjaan DARI kondisi makro itu
  (jalur ditutup faksi perang = kontrak reroute; penguasa lemah = kontrak
  melindunginya muncul).

Identitas rasa: **wuxia brutal** — padang pasir frontier tanpa hukum,
alun-alun kota yang bisa menggantung orang, pendekar yang membunuh karena
kepentingan, bukan karena quest log. Pemain bukan pahlawan pusat: dunia
punya kepentingan sendiri.

Sifat konten: **emergen, bukan linear.** Tidak ada rantai misi berjenjang
yang ditulis tangan. Kontrak, perang, dan pemberontakan lahir dari state
dunia (siapa menguasai apa, siapa lagi bermusuhan, siapa yang diburu).

---

## 2. Kompatibilitas universe (aturan main tanpa tawar)

1. **Satu server, satu universe.** Tidak ada server/instance/route terpisah
   untuk Cangyuan — D-008 (server TS otoritatif penuh), D-009 (shard
   self-host). Semua mekanik Cangyuan = modul di server yang sama, dipanggil
   lewat intent pipeline seperti mekanik lain.
2. **Transport & identitas = sistem yang sama.** Pemain datang lewat
   `gate.ts` transit (handoff lintas region/komunitas), membawa kapal,
   perangkat, OC, dan identitas — tidak ada "karakter khusus planet".
3. **Asimetri teknologi tanpa imunitas hard-coded.** Senjata kapal dari
   Bumi/Mars menang di mobilitas & tembak jarak jauh, TAPI:
   - gerakan kapal dibatasi `safe-zone governance` yang sudah ada (field
     world.json, `07` §founder rules) — daerah kota Cangyuan = larangan
     tembak-berat via aturan data, bukan hardcoded;
   - orbit↔dunia lewat mode FPS (mode gate Sprint 2) — kapal turun =
     jadi ancaman mobilitas/tetesan, bukan god-mode;
   - **menguasai wilayah = hadir + logistik + hubungan politik**, bukan
     tembak dari orbit. Ini aturan main, bukan dinding ajaib.
4. **State penting persisten.** Politik, relasi faksi, kontrak, penguasaan
   wilayah, kematian NPC penting = durable store (pattern `packages/db`).
5. **Berfungsi saat pemain pergi.** Simulasi tetap jalan saat logout, pindah
   planet, atau offline — dengan biaya komputasi terkendali (§4.4, §7.5).
6. **Semua aksi lewat validator server.** Kontrak, reward, perubahan
   kepemilikan, eksekusi, perintah militer — divalidasi & di-log seperti
   intent lain (Sprint 2 authority).

---

## 3. Setting & region

Satu planet, banyak region (data world.json — pola `07`, bukan kode):

| Region | Fungsi gameplay | Nyambung ke |
|---|---|---|
| Ibu kota kekaisaran | Pusat politik + **alun-alun eksekusi publik** (§9), pasar, wali kota | §4, §9 |
| Wilayah bangsawan | Fortress + garnisun, pajak lokal, jalan ditutup-tutup | §4, §7 |
| Perkampungan perguruan | Sekte jianghu, guru/rekrut NPC, kontrak internal | §5, §10 |
| **Padang pasir frontier** | Outpost, jalur kafilah, bandit, tanpa hukum — brutal (§9 rimba) | §6, §7 |
| Kota pelabuhan/karavan | Titik awal kontrak Biao Ren, bea, gudang | §6 |
| Pass/benteng strategis | Objek perang, perebutan gerbang | §7 |
| Wilderness di luar kendali | Faksi liar, monster/ancaman, tanpa proteksi | §7 |

Catatan teknis: default SATU `WorldRegion` untuk Phase A (cukup untuk 1
kota + jalur). Split multi-region baru relevan kalau skala menuntut —
kandidatnya justru Sprint 4 federation (`08` §4), jangan dibuat di Phase A.

Biome padang pasir/kota/pegunungan = data `world.json` + ledger aset
`01-assets.md` §7 (mesh, vegetasi, arsitektur oriental = aset client,
bukan syarat server).

---

## 4. Politik makro (inti doc A — engine cerita)

### 4.1 Aktor & NPC penting

Aktor: kaisar & keluarga kerajaan, perdana menteri/istana, jenderal &
gubernur, rumah bangsawan, perguruan jianghu, perkumpulan pedagang,
jaringan kriminal. Tiap NPC penting membawa field:

`identitas · faksi · sifat (trait) · tujuan jangka pendek/panjang ·
relasi/loyalitas · memori ringkas (prioritas relevansi — E-5 style) ·
kekayaan/troops · pengaruh politik & kewenangan militer · lokasi/kondisi ·
rencana aktif`

**Tier NPC (menentukan kedalaman simulasi, doc A §6.1):**

- **Tier S (strategis)** — kaisar, perdana menteri, 2–3 jenderal, 3–4
  bangsawan utama, pemimpin 2–3 sekte besar. Simulasi penuh: utility AI,
  suksesi, memori. Jumlah dijaga kecil (≤ ~20).
- **Tier I (pengaruh)** — pejabat kota, panglima garnisun, tuan bandit.
  Aturan + sebagian utility. Ratusan.
- **Tier U (umum)** — pedagang, prajurit, pendekar. Aturan saja. Ribuan,
  boleh abstrak di tick jauh.

### 4.2 Keputusan NPC — utility AI deterministik, TANPA LLM

Skor utilitas = `f(sifat, ancaman, sumber daya, relasi, informasi yang
DIMILIKI, peluang berhasil)` → aksi dengan skor tertinggi lolos batas
siapa yang boleh melakukan (kewenangan).

**Model informasi (penting, anti-cheat naratif):** NPC hanya tahu apa yang
masuk lewat jalur informasi: laporan bawahan, scout, saksi mata, berita
kota. **Pembunuhan terpencil TIDAK otomatis diketahui** — deteksi memakai
pola witness yang sudah ada (`05`, radius ~50 m) + entity `report` untuk
kabar jarak jauh (disampaikan beberapa tick, bisa dicegat/dibungkam).
Konsisten dengan "informasi bisa menyesatkan" (doc B §5).

### 4.3 Perintah & otoritas — "berwenang" ≠ "berhasil"

Pemimpin mengeluarkan perintah: deploy pasukan, patroli, escort, transfer
dana, misi diplomatik. Bawahan mengevaluasi: **jalankan / tunda / tolak /
tafsir ulang** dari `otoritas × loyalitas × kemampuan × info × tujuan`.

Dua log event terpisah (pola authority injection Sprint 2, `08` §4):
`order_issued` (perintah keluar) vs `order_execution` (dilaksanakan,
ditunda, atau gagal). Kudeta lunak = tunda berulang sampai perintah mati.

### 4.4 Strategic tick — otak simulasi (gak mengganggu sim 10 Hz)

| Konstanta | Nilai awal | Sumber |
|---|---|---|
| `POLITICAL_TICK_MS` | 60_000 (1 tick politik / 1 menit real) | *(baru, sesi 2026-10-09)* |
| `BRAIN_BUDGET_PER_TICK` | 20 otak/TICK, round-robin antar sesi | pola alife-sdk `maxBrainUpdatesPerTick` |
| Cadence NPC dekat pemain | boleh ≤ 10 detik (prioritas di budget) | *(baru)* |
| RNG | seeded per-tick (determinisme E-5, `09`/Sprint 6) | reuse |

Jauh dari pemain → **representasi abstrak** (angka agregat: pasukan,
supply, mood wilayah), bukan per-individu — lihat §7.5. Semua keputusan
dihitung dari state yang di-log; seed sama → kronik identik.

Store target: **`packages/politics`** (pola store ke-5 — struktur sama
`economy`/`wanted`: schema + store CRUD + validator hook).

### 4.5 Kematian permanen & mesin suksesi

NPC penting **tidak respawn**. Vacansi → evaluasi kandidat:

`ahli waris sah · ambisi rival · kekuatan militer · legitimasi · aliansi ·
sumber daya → { damai · penunjukan · kompetisi · kudeta · militer ambil
alih · perang saudara · kekosongan sementara · fragmentasi faksi }`

Aturan keras:

- **Pembunuh TIDAK otomatis mewarisi** — klaim harus melalui mekanisme
  pengakuan (dukungan bangsawan/garnisun/agama-relevan, atau perang yang
  dimenangkan + ditahan).
- Kepemimpinan bermasalah → organisasi boleh **bubar / pecah / melemah**
  (bukan otomatis isi ulang kursi).
- Kematian memicu effect chain: loyalitas turun, proteksi kota turun,
  jalur aman berubah, kontrak baru muncul (§6), faksi bereaksi balas
  dendam (§5) — sampai konvergen.
- Tier U: penggantian hanya kalau ada kandidat/struktur yang masuk akal
  (doc B §6 — bukan mesin suksesi penuh untuk prajurit biasa).

Referensi port: alife-sdk (§13) untuk ritme budget & handoff offline.

---

## 5. Jianghu & faction entity (SATU sistem, dua konsumen)

### 5.1 Entity `Faction` (BARU — sumber: doc B §3 + doc A §4/§7)

```
Faction {
  id, name,
  kind: imperial | noble | martial | merchant | criminal | community | player_org,
  leaderNpcId | leaderPlayerId,
  members[],                 // npcId | playerId | orgRoleId
  treasuryId,                // link packages/economy — dana gabungan
  influence,                 // 0-100
  territoryIds[],            // link field klaim §7
  relations: { [factionId]: { base, goodwill } },  // dua-layer, lihat §5.2
  reputationPublik,          // 0-100, terlihat pemain
  state: active | crisis | dissolved
}
```

Fondasi: `communityId` yang **sudah ada** (types/wanted/governance/validator/
gate) di-upgrade jadi referensi ke entity ini — `kind: community` = entitas
lama tanpa migrasi paksa. Imperium, sekte, bandit = faction kind baru.

### 5.2 Relasi dua-layer (pola alife-sdk, MIT)

- `base` — konstanta per jenis faksi (imperium ↔ kriminal = dasar rendah),
  di-set di world.json, tidak berubah sendiri.
- `goodwill` — dinamis, **decay menuju 0 tiap politik tick**, clamp
  `[-100, +100]`, aksi (bantuan, serangan, penghinaan, pembunuhan anggota)
  menggeser langsung.
- Threshold: `goodwill ≤ -50` → **resmi hostil** (boleh serang tanpa
  reputasi hukum tambahan), `≥ +50` → aliansi-able.

Efek relasi: akses wilayah, harga/bea, kontrak yang ditawarkan, patroli
yang menyerang lebih dulu, reaksi pembunuhan anggota (balas dendam
otomatis untuk faksi Tier S/I yang tahu — §4.2 model informasi).

### 5.3 Perilaku faksi (evaluasi di strategic tick)

Cari kerja (buka kontrak), jaga wilayah, rekrut, balas serangan,
bikin/putus aliansi, berebut resource — semua = kandidat aksi dengan skor
utilitas. Prestasi & memori: faksi menyimpan siapa pernah menyerang siapa
(ringkas, dengan umur memori).

Tindakan pemain → relasi berubah **persisten** (event
`faction_relation_changed`), decay perlahan kembali ke netral — dendam
punya umur, dendam besar tidak hilang dalam 1 menit (decay rate per
selisih, konstanta saat eksekusi).

---

## 6. Biao Ren & sistem kontrak (loop pemain utama)

### 6.1 Contract store (BARU — pola store ke-6, sumber: doc B §2/§5)

```
Contract {
  contractId,
  issuer: { factionId | npcId, anonymous?: boolean, misleading?: boolean },
  kind: escort | delivery | prisoner | document | refugee
      | bounty_dead_or_alive | retrieval | investigation
      | espionage | assassination,
  route: segmentIds[],        // untuk kontrak perjalanan
  deadline,                   // kondisi dunia saat diterbitkan (musim/perang)
  reward,                     // OC — ditahan di escrow packages/economy
  escrowState: open | locked | paid | forfeited,
  riskTags[],                 // bandit | war_zone | storm | traitor_risk ...
  conditions[],               // barang utuh | target hidup | identitas
                              // diketahui | tiba sebelum deadline ...
  reputationEffect: { onSuccess, onFail },
  state: offered | accepted | active | succeeded | failed | expired
}
```

- **Escrow:** reward ditahan ekonomi saat kontrak diterbitkan (bukan
  janji kosong) — gagal = dana kembali ke pemberi (+utang/kutipan bisa
  timbul, doc B §2).
- **Assassination** hanya legal dalam koridor PvP/hukum `05` + hukum
  wilayah; kontrak terhadap tokoh berpengaruh = wajib berlabel risiko
  politik (§6.4).
- Kontrak bisa **diterbitkan NPC/faksi/penyelenggara (organisasi pemain)**.

### 6.2 Encounter ABSTRAK per segmen jalur — desain Phase A (keputusan final)

Perjalanan bukan "A→B tanpa insiden": tiap `routeSegment` punya
`dangerProfile` (data world.json: density bandit, faksi pengendali, bea,
cuaca, kondisi perang).

Saat rombongan masuk segmen → roll deterministik
`rng(seed = hash(contractId | segmentId | tick))` → tabel hasil:

| Hasil | Resolusi Phase A |
|---|---|
| `clean_pass` | lolos, lanjut |
| `bandit_ambush` | tempur instan (resolver cepat pakai pipeline damage yang ada) atau bayar/hilang barang |
| `toll_demand` | bayar bea (OC) atau negosiasi (cek relasi faksi/rep) atau tolak → tempur |
| `patrol_inspection` | cocokkan izin/faksi → lolos, sita, atau ditangkap (→ §9 kalau level hukum cukup) |
| `betrayal` | konvoi/awak berkhianat (dicegat kalau rep/inspection cukup tinggi) |
| `sandstorm` / cuaca | delay, kerusakan barang, rute alternatif |

Desain kontrak **netral terhadap dua mode resolver**: data segmen, escrow,
kondisi, dan reward tidak berubah saat resolver upgrade → **Phase B** memanggil
`NpcBrain` hidup (`09-combat-depth.md` §4) untuk hasil ambush — sekarang
masih resolusi abstrak. Phase A bisa jalan TANPA menunggu Sprint 7
(keputusan final sesi ini).

### 6.3 Reputasi & konsekuensi

- Sukses → `reputationEffect.onSuccess` → reputasi naik → kontrak tier
  lebih sulit + lebih mahal terbuka (tier = field, bukan ladder terpisah).
- Gagal → reputasi turun + kemungkinan **utang/tuntutan** + relasi faksi
  rusak. Kegagalan bukan cuma hukuman: dampak dunia lanjut (barang dicuri
  jadi incaran lain, pemberi rugi → mengurangi bayaran berikutnya).
- Reputasi per-faksi (bisa satu angka global + modifier per faksi —
  keputusan kecil saat eksekusi).

### 6.4 Kontrak vs informasi (doc B §5)

Pemberi bisa anonim/menyesatkan; target punya faksi lain; hasil bisa
memicu: investigasi (witness), balas dendam (§5.2), perubahan
kepemimpinan (§4.5), konflik baru. Dampak = fungsi posisi target + kondisi
politik, **bukan fungsi jumlah korban**.

---

## 7. Perang & territori (doc A §8–§9 + doc B §7)

### 7.1 Territori-per-faksi = EXTENSION klaim, bukan sistem paralel

Field **baru** `controllerFactionId` di record klaim yang sudah ada
(`02`) — siapa menguasai petak/kota → berlaku juga untuk pajak, patroli,
hukum, akses kontrak di wilayah itu. JANGAN bikin sistem klaim kedua.

### 7.2 Aktivitas perang

Pertempuran pasukan & patroli · pengepungan benteng · penyergapan kafilah
& jalur suplai · pengintaian · perebutan gerbang · gangguan logistik ·
gencatan senjata & negosiasi (dipicu skor ancaman > skor permusuhan) ·
pemberontakan lokal setelah okupasi.

### 7.3 Logistik v1 — ABSTRAK (angka agregat, bukan simulasi karung)

```
supply: 0..100 per pasukan / per territory, dinaikkan garis aman,
        diturunkan per politik tick saat perang / jalur dipotong
supply < 30  → malus: patroli lemah, garnisun berkurang,
               efektivitas tempur ×0.75 (SUPPLY_MALUS)
supply = 0   → roll utilitas: mundur | menjarah | bubar
```

### 7.4 Kemenangan tempur ≠ legitimasi

Okupasi butuh `garrison + loyalty + supply`. Loyalty rendah → event
pemberontakan (resolver memakai pola wave spawner `09` §4.3 — konten ulang
pakai, bukan sistem baru). Penjarahan & sabotase menurunkan loyalty lebih
cepat daripada garrison menaikkannya (mencegah "pukul rata lalu pulang").

### 7.5 Simulasi wilayah jauh (jantung kelayakan CPU)

- **Dekat pemain** (radius aksi): state granular, boleh tick lebih rapat.
- **Jauh**: agregat per region — `pasukan, supply, loyalty, mood, ancaman`
  + resolusi laporan interval (`report` §4.2). Tidak ada per-individu per
  tick (acceptance §12.8).
- Handoff dekat↔jauh = pola **online/offline duality alife-sdk** (§13):
  saat pemain masuk radius, agregat "dibuka" jadi state granular dengan
  determinisme seeded (sumber: pola alife, MIT).

### 7.6 Perang × kontrak (saling mengunci)

Jalur ditutup faksi perang → kontrak reroute/ditunda/kena tarif perang;
penguasa lemah → kontrak melindunginya muncul; kemenangan → kontrak
okupasi/pasokan; kekalahan → kontrak pengungsi (doc B §2 item).

**Dependensi tempur lapangan:** resolver perang & ambush Phase B butuh
`09-combat-depth.md` (AI + projectile). Sebelum merge `09`, perang =
resolusi abstrak gaya §6.2 (desain ganda-stage yang sama) — jangan menahan
seluruh Phase A/D karena tempur penuh belum ada.

---

## 8. Combat identity wuxia (doc B §9 — konsumen, bukan sistem baru)

- **Rumahnya = mode FPS yang sudah ada** (gate Sprint 2) — melee jarak
  dekat bukan mode ketiga.
- Kit: pedang/tombak/dao/busur · combo light/heavy · block/parry/dodge/
  stagger · teknik dengan batas stamina/sumber daya · duel & skirmish ·
  interaksi melee ↔ panah.
- **Payload Sprint 5 FPS skills** (`08` §4) + damage windows (pola
  `ToggleWeaponCollision` — rencana di `09` Appendix A, ref Demo_ARPG) +
  scaling combo `+5% / +15%` per rantai (kalkulasi GE mereka, ideas-only).
- **Panah = projectile** `09` §3 dalam mode FPS — reuse engine tembak,
  bukan sistem tembak kedua.
- **Aturan keras:** TIDAK ADA teknik kebal total. Setiap teknik punya
  `cost / cooldown / counter` yang jelas (dodge mengalahkan charge, parry
  window sempit, dst) — positioning, timing, kerja sama tim tetap
  menentukan. Batas mekanis dijaga server (intent validation), bukan cuma
  animasi client.
- Brutal = dua layer: **server** (state `stagger`, `bleeding` DoT kecil,
  death state + loot) + **client UE5** (hit reaction, darah, gencatan —
  ledger aset `01` §7). Server tetap authority damage.

---

## 9. Hukum brutal — EKSEKUSI PUBLIK (keputusan final: world event hukum)

Varian Cangyuan di ATAS `05` (yang tetap otoritatif). Bukan fitur bunuh
seenaknya — **mekanik hukum** dengan syarat, saksi, dan reaksi faksi.

### 9.1 Alur eksekusi publik

1. Tersangka `wanted` **level maksimal (5)** — doktrin `05` — **ditangkap
   hidup** (bukan dibunuh di tempat).
2. Aparat/wali kota faksi imperium memindahkan tahanan ke **alun-alun
   ibu kota** (region type §3) → event `public_execution_scheduled`.
3. **Cooldown global** `EXEC_COOLDOWN_MS = 3_600_000` (min. 1 real-jam
   antar eksekusi — eksekusi langka = momen, bukan spam) + **hitung mundur**
   `EXEC_COUNTDOWN_MS = 300_000` (5 menit) — memberi waktu pemain/NPC
   menyaksikan, ikut campur, atau kabur.
4. Eksekusi `public_execution` → **witness = semua pemain & NPC dalam
   radius (pola 50 m `05`)**.
5. Dampak: faksi kriminal vs imperium `goodwill` turun (§5.2); hadir +
   terlibat → reputasi afiliasi naik/turun sesuai faksi; bounty penuh
   terbayar ke penangkap; NPC tersangka **mati permanen** (§4.5).

### 9.2 Batas (anti-abuse)

- Untuk **pemain** tersangka: penjara (prison ship `05`) dulu — eksekusi
  pemain = TIDAK dijanjikan Phase A; cek `05` (FINAL soal hukum) saat
  implementasi.
- Eksekusi oleh pemain berwenang (polisi/jenderal Cangyuan) = opsi Phase C,
  hanya dalam koridor `05` + kewenangan wilayah.
- **Padang pasir = hukum rimba:** frontier tanpa wali → tidak ada
  eksekusi publik, hanya bounty hunt. Kontras kota-vs-rimba = identitas
  planet (doc B §1).

### 9.3 Realisasi teknis

Store: event + reward lewat `wanted`/`politics` (yang sudah ada) — server
kirim `public_execution_*` event + state; animasi/darah/desain alun-alun =
client (ledger aset). **Nol sistem hukum baru** — hanya varian event.

---

## 10. Organisasi & kebebasan pemain (doc A §7 + doc B §8)

- Pemain boleh: bentuk kelompok pengawal/persilatan, rekrut NPC (dengan
  batas komando & loyalitas — tentara terbatas, bukan legion tanpa batas),
  aliansi antar-organisasi, ambil kontrak dari faksi berbeda, jadi
  tentara/komandan (syarat wilayah), bantu pemberontakan / pertahankan
  imperium, kuasai wilayah kalau aturan perampasan mengizinkan, jadi
  pedagang/supplier/perantara politik — **satu jalur tidak dikunci
  permanen** (doc B §8).
- Organisasi pemain = faction entity `kind: player_org` (extend
  `communityId` — bukan tabel kedua).
- Role & permission: leader / militer / diplomat / intel / admin /
  gubernur / operatif — model otoritas pola Sprint 2 (siapa boleh
  perintah apa).
- Perintah NPC rekrutan: jaga, patroli, escort kafilah, kirim info,
  angkut, komando bawahan, tempur — semua lewat evaluasi loyalitas §4.3
  (NPC menolak perintah yang bertentangan dengan loyalitas/keselamatan/
  kemampuan — doc B §6).
- Pemimpin mati/keluar → successor rules per aturan organisasi sendiri
  (pilih / kudetakan / fraksi pecah / bubar) — state di entity, pakai
  mesin suksesi §4.5 versi sederhana.
- Pemain dari planet lain = bagian universe yang sama; kapal/teknologi
  tetap relevan sesuai §2.

---

## 11. Fase eksekusi (gabungan doc B Phase A–E + slicing teknis)

> Satu fase ≠ satu PR. Setiap fase dipecah jadi slice kecil; gate `06` (yang
> di dokumen masing-masing) + `08` §4 sprint yang menahan = merah = STOP.

### Phase A — Biao Ren prototype *(sumber: doc B §11 + keputusan 2026-10-09)*

- **Isi:** 1 kota + 1 desa + 1 jalur (3–5 segmen) + **3 faksi awal**
  (imperium kecil, sekte/komunitas lokal, bandit) + contract store +
  **encounter abstrak** (§6.2) + reputasi dasar + escrow.
- **Dependensi:** economy ✅, wanted ✅, claims ✅ (semua merged Sprint 2).
  **TIDAK menunggu Sprint 7.**
- **Slice kode (rencana, bukan komitmen urutan):**
  `A1 contract store + validator intent` → `A2 route segment + encounter
  resolver deterministik` → `A3 escrow + reputasi + kontrak sukses/gagal`.
- **Jangan dijanjikan di Phase A:** melee/FPS wuxia (Sprint 5), AI tempur
  hidup (Sprint 7), suksesi, perang — lihat fase berikut.

### Phase B — Jianghu simulation

- Faction entity penuh (upgrade `communityId`), relasi dua-layer decay,
  rekrut NPC, kontrak pemburuan, penyergapan, **upgrade encounter resolver
  → NpcBrain hidup** (butuh `09-combat-depth.md` §4 merge), reaksi aksi
  pemain → relasi berubah persisten.
- Dependensi: `09` PR-A/PR-C (lock + AI).

### Phase C — Imperial politics

- NPC aktor penuh (Tier S/I), **strategic tick + utility AI** (port pola
  alife-sdk → `packages/npc` + NOTICE), kematian permanen + **mesin
  suksesi**, konspirasi/spionase (model informasi §4.2), eksekusi pemain
  berwenang (REVIEW `05` dulu).
- Dependensi: `09` §4 + store `packages/politics` + persistence db
  (follow-up yang tercatat di `08`).

### Phase D — Persistent warfare

- Territori `controllerFactionId`, supply v1 (§7.3), pengepungan,
  pemberontakan, simulasi wilayah jauh (§7.5 agregat), kronik perang.
- Dependensi: Phase C + `09` (projectile/AI) + **Sprint 3 event store**
  (`08` §4) untuk kronik/audit sejarah perang.

### Phase E — Universe integration

- Validasi lintas planet: kapal vs darat (§2.3), ekonomi OC mengalir
  lintas region, organisasi lintas planet, pindah planet bawa progres
  (state persisten §2.4–2.5). Acceptance §12.10.

### Catatan urutan vs roadmap `08` §4

Phase A **boleh paralel dengan sprint mana pun** (menyentuh store baru +
field sendiri, gak nyentuh file sprint yang lagi digarap) — selama Sprint 3
tidak sedang menyentuh store yang sama. B/C/D menunggu Sprint 7 + 3.
Blueprint ini TIDAK menambah/menggeser sprint di `08` §4.

---

## 12. Acceptance criteria

Dipertahankan dari doc B §12 (verbatim), + 2 poin kita. Verifikasi per fase
dijalankan saat akhir fase tersebut.

1. Pemain dapat menerima dan menyelesaikan kontrak pengawalan. *(Phase A)*
2. Perjalanan dapat menghasilkan beberapa jenis ancaman dan solusi.
   *(Phase A — §6.2 tabel)*
3. Faksi memiliki tujuan serta hubungan yang dapat berubah. *(Phase B)*
4. NPC dan kelompok dapat melakukan tindakan tanpa quest linear yang wajib
   dijalankan pemain. *(Phase C)*
5. Kematian tokoh penting dapat mengubah keadaan politik tanpa respawn
   otomatis. *(Phase C)*
6. Perebutan wilayah menimbulkan konsekuensi yang bertahan. *(Phase D)*
7. Keadaan penting tetap konsisten setelah pemain logout atau berpindah
   planet. *(Phase E, boleh dicek dini di A)*
8. Simulasi wilayah jauh tidak memerlukan detail penuh setiap NPC setiap
   tick. *(Phase D — §7.5)*
9. Semua aksi yang memengaruhi dunia divalidasi oleh server otoritatif
   ARCLUX. *(semua fase — D-008, dibuktikan test validator)*
10. Gameplay tidak memisahkan Cangyuan dari universe bersama. *(Phase E)*
11. **(baru)** Setiap aksi politik/kontrak/perubahan wilayah menghasilkan
    event yang bisa diaudit di store (intent + event log) — dibuktikan test.
12. **(baru)** Strategic tick deterministik: seed sama → kronik identik
    di dua proses (pola determinism certificate Sprint 6 `08` §4).

---

## 13. Referensi & transparansi lisensi

| Sumber | Lisensi | Status pakai |
|---|---|---|
| **alife-sdk** (`eurusik/alife-sdk`, TS/Node) | **MIT** | **Port POLA** ke `packages/npc`/`politics`: budget otak 20/tick round-robin, relasi faksi dua-layer + goodwill decay ke 0, threshold morale/panic, handoff online↔offline, SeededRandom deterministik, StoryRegistry → JANGAN dijadikan dependency runtime; tulis NOTICE attribution saat kode pertama masuk |
| Riset 3 repo UE (SpaceInvader3D, AR Rifle Template, Demo_ARPG) | NONE | **Ideas-only** — tercatat di `09-combat-depth.md` §9. Prinsip sesi 2026-10-09: **pelajari pola/ide, jangan copy kode** |
| *Blades of the Guardians* (Biao Ren) | — | Inspirasi naratif/tema (pengawal bayaran, kekaisaran brutal). Tanpa asset/kode/teks |
| Draft A + Draft B (user) | — | Digabung jadi file ini; draft asli tidak disimpan (anti-duplikasi §0) |

---

## 14. Checklist teknis saat eksekusi (reuse / extend / BARU)

| Sistem | Status | Target |
|---|---|---|
| economy (OC, escrow) | reuse + escrow state | `packages/economy` |
| wanted 0–5, witness, bounty, prison | reuse | `packages/wanted` + `05` |
| claims (petak) | **extend** `controllerFactionId` | `packages/gameserver` claims |
| `communityId` | **extend** → reference faction entity | types + faction store |
| world.json founder rules (biome, safe-zone, larangan kapal) | reuse | `07` |
| mode FPS, mode gate | reuse | Sprint 2 |
| lock-on / projectile / AI tempur | reuse (konsumen) | `09` = Sprint 7 |
| event store / kronik | reuse (setelah merge) | Sprint 3 |
| **contract store** | **BARU** (pola store ke-6) | `packages/contracts` |
| **faction entity + relasi dua-layer** | **BARU** (pola store ke-7) | `packages/factions` (atau subspace `politics`) |
| **politics: aktor, suksesi, strategic tick, laporan** | **BARU** | `packages/politics` |
| **NPC: port pola alife (budget, morale, offline handoff)** | **BARU** | `packages/npc` + NOTICE MIT |
| encounter resolver (abstrak → AI) | **BARU** | di dalam `contracts` |

**Pra-desain kontrak API (finalisasi saat PR eksekusi — jangan anggap
final sebelum itu):**

- Intent: `contract_accept`, `contract_submit`, `contract_abandon`,
  `org_create`, `order_issue`, `recruit_npc`, `claim_control_change`
  (lewat validator), `execution_report` (laporan tahanan siap §9).
- Event: `contract_*` (offered/accepted/completed/failed/expired),
  `faction_relation_changed`, `faction_state_changed`,
  `succession_started/resolved`, `order_issued/order_execution`,
  `territory_control_changed`, `public_execution_scheduled/executed`,
  `war_*` (supply/occupation/rebellion), `report_filed`.

---

*Blueprint ini UNDANG-UNDANG desain untuk pembangunan planet ke-3. Eksekusi
dilakukan per-Phase (§11) dengan acceptance §12. Perubahan setelah final
dokumen = amend terbuka + catatan sumber — bukan sunyi-sunyi.*
