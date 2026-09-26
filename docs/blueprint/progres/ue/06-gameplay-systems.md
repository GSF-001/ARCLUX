# 06 — SISTEM PERMAINAN (gameplay loop, economy, combat, crime, progression)

> Status: **SPEC-FINAL (eksekusi: fase UE, setelah 10.V DONE).**
> Induk: 05-hukum-kota.md (hukum/kota), 02-asset-pipeline.md (crafting/repair),
> 07-special-capabilities.md (kemampuan khusus), blueprint 01–10 (semua sistem).
> Prinsip satu kalimat: **UE = presentasi. Semua logic tetap di server TS.**
> Dokumen ini menutup GAP gameplay yang belum ada di blueprint 01–10 maupun
> docs UE 00–05. Setiap baris = keputusan FINAL.

## 0. Doktrin (tidak bisa ditawar)

1. **Server = otoritas tunggal.** Seluruh angka (damage, harga, cooldown, drop chance,
   timer) dihitung di server TS. Client hanya RENDER + INPUT. Cheat = mustahil
   struktural.
2. **Satu item, satu ID unik.** Setiap item (senjata, komponen, pakaian, kapal)
   punya `itemId` permanen yang tercatat di server. Pemindahan owner = update record,
   bukan buat item baru.
3. **Tidak ada item permanen.** Semua item bisa hilang (death drop, theft, decay).
   Top-up OC = beli HAK PAKAI, bukan kepemilikan abadi.
4. **Skill = konteks.** Ship skill ≠ FPS skill. Transisi otomatis saat player
   pindah mode. Tidak ada "ship skill dipakai di darat".
5. **Dunia = pemain.** NPC minimal: cleanup, repair, patrol. Kecerdasan kota =
   pemainnya.

---

## 1. MATA UANG — OC (Orbital Credit)

### 1.1 Definisi
- OC = mata uang utama ARCLUX.
- 1 OC = 1 unit nilai. Tidak ada pecahan (tidak ada sen/persen).
- Sumber OC: top-up real money, jual item ke player lain, bounty reward,
  mission reward (fase UE nanti).

### 1.2 Top-up
- Player beli OC dari luar game (web/mobile payment).
- OC masuk ke wallet player di server.
- **Tidak ada konversi OC→real money** (anti-money laundering).
- Top-up minimum: 10 OC. Maksimum: tidak dibatasi (server log semua transaksi).

### 1.3 Wallet display
- HUD menampilkan: `OC: [angka]` di corner bawah (posisi tetap, tidak mengganggu).
- Update: setiap kali OC berubah (buy/sell/repair/bounty).
- Format angka: tanpa desimal, koma ribuan (contoh: `OC: 1,250,000`).

### 1.4 Transaksi P2P
- Player A jual item → Player B beli → OC berpindah dari B ke A.
- Harga ditentukan penjual (server validasi: harga ≥ 0).
- Server kenakan pajak 5% (masuk treasury dunia, bukan ke NPC).
- Transaksi tercatat di log server (anti-fraud).

### 1.5 Pembelian dari ARCLUX Company Store
- ARCLUX = NPC store (bukan player-owned).
- Menjual: senjata standar, komponen kapal, pakaian armor, item dasar.
- Harga tetap (server-set, bukan dynamic).
- Item dari ARCLUX punya `origin: "arclux"` (beda dari `origin: "player"`).
- **Item dari ARCLUX bisa dicuri/dijual** — tetap punya `itemId` unik.

### 1.6 UX di UE5
- Wallet overlay: panel kecil transparan (gaya hologram), muncul saat transaksi.
- Pembelian: konfirmasi dialog + potong OC langsung.
- P2P trade: jendela trade (dua kolom: item seller + OC buyer, kedua konfirmasi).
- Sound: blip halus saat OC berubah (MetaSounds, frekuensi naik/turun mengikuti nominal).

---

## 2. SKILL DUAL — Ship Mode vs FPS Mode

### 2.1 Prinsip
- Player punya DUA skill set terpisah.
- **Ship mode**: aktif saat di dalam kapal (cockpit view).
- **FPS mode**: aktif saat di luar kapal (interior/planet/walking).
- Transisi: otomatis saat player exit/enter kapal. Tidak perlu input manual.

### 2.2 Ship Skills (server-side, sudah ada di `packages/gameserver`)
- Engine (speed, acceleration, fuel efficiency)
- Weapons (damage, accuracy, cooldown)
- Shield (regen, capacity, resistance)
- Navigation (sensor range, jump accuracy)
- Repair (field repair speed, material efficiency)

### 2.3 FPS Skills (server-side, baru)
- **Combat**: aim accuracy, reload speed, melee damage, grenade radius
- **Stealth**: detection threshold, noise reduction, lockpick speed
- **Survival**: health regen, carry weight, environmental resistance
- **Technical**: hack speed, door breach, circuit bypass

### 2.4 Skill Queue (EVE-style)
- Skill = waktu real-time (bukan XP point).
- Queue maksimum: 1 skill aktif + 3 antrian.
- Skill baru = unlock slot (progression organik).
- Visual UE5: holographic skill panel di cockpit (ship) atau di menu (FPS).

### 2.5 Transisi Skill
- Saat player duduk di cockpit → ship skills aktif, FPS skills hidden.
- Saat player berdiri dari cockpit → FPS skills aktif, ship skills hidden.
- Tidak ada cooldown cross-mode (FPS skill tidak affect ship skill, dan sebaliknya).
- Server track: `activeMode: "ship" | "fps"` per player.

### 2.5.1 Kamera & perspektif (TPP/FPP — PC)
- **FPP (first-person)**: COCKPIT mode — mata pilot, HUD nempel kaca, droplet/shake hanya di sini. Input = mouse look + WASD kokpit.
- **TPP (third-person)**: ORBIT / TACTICAL / CINEMATIC / FREE — kamera di luar kapal, HUD tipis contextual. Transisi FPP↔TPP via tombol **V** (berurutan, 0.4s blend, tidak reset momentum kapal).
- Server tidak peduli FPP/TPP — state kapal sama; beda hanya presentasi. Anti-cheat: TPP tidak beri vision ekstra (clip + fog sama dengan FPP).
- Penamaan PC: **FPP** dan **TPP** (bukan "TPP FPP" informal) — konsisten di docs & UI.

### 2.6 UX di UE5 — HUD KONTEKSTUAL AAA (bukan selalu ON)
- **Prinsip: HUD = contextual, bukan debug overlay.** Semua panel ON = amatir.
- **Idle (normal)**: hampir kosong — hanya crosshair/reticle + speed kecil + compass tipis. Sisa HIDDEN.
- **Scan/Tactical (on demand, hold/toggle)**: TAC kiri + target info + radar detail muncul (fade/scan 0.3s).
- **Combat/Docking (situasional)**: full HUD — weapon slots + vessel stats + mission panel aktif. Auto-hide saat keluar combat (3 detik tanpa threat).
- Ship mode: skill bar di bawah HUD (4 slot: engine/weapons/shield/nav) — hanya di Scan/Combat.
- FPS mode: skill bar di bawah HUD (4 slot: combat/stealth/survival/technical) — hanya di Scan/Combat.
- Transisi animasi: skill bar slide out → slide in (0.3s). HUD "hidup" (fade/scan, bukan pop).
- Sound: ship mode = deep hum, FPS mode = click halus.

---

## 3. HACKING SYSTEM

### 3.1 Konsep
- Player bisa hack ship/stasiun orang lain.
- Hack = akses sistem internal (bukan damage fisik).
- Target: door lock, security camera, engine disable, alarm.

### 3.2 Syarat
- Player harus punya item `computer` (dibeli dari ARCLUX store atau dicuri).
- Player harus dekat target (jarak ≤ 10m untuk ship, ≤ 5m untuk door).
- Target tidak boleh dalam safe zone.

### 3.3 Animasi Hack (UE5)
1. Player buka inventory → pilih computer → equip.
2. Player duduk/lutut → buka laptop (animasi 0.5s).
3. Layar laptop menampilkan: progress bar + skill check mini-game.
4. Mini-game: tekan tombol urut (4-6 tombol, random per attempt).
5. Success: akses terbuka (door unlock / camera off / engine disable).
6. Fail: alarm bunyi + wanted level naik + computer damage (10% HP).

### 3.4 Hack Targets
| Target | Efek | Durasi | Risiko |
|--------|------|--------|--------|
| Door lock | Pintu terbuka | Permanen sampai repair | Low (tidak terdeteksi) |
| Security camera | Kamera mati | 60 detik | Medium (alarm jika terlihat) |
| Engine disable | Mesin mati | 30 detik | High (wanted +2) |
| Alarm trigger | Alarm aktif | 120 detik | High (wanted +3) |
| Cargo access | Buka muatan | Permanen | Very High (wanted +4) |

### 3.5 Anti-spam
- Cooldown hack: 60 detik per target.
- 3 fail berturut = alarm otomatis + wanted +2.
- Computer item punya HP (100). Setiap fail = -10 HP. 0 HP = item hancur.

### 3.6 UX di UE5
- Laptop 3D model (dari asset repo) — terbuka saat hack.
- Progress bar: holographic overlay di layar laptop.
- Mini-game: UMG widget interaktif (keyboard input).
- Sound: typing sound + progress beep + success/fail chime.

---

## 4. FPS COMBAT

### 4.1 Senjata
- Senjata dibeli dari ARCLUX store atau dicuri dari player lain.
- Setiap senjata punya: `itemId`, `damage`, `range`, `cooldown`, `ammo`, `durability`.
- Senjata bisa rusak (durability turun saat dipakai). 0 = hancur.

### 4.2 Komponen FPS Combat
| Komponen | Deskripsi |
|----------|-----------|
| **Aim** | ADS (aim down sights) — zoom 1.5x, accuracy naik, speed turun |
| **Hip fire** | Tembak tanpa ADS — spread lebih besar, speed normal |
| **Reload** | Animasi reload (1-3 detik tergantung senjata) |
| **Melee** | Tusuk/pukul — damage tinggi, range sangat dekat (2m) |
| **Grenade** | Lempar granat — area damage, 3 detik timer, pin animasi |
| **Loot** | Ambil item dari corpse/container — animasijongkok + reach |

### 4.3 Door Breach
- Pemain bisa tendang/pukul pintu untuk buka paksa.
- Durasi: 2-5 detik (tergantung material pintu).
- Efek: pintu hancur (visual: dinding retak, debris).
- Risiko: noise → detection meter naik.
- Syarat: tidak ada di safe zone.

### 4.4 Looting
- Kill player/NPC → item jatuh di tanah (corpus).
- Player lain bisa looting: dekat corpus → interact (E) → pilih item.
- Animasi: jongkok → ambil (0.5s).
- Looting tanpa izin = pencurian → wanted naik.
- Corpses menghilang setelah 300 detik (5 menit).

### 4.5 UX di UE5 — INVENTORI 4 SENJATA (batas keras) + HUD KONTEKSTUAL
- **Batas inventori: 4 senjata aktif** (hotkey 1–4) + weapon wheel (tahan Q → pilih). Lebih dari 4 = harus drop/simpan di ship cargo. Tidak ada scroll tak terbatas.
- Carry weight: melampaui 4 slot + armor berat → speed -20% + stamina -30% (server hitung).
- Weapon wheel: rotasi senjata (tahan Q → pilih) — hanya di Scan/Combat, hidden di Idle.
- Ammo counter: di bawah crosshair (hanya saat senjata equip).
- Damage indicator: arah damage (flash merah di tepi layar) — contextual.
- Grenade arc: garis prediksi parabola saat lempar — hanya saat pin ditarik.
- Loot prompt: teks muncul saat dekat corpus ("E — Loot") — hanya 5m radius.

### 4.6 Performa / proforma (anti patah-patah — optimal wajib)
- **Snapshot 10 Hz + interpolasi klien** (bukan 60 Hz). UE interpolasi visual deterministik (sama dengan `apps/game`); NOL `Date.now` di logic. Jeda jaringan ≠ stutter.
- **Anggaran HUD**: update hanya saat state berubah; panel scan/combat ≤0.5 ms/frame @1080p. Idle = ~0 ms (HIDDEN).
- **Anggaran VFX FPS (HIGH)**: muzzle ≤8, tracer ≤32, impact ≤64, grenade ≤4 — pool daur-ulang (NOL spawn brutal). Melebihi = queue, bukan spike.
- **LOD senjata**: FPP high-poly, TPP low-poly + impostor >30m. Satu tier = satu budget, bukan klaim.
- **Kriteria patah**: frame time p95 >16.6 ms saat duel 1v1 di HIGH = bug, bukan beban wajar (ukur via `stat unit`).

### 4.7 Realisme gameplay (bukan cuma asset/UI)
- Aim = recoil + spread + stamina + stance (jongkok/prone -30% spread). Bukan hitscan murni.
- Reload = interruptible (sprint = cancel, peluru hilang).
- Door breach = noise 80 → stealth + wanted, bukan instant.
- Loot = 0.5s jongkok + reach, bisa di-interrupt damage.
- Semua angka di atas server-authoritative (presentasi UE tidak ubah hasil).

### 4.8 Tabel senjata FPS (FINAL — referensi COD, tanpa duplikat §4.1)
- TTK acuan (HP 100): Rifle ~250ms (5-6 hit), SMG ~230ms <15m, Sniper 1 head / 2 body, Shotgun 1 hit <8m / 0 >20m. Angka final di playtest, struktur tabel TETAP.
- Falloff 3-tier (server hitung, UE render): SMG drop-1 10-15m, Rifle 35-46m, Sniper 100m+. Di luar tier = damage turun, bukan miss acak.
- ADS / sprint-to-fire (server vonis, UE animasi): Pistol 200ms / Rifle 300ms / Sniper 550ms+; sprint-to-fire 175-325ms (Tac-Sprint = penalti atas).
- Flinch: kena tembak = aim punch + sway (Heavy Stock -60%, bukan laser).
- Loot cepat (PUBG): `F` = ambil instant, `Tab` = atur; corpse 300s (§6.1) + dog-tag = recall wave berikutnya di pos radio, bukan spawn instant (§7).

### 2.7 Lapisan kapal EVE (FINAL — tanpa duplikat `combat.ts`/`collision.ts`)
- Lock = cost: frigate lock battleship 2s, battleship lock frigate 10-20s (signature vs scan res). Tanpa lock = tidak bisa inspect/focus penuh.
- Tracking: orbit rapat cepat = miss dua arah (angular vs tracking turret). Kapal besar tidak auto-hit kecil.
- Capacitor: scan/warp/repair kuras cap; kering = mati diam. Paksa prioritas modul.
- Warp = align 75% + bisa di-tackle/bubble (`gate.ts` handoff 2-fase). Bukan teleport.
- Hancur = 50% cargo drop jadi wreck publik + killmail, sisanya musnah permanen (putar ekonomi, bukan full lootback). Angka `DAMAGE_CEILING=12` di `combat.ts` TETAP (ini lapisannya, bukan gantinya).

---

## 5. STEALTH SYSTEM

### 5.1 Detection Meter
- Stealth = bar di bawah HUD (tersembunyi jika tidak aktif).
- Nilai: 0 (tidak terdeteksi) → 100 (terdeteksi penuh).
- Naik: bergerak cepat, menembak, mendekati NPC/penjaga, suara.
- Turun: diam, bersembunyi, jauh dari target.

### 5.2 Noise System
| Aksi | Noise Level | Deteksi Radius |
|------|-------------|----------------|
| Jalan pelan | 10 | 5m |
| Jalan normal | 30 | 15m |
| Berlari | 60 | 30m |
| Tembakan | 100 | 50m |
| Door breach | 80 | 40m |
| Grenade | 100 | 60m |

### 5.3 Hiding Spots
- Container, Lemari, Dapur, Kolong meja — tempat bersembunyi.
- Saat bersembunyi: detection meter tidak naik.
- NPC/penjaga punya search pattern (rute seeded).
- Jika detection = 100: NPC mencari selama 30 detik → reset jika tidak menemukan.

### 5.4 NPC Detection
- NPC punya vision cone (120 derajat, jarak 20m).
- Malam: vision cone berkurang 50%.
- Hujan: vision cone berkurang 30%.
- NPC tidak menembak duluan (hanya jika diserang atau detection = 100).

### 5.5 UX di UE5
- Detection bar: holographic bar di pojok kanan atas.
- Warning indicator: "!" muncul di atas NPC saat detection naik.
- Sound: detak jantung makin cepat saat detection naik.
- Screen effect: vignette gelap saat bersembunyi.

---

## 6. ITEM DROP ON DEATH

### 6.1 Mekanik
- Player mati → item jatuh di tanah (corpus).
- **Drop rate**: 100% untuk senjata equip, 50% untuk item inventory, 0% untuk item locked.
- Item yang jatuh = item ASLI (bukan copy). Server pindahkan ownership ke "dropped".
- Corpses visible selama 300 detik (5 menit), lalu menghilang.

### 6.2 Item Recovery
- Setelah 30 hari tanpa diklaim:
  - 60% item dipilih ACAK → kembali ke pemilik asli (server kirim notif).
  - 40% item HILANG permanen (server hapus record).
- Item yang dikembalikan: kondisi 50% (durability turun, perlu repair).

### 6.3 Coordinate Ping (untuk Investigation)
- Saat item dicuri/dijatuhkan: server generate coordinate ping.
- Ping = koordinat lokasi item, aktif selama 3-5 jam.
- Ping hanya terlihat oleh:
  - Pemilik asli item (via phone/771).
  - Polisi pemain yang punya kasus terkait.
- Setelah 3-5 jam: ping hilang. Item tidak bisa dilacak via koordinat.
- Jika item dibuang ke laut/space: ping hilang segera.

### 6.4 UX di UE5
- Death screen: daftar item yang hilang (overlay merah).
- Recovery notif: pesan masuk di phone diegetik (771).
- Coordinate ping: blinking dot di tactical overlay (hanya untuk yang berwenang).

---

## 7. REVIVAL SYSTEM

### 7.1 Konsep
- Player mati = TIDAK bisa spawn ulang sendiri.
- Harus dihidupkan oleh TIM (player lain yang masih hidup).
- Atau: dibawa ke revival point (altar/medical bay di stasiun).

### 7.2 Team Revival
- Syarat: 1+ tim masih hidup dalam radius 50m.
- Aksi: tim mendekati corpus → hold E (3 detik) → revival.
- Animasi: tim memberikan injeksi/defibrillator (1.5 detik).
- Hasil: player hidup dengan 30% HP + semua item di corpus.
- Cooldown: 60 detik setelah revival (tidak bisa langsung mati→hidup berulang).

### 7.3 Revival Point
- Medical bay di stasiun/kota → player mati bisa pilih "Revive at station".
- Loading screen → spawn di medical bay dengan 50% HP.
- Item yang jatuh tetap di corpus (harus diambil manual atau diambil tim).
- Biaya: 100 OC (potong otomatis dari wallet).

### 7.4 Permanence
- Jika TIDAK ada tim + TIDAK ada revival point → player tetap "mati".
- Player harus logout → login ulang → spawn di last known revival point.
- Item yang jatuh tetap di corpus (bisa diambil orang lain).

### 7.5 UX di UE5
- Death screen: timer 30 detik sebelum "Revive at Station" muncul.
- Tim view: holographic outline di corpus (hanya terlihat tim sendiri).
- Revival animation: defibrillator effect (flash + sound).
- Post-revival: layar perlahan terang (fade in 1 detik).

---

## 8. POLICE INVESTIGATION

### 8.1 Laporan
- Player korban bisa buat laporan ke polisi (NPC atau player police).
- Laporan via phone 771: pilih "Report Crime" → pilih jenis kejahatan.
- Laporan tercatat di server dengan: timestamp, korban, jenis, koordinat terakhir.

### 8.2 Investigasi
- Polisi pemain menerima laporan → bisa mulai investigasi.
- Bukti yang bisa dikumpulkan:
  - **Manifest check**: cek inventory player mencurigakan.
  - **Coordinate ping**: lacak item curian (jika masih aktif).
  - **Witness statement**: NPC/player lain dalam radius 50m saat kejahatan.
  - **CCTV**: security camera di stasiun/kota (jika masih aktif, belum di-hack).

### 8.3 Evidence System
- Setiap bukti punya `evidenceId` + `strength` (0-100).
- 3 bukti dengan strength ≥ 50 = cukup untuk arrest warrant.
- Arrest warrant = polisi bisa menangkap target (wanted system 05-hukum-kota.md §2).

### 8.4 Forensic Item
- Item curian yang di-ping = koordinat → polisi bisa kejar.
- Jika item dijual ke bazaar: polisi bisa cek bazaar listing (publik).
- Jika item dipakai: tampil di HUD scan (polisi bisa scan player).

### 8.5 UX di UE5
- Laporan panel: UMG form (jenis kejahatan, deskripsi, koordinat).
- Investigasi tracker: daftar bukti + progress bar (holographic).
- Evidence popup: notif saat bukti ditemukan.
- Arrest animation: polisi mendekati target → handcuff (2 detik).

---

## 9. ARCLUX COMPANY STORE

### 9.1 Konsep
- ARCLUX = NPC store resmi (bukan player-owned).
- Lokasi: di dalam stasiun kota utama (Mars).
- Menjual item standar: senjata, komponen kapal, pakaian, peralatan.

### 9.2 Katalog
| Kategori | Item | Harga (OC) |
|----------|------|-----------|
| Senjata | Pistol standar | 500 |
| Senjata | Rifle standar | 1,500 |
| Senjata | Shotgun | 2,000 |
| Senjata | Sniper | 5,000 |
| Senjata | Grenade (x5) | 300 |
| Komponen | Engine tier-1 | 3,000 |
| Komponen | Shield tier-1 | 2,500 |
| Komponen | Weapon tier-1 | 2,000 |
| Pakaian | Armor basic | 1,000 |
| Pakaian | Armor advanced | 5,000 |
| Peralatan | Computer (hack tool) | 2,000 |
| Peralatan | Repair kit | 500 |
| Peralatan | Medkit | 300 |

### 9.3 Item Properties
- Setiap item dari ARCLUX punya:
  - `itemId` (unique, permanen)
  - `origin: "arclux"`
  - `durability: 100` (baru)
  - `owner: playerId` (saat dibeli)
- Item bisa dijual ke player lain, dicuri, atau dihancurkan.

### 9.4 Restock
- ARCLUX store restock setiap 24 jam (server time).
- Item terjual habis = tidak tersedia sampai restock.
- Tidak ada item limited edition (semua item tersedia permanen).

### 9.5 UX di UE5
- Store interface: UMG panel dengan 4 tab (Senjata/Komponen/Pakaian/Peralatan).
- Item preview: rotasi 3D item sebelum beli (holographic display).
- Purchase animation: item muncul dari conveyor → masuk inventory.
- Sound: ka-ching saat beli, error buzzer jika OC kurang.

---

## 9.5 Performa / proforma global (anti patah — optimal = indah)
- Server tick 10 Hz, snapshot → UE interpolasi (bukan prediksi). Visual deterministik, NOL `Date.now` baru.
- Budget per frame HIGH: HUD ≤0.5 ms, VFX pool ≤0.8 ms, gangguan reaktif ≤0.1 ms (lihat 04-graphics §6). Idle = HUD ~0 ms.
- FPP/TPP: FPP = cost penuh (kokpit), TPP = cost murah (orbit). Quality mengikuti kamera (04-graphics §2.3).

## 10. KONTRAK SERVER (mirror ke C++)

### 10.1 Tipe Data
```
// Server TS → UE5 C++ (mirror, field 1:1)
struct FAcluxItem {
  FGuid ItemId;           // unique ID
  FString Name;           // nama item
  FString Origin;         // "arclux" | "player"
  int32 Durability;       // 0-100
  int32 OwnerId;          // player ID
  FString Category;       // "weapon" | "component" | "armor" | "tool"
  int32 Price;            // OC price (0 = not for sale)
  int64 CreatedAt;        // tick
  int64 LastActiveTick;   // untuk decay
};

struct FAcluxWallet {
  int32 PlayerId;
  int64 Balance;          // OC amount
  int64 LastTransaction;  // tick
};

struct FAcluxSkill {
  int32 PlayerId;
  FString Mode;           // "ship" | "fps"
  FString SkillId;        // "aim" | "melee" | "hack" | etc
  int32 Level;            // 1-100
  int64 QueueEndTick;     // kapan skill selesai
};

struct FAcluxCrime {
  int32 CrimeId;
  int32 VictimId;
  int32 SuspectId;        // 0 = unknown
  FString Type;           // "theft" | "murder" | "hack" | "assault"
  int64 Timestamp;
  float CoordsX, CoordsY, CoordsZ;
  int32 WantedLevel;      // 0-5
  bool WarrantIssued;
};

struct FAcluxEvidence {
  int32 EvidenceId;
  int32 CrimeId;
  FString Type;           // "manifest" | "ping" | "witness" | "cctv"
  int32 Strength;         // 0-100
  int64 ExpiresAt;        // tick (untuk ping 3-5 jam)
};
```

### 10.2 Intent Baru (server-side, JSON key SAMA)
```
// FPS mode
"fps_switch_mode"    → { mode: "ship" | "fps" }
"use_skill"          → { skillId, target? }
"hack_start"         → { targetId, targetType }
"hack_input"         → { keyIndex }
"hack_cancel"        → {}
"loot_item"          → { corpseId, itemId }
"door_breach"        → { doorId }
"throw_grenade"      → { x, y, z, arc }

// Economy
"buy_arclux"         → { itemId, category }
"sell_player"        → { itemId, toPlayerId, price }
"trade_confirm"      → { tradeId }
"report_crime"       → { type, description, coords }

// Investigation
"evidence_scan"      → { targetId }
"evidence_collect"   → { crimeId, type }
"arrest_player"      → { targetId, warrantId }

// Revival
"revive_player"      → { corpseId }
"revive_station"     → {}
```

### 10.3 Acceptance Criteria
- [ ] OC wallet显示正确，transaksi P2P +5% tax
- [ ] Skill dual: ship→FPS transisi otomatis, cooldown terpisah, kamera V FPP/TPP
- [ ] HUD kontekstual: Idle kosong, Scan on-demand, Combat full (bukan selalu ON)
- [ ] Inventori 4 senjata: hotkey 1–4 + wheel Q, weight penalty, anti card web
- [ ] Hack: animasi laptop + mini-game + success/fail
- [ ] FPS combat: aim (ADS/Hip/recoil), melee, grenade, loot 0.5s, door breach noise
- [ ] Stealth: detection meter + noise system + hiding
- [ ] Death drop: item jatuh + corpus 5 menit
- [ ] Revival: tim revival 3 detik + station revival 100 OC
- [ ] Investigation: laporan → evidence → arrest warrant
- [ ] Item recovery: 30 hari → 60% return
- [ ] ARCLUX store: beli item + item ID unik
- [ ] Performa: 10 Hz interp NOL patah, HUD ≤0.5 ms, VFX pool ≤0.8 ms, p95 duel HIGH ≤16.6 ms

---

## 11. REFERENSI

- `05-hukum-kota.md` — wanted, polisi, prison, bounty, ekonomi Mars
- `02-asset-pipeline.md` — crafting queue, repair, lifecycle
- `07-special-capabilities.md` — kemampuan khusus (bukan skill)
- `04-graphics.md` — rendering spec, VFX, tier performa
- Blueprint 01–10 — semua sistem permainan
