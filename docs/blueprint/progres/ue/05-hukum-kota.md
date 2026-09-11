# 05 — HUKUM & KOTA (wanted, polisi pemain, prison, bounty, ekonomi Mars)

> Status: **SPEC-FINAL (eksekusi: fase UE, setelah 10.V DONE).**
> Induk: `02-asset-pipeline.md` (badan/otak, cap, lifecycle, gotong-royong),
> `01-assets.md` (POI, penempatan), `04-graphics.md` (presentasi kota),
> Blueprint 10 (flight, landing, tether), 10.E (emergency persist),
> 10.V F3 (tag radar).
> Prinsip satu kalimat: **dunia diisi pemain; hukum ditegakkan pemain;
> mesin hanya mencatat dan membatasi.**
> Anti-duplikasi: wanted = BARU (sesi ini); sisanya menumpang sistem
> yang sudah ada (sumber dicantumkan per bagian).

## 0. Doktrin (tidak bisa ditawar)

1. **Tiga dunia, tiga peran.** Bumi = kota mati (dikunjungi, tidak
   dilayani). Mars = ibu kota kehidupan (ekonomi, hukum, populasi).
   Space = transit (orbit, station, kapal prison). Satu pemain hidup
   di ketiganya; satu karakter, satu identitas.
2. **Keamanan adalah profesi pemain, bukan skrip.** Polisi, patroli,
   pengawalan, dan pemburu bounty = pemain yang direkrut, diseleksi,
   dan berpangkat. NPC (drone/humanoid) = PELENGKAP: patroli rute,
   verifikasi, eskalasi. NPC tidak pernah menjadi detektif, hakim,
   atau algojo.
3. **Identitas = ID akun + nama karakter.** Bukan IP, bukan perangkat
   (IP berubah-ubah dan privat; mesin tidak bisa disogok tetapi juga
   tidak boleh menuduh yang salah).
4. **Hukuman adalah gameplay, bukan menu.** Tahanan tidak memiliki
   tombol restart/keluar; kebebasan diperoleh lewat bebas tugas,
   dibebaskan kawan, atau dirampas kawan. Setiap status tercatat di
   server (otoritas tunggal, timestamp saklek).
5. **Kota adalah pasar, bukan mal.** Toko, apartemen, dan stall =
   klaim + aset pemain via pipeline 02 (pola Ark). Pengembang tidak
   mengisi etalase.

## 1. Tiga dunia (FINAL)

| Dunia | Peran | Aturan main |
|---|---|---|
| Bumi | Kota mati (ruins, abandoned) | Wujud final sistem decay: puing + kota kosong yang dapat dijelajahi. NOL layanan (tanpa toko, tanpa HQ, tanpa spawn utama). Buronan dapat bersembunyi di sini — bersembunyi = keluar dari ekonomi. |
| Mars | Pusat kehidupan (cyberpunk city) | Klaim, toko, apartemen, kantor polisi, zona bulan di dalam planet. Gurun di luar kota = outskirts (klaim + outpost). Atmosfer seperti Bumi (bukan bola boling — planet didarati, §01). |
| Space | Travel / orbit / station | Transit antar planet, station komunitas, kapal prison bergerak. Aturan flight + tether Blueprint 10 berlaku penuh. |

## 2. Wanted system (otaknya — FINAL)

2.1. Struktur record (server, invisible — bukan dokumen pemain):

```
player = { id, wantedLevel (0–5), lastSeen { chunkKey, tick }, disguise: bool }
```

2.2. Pemicu (trigger): membunuh pemain, kerusuhan (damage properti/
kawasan), pencurian. Tiap kejahatan menaikkan `wantedLevel` sesuai
bobot (membunuh > merusak > mencuri). Kejahatan tercatat dengan
saksi (pemain/NPC/drone dalam radius) — tanpa saksi = tanpa record
(mesin jujur: yang tidak terlihat = tidak terjadi).
2.3. Efek per level (eskalasi):

| Level | Efek |
|---|---|
| 1–2 | Masuk radar polisi lokal; drone patroli mendekat + verifikasi |
| 3 | Akses kota dibatasi (gerbang menolak; daftar hitam kota); patroli spawn |
| 4 | Buruan aktif: polisi pemain menerima ping `lastSeen`; bounty terbuka |
| 5 (berat) | Pengejaran lintas wilayah; penjara kelas berat + pengawalan ketat |

2.4. `lastSeen` diperbarui saat terlihat (radar/drone/pemain),
bukan live-tracking (buronan yang pandai menghilang = gameplay
yang sah). Kembali ke kota asal = penangkapan ulang, kecuali
penyamaran lolos verifikasi.
2.5. Penyamaran (`disguise`) vs verifikasi: penyamaran menekan
prioritas radar, TIDAK menghapus record. Aksi verifikasi polisi
(pemain) menyingkapnya. Keseimbangan disetel di playtest, bukan
di dokumen ini.
2.6. Daftar hitam (blacklist) per kota: pemain dilarang masuk kota
tempat ia buronan (penegakan di gerbang + zona, otomatis). Ingin
kembali = selesaikan status (bebas tugas, tangkap, atau tebus
sesuai hukum kota — fase ekonomi hukum, bukan dokumen ini).

## 3. Polisi pemain (profesi, bukan kostum — FINAL)

3.1. Rekrutmen + seleksi: pendaftaran terbuka, seleksi (uji tugas
+ masa percobaan) — seragam tidak dapat dipakai tanpa pangkat.
Pangkat menentukan wewenang: jaga kota, patroli sektor, verifikasi
ID, penangkapan, pengawalan tahanan, komando operasi.
3.2. Tugas: menjaga kota dan fasilitas, patroli (rute + respons
ping), pengawalan transport tahanan, penjagaan zona prison,
operasi pengejaran (koordinat terbatas, need-to-know).
3.3. Wewenang terikat pangkat + tercatat: setiap penangkapan,
penggeledahan, dan penolakan gerbang masuk log server (nama
petugas, pangkat, target, tick). Penyalahgunaan = pencabutan
pangkat oleh komando (pemain senior) — mesin mencatat, manusia
mengadili.
3.4. Insentif: gaji dinas + bonus penangkapan + pangkat = reputasi
(06). Polisi adalah karier dengan progresi, bukan peran sementara.

## 4. NPC pelengkap (batas eksplisit — FINAL)

4.1. Drone patroli: rute seeded per sektor, verifikasi ID otomatis
(challenge-response terhadap record wanted), eskalasi ke polisi
pemain via ping (tidak menembak duluan kecuali diserang —
aturan engagement tertulis di sini, disetel di playtest).
4.2. Humanoid jaga: titik statis (gerbang, HQ, prison perimeter),
dialog standar (tanya ID, tolak/masuk), tidak bernegosiasi.
4.3. Larangan: NPC tidak menyimpulkan, tidak menyergap di luar
rute, tidak mengenali penyamaran yang lolos ambang (ambang =
angka, bukan firasat). Kecerdasan kota = pemainnya.

## 5. Prison (FINAL)

5.1. Penangkapan → transport (vessel polisi) → kapal/station
prison. Narapidana tidak dapat keluar kecuali: masa tahanan
selesai, dibebaskan kawan (bobol sistem), atau dirampas kawan
(serang transport/penjara). NOL tombol restart.
5.2. Kapal prison BERGERAK (rute bermil-mil, koordinat need-to-know:
kawan menerima koordinat via misi penyelamatan). Konvoi dapat
diserang saat transit — kapal polisi yang jatuh mengikuti aturan
pendaratan paksa Blueprint 10 (mendarat, bukan menguap).
5.3. Jailbreak = gotong-royong terbalik: kawan menghancurkan
pertahanan atau membobol sistem (aturan bangun/hancur 02 §10,
arah dibalik). Kerusakan prison pulih otomatis perlahan
(≤24 jam, aturan building) — penjara yang jebol kemarin =
misi hari ini.
5.4. Zona prison 1 km: pengawasan drone keliling, verifikasi tiap
kontak radar (kawan/lawan/otoritas), tanpa izin = ditolak +
ping. Berlaku permanen, bukan hanya saat ada tahanan berat.
5.5. Klasifikasi tahanan menentukan pengawalan (ringan: 1 unit;
berat/komunitas besar: konvoi + drone + komando). Penyerbuan
balasan = perang terbuka (sistem perang 02 §10 berlaku penuh).

## 6. Bounty (FINAL)

6.1. Kontrak bounty terbuka pada level ≥4 (papan di HQ + pasar).
Hadiah diambil di kantor polisi / mega-HQ kota dengan menyerahkan
buronan (hidup = penuh, tumbang = sebagian — angka di playtest).
6.2. Penyerangan terhadap operasi polisi/prison = perang besar:
pengawalan menebal, drone siaga, komando turun. Eskalasi otomatis
mengikuti kelas tahanan — bukan GM yang mengatur, melainkan tabel.

## 7. Ekonomi kota Mars (FINAL)

7.1. Toko, apartemen, dan stall = klaim + aset pemain (pipeline 02).
Pemain mendaftar usaha, menempatkan aset niaga dalam cap-nya,
menjual komponen dan aset (pola pasar Ark). Kota hidup karena
etalasenya milik orang.
7.2. Kawasan: niaga (pasar + HQ + bounty), hunian (apartemen),
dinas (kantor polisi, penjara kota), outskirts gurun (outpost +
klaim murah). Zonasi = wewenang dunia (pola 02 §8).

## 8. Phasing eksekusi (fase UE, berlapis — FINAL)

1. Wanted record + radar + pembatasan gerbang (menumpang F3 + klaim).
2. Drone patroli + verifikasi + eskalasi ping.
3. Prison ship + transport + jailbreak + zona 1 km.
4. Bounty + HQ + tabel eskalasi.
5. Polisi pemain: rekrutmen + pangkat + log + komando.
6. Ekonomi kota penuh (pasar + hunian + outskirts).
- Acceptance per lapis: kejahatan → record → kejar → tangkap →
  tahan → (bebas/rampas) tercatat ujung-ke-ujung di log server.
