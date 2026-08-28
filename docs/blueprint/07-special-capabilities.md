# 🧬⚔️ ARCLUX — Special Capabilities & Player-Defined Technology (V4)

> Capability khusus BUKAN skill biasa bersel cooldown. Ia adalah **aset teknologi
> persisten** yang tertanam di kapal & komponen — langka, dibuat pemain, punya
> batas penggunaan, ownership, provenance, dan konsekuensi.

Bagian dari blueprint ARCLUX (Repository War Universe). Extension V4.

> **Kerangka: ARCLUX menentukan batas & aturan. Pemain/komunitas menentukan
> implementasi. Sistem mempertahankan kepemilikan, kerusakan, kehancuran,
> pemulihan, provenance, dan konsekuensi historis teknologi tsb.**

---
## 1. Yang Sudah Ada (cross-reference)

Bagian ini TIDAK mengulang — ia memperkuat & menyambung yang sudah ada:

| Topik | Sudah di |
|---|---|
| World Validator / anti-cheat / replay (I.1–I.8) | [03-combat.md](03-combat.md) |
| Component authorization / license 3-tier | `packages/universe/license.ts` + [03-combat.md](03-combat.md) I.6 |
| Wreckage, recovery, provenance sebagai aset | [04-wreckage-history.md](04-wreckage-history.md) |
| Ownership transfer / owner loss / provenance survive | [04-wreckage-history.md](04-wreckage-history.md) |
| Asset classification (access ≠ ownership) | [06-community-social-ownership.md](06-community-social-ownership.md) §12 |
| Community access / governance / multi-sig / recovery | [06-community-social-ownership.md](06-community-social-ownership.md) §13-15 |
| Repository = 1 vessel (sumber config) | [05-vessel-design-dashboard.md](05-vessel-design-dashboard.md) + `packages/universe` |
| Persistence / restart ≠ reset | [08-persistent-world.md](08-persistent-world.md) |
| Capability di HUD universal (player-defined module) | [01-spatial-ux.md](01-spatial-ux.md) §20 |

---

## 2. Prinsip Utama: Kemampuan ≠ Skill

Kemampuan khusus tidak berperilaku seperti skill game yang hanya punya cooldown.
Ia diperlakukan sebagai **kemampuan teknologi langka** yang tertanam pada kapal
beserta komponennya:

```
PEMAIN → REPOSITORY → KAPAL → KOMPONEN/KEMAMPUAN KHUSUS → AKTIVASI TERBATAS
  → KONSEKUENSI → KONDISI KAPAL/KOMPONEN → KERUSAKAN/KEHANCURAN/PEMULIHAN
  → PROVENANCE → PERPINDAHAN → PEMILIK/PENGUASA BARU → SEJARAH
```

Tujuannya: kemampuan khusus menjadi bagian dunia **persisten**, bukan tombol
yang bisa dipakai berulang tanpa konsekuensi.

---

## 3. Player Membangun, ARCLUX Memvalidasi

ARCLUX tidak perlu menentukan implementasi internal tiap kemampuan. Pemain
membuat kapal unik melalui repository/kode-nya.

Kategori yang diizinkan ruleset (contoh):
- sistem pertahanan
- sistem mobilitas
- sistem pengintaian / recon
- sistem engineering
- sistem komunikasi
- kemampuan taktis khusus
- kemampuan lain yang diizinkan world rules

```
PEMBUATAN PEMAIN → VALIDASI ARCLUX → LEGAL | TIDAK LEGAL
```

Kreativitas ekosistem tumbuh dari pemain; legalitas ditentukan aturan dunia.

---

## 4. Kemampuan sebagai Aset Kapal

Kemampuan direpresentasikan sebagai bagian **state teknis kapal**, bukan atribut
tersembunyi akun pemain.

```
KAPAL
├── Hull
├── Sistem
├── Komponen
├── Senjata
└── Kemampuan Khusus
```

Sistem harus bisa menentukan: kapal mana yang memilikinya, komponen mana yang
menyediakan, pemilik/operator kapal, jumlah penggunaan & sisa, kerusakan/
kehancuran komponen, status ditemukan/dipulihkan, riwayat kepemilikan & custody,
serta riwayat event terkait.

---

## 5. Batas Kapal Induk (2 per Community)

Tiap komunitas maksimal memiliki **2 KAPAL INDUK KHUSUS** — pembawa utama
kemampuan khusus komunitas. Batas ini ditegakkan oleh **world rules / validator**.

```
KOMUNITAS A
├── KAPAL INDUK #1 → Kemampuan Khusus
├── KAPAL INDUK #2 → Kemampuan Khusus
└── Kapal komunitas lainnya
```

Desain, arsitektur, dan proses pembangunan kapal tetap tanggung jawab pemain.

> Invariant: batas 2 kapal induk = **anti unlimited cloning** (§19) — membaca
> source code tidak melahirkan kapal aktif baru.

---

## 6. Kepemilikan Komunitas & Otorisasi

Kapal induk khusus dapat menjadi aset komunitas. Sistem membedakan:

```
PEMAIN ≠ OPERATOR KAPAL ≠ PEMILIK KAPAL ≠ PEMILIK KOMUNITAS
```

Komunitas memberi izin anggota mengoperasikan kapal induk **tanpa memindahkan
kepemilikan**. Terintegrasi dengan governance & access V3 (06 §13-15).

---

## 7. Jumlah Penggunaan Terbatas (3 Aktivasi)

Kemampuan khusus memiliki batas penggunaan maksimum: **3 AKTIVASI**.

```
Awal:       Penggunaan 0/3
Aktivasi 1: Penggunaan 1/3
Aktivasi 2: Penggunaan 2/3
Aktivasi 3: Penggunaan 3/3 → KEMAMPUAN TERKURAS / DEPLETED
```

Setelah batas tercapai, kemampuan tidak lagi tersedia untuk penggunaan normal.
Status historis tetap dipertahankan — dunia tetap tahu kapal itu pernah memiliki
kemampuan tsb.

---

## 8. Cooldown Bukan Satu-Satunya Konsekuensi

Kelangkaan tidak cukup hanya dari cooldown panjang. Kombinasi konsekuensi:

- batas jumlah aktivasi
- cooldown sangat panjang
- degradasi komponen / sistem
- konsumsi resource
- kebutuhan repair / recovery
- konsekuensi deterministik lain

```
AKTIVASI → COOLDOWN PANJANG → KONSEKUENSI SISTEM → REPAIR/RECOVERY → AKTIVASI BERIKUTNYA
```

Pemain mempertimbangkan kapan kemampuan dipakai (strategic decision, §11).

---

## 9. Kondisi Terminal (Explisit, Bukan Tersembunyi)

Jika ruleset menentukan kemampuan sangat terikat dengan kapal, aktivasi terakhir
dapat membuat kapal masuk kondisi terminal / non-operasional:

```
KAPAL INDUK → KEMAMPUAN → AKTIVASI #3 → KONSEKUENSI TERMINAL → KAPAL TERKURAS/NON-OPERASIONAL
```

Konsekuensi terminal **didefinisikan eksplisit oleh ruleset kemampuan** — ARCLUX
tidak menciptakan konsekuensi tersembunyi.

---

## 10. Kemampuan Berbasis Komponen

Bila memungkinkan, representasikan kemampuan lewat **komponen eksplisit**:

```
KAPAL
└── KOMPONEN KHUSUS X
    └── KEMAMPUAN Y
```

Ini memungkinkan kemampuan berinteraksi dengan sistem damage, destruction,
wreckage, recovery, ownership, provenance, dan integrasi ke kapal lain.
Teknologi dapat bertahan dari kehancuran kapal **bila komponen masih dipulihkan**
(04).

---

## 11. Kehancuran ≠ Penghapusan

Ketika kapal hancur, komponen dapat masuk kondisi dapat dipulihkan bila ruleset
mengizinkan:

```
KAPAL INDUK → PERTEMPURAN → KAPAL HANCUR → WRECKAGE → KOMPONEN KHUSUS → DAPAT DIPULIHKAN
```

Kemampuan menjadi bagian sejarah medan perang (04).

---

## 12. Recovery Teknologi Khusus

Pemain/komunitas lain dapat menemukan & memulihkan komponen khusus dari wreckage
bila ruleset mengizinkan. Recovery dicatat sebagai **world event** — komponen
yang ditemukan bukan item anonim tanpa sejarah.

---

## 13. Provenance Dipertahankan

Komponen khusus yang ditemukan tetap membawa sejarah teknisnya (pakai
`packages/provenance`):

```
KOMPONEN X
Kapal Asal:       Capital Vessel A
Komunitas Asal:   Community A
Pertempuran:      War #27
Peristiwa Hilang: Event #1842
Dipulihkan Oleh:  Community B
Peristiwa Recovery: Event #1911
Custodian Saat Ini: Community B
```

Teknologi memiliki identitas historis.

---

## 14. Perpindahan Kepemilikan / Custody

Recovery terhubung ke sistem ownership + provenance. Sistem membedakan pemilik
awal, pemilik saat ini, custodian, penemu, perekayasa recovery. Recovery **tidak
otomatis mengubah ownership** bila aturan tak mengizinkan. Setiap perubahan
menjadi world event yang sah:

```
HILANG → DIPULIHKAN → EVALUASI OWNERSHIP/CUSTODY → TRANSISI VALID → PEMEGANG BARU
```

---

## 15. Integrasi ke Kapal Lain + Lineage

Komponen pulih dapat diintegrasi ke kapal lain bila ruleset mengizinkan. Riwayat
sebelumnya tetap dipertahankan (tidak dihapus). Garis keturunan menembus banyak
kapal:

```
KAPAL ALPHA → KOMPONEN X → HANCUR → DIPULIHKAN → KAPAL BETA → KOMPONEN X
  → HANCUR → DIPULIHKAN → KAPAL GAMMA
```

Identitas & provenance berlanjut selama aturan mengizinkan (04 §4.3).

---

## 16. Teknologi sebagai Aset Komunitas (V3 sinkron)

Karena hanya 2 kapal induk, teknologi jadi aset strategis. Komunitas menentukan
siapa boleh operate/akses komponen/aktifkan/repair/recover/modifikasi, siapa
punya emergency authorization, bagaimana succession & revoke access — terintegrasi
dengan V3 (06 §13-17).

---

## 17. Otorisasi Sebelum Aktivasi

Kemampuan tidak harus dipakai siapa pun yang mengendalikan kapal. Validator
memeriksa:

```
PEMAIN → AKSES KAPAL → OTORISASI OPERASI → OTORISASI KEMAMPUAN → COOLDOWN
  → JUMLAH PENGGUNAAN → KONDISI KOMPONEN → VALIDASI WORLD RULES → ACCEPT | REJECT
```

Menjaga perbedaan ownership vs operational authorization (06 §12).

---

## 18. No Moral System Global

ARCLUX tidak menilai baik/buruk penggunaan kemampuan. Ia menetapkan
**legal / ilegal** oleh rules. Komunitas menetapkan trust/policy/authorization/
consequence. Pemain menetapkan action/timing/strategy.

---

## 19. Kelangkaan Strategis & Anti Clone

- Batas 2 kapal induk + batas penggunaan → kelangkaan strategis: komunitas
  memutuskan pakai sekarang atau simpan untuk konflik penting; keputusan strategis
  lahir tanpa cerita scripted.
- **Anti unlimited clone**: source code yang terbaca **≠** kapal aktif baru.
  Batas dunia tetap ditegakkan.

```
KOMUNITAS A: Kapal Induk #1 (2/3) · Kapal Induk #2 (0/3)
```

---

## 20. Repository ≠ Kapal Aktif

Keberadaan source code tidak otomatis menciptakan kapal aktif baru.

```
SOURCE CODE ≠ WORLD ENTITY AKTIF
```

Repository menjelaskan cara membuat kapal; ARCLUX menentukan apakah instance
valid, aktif, dimiliki, dapat dipulihkan, atau hancur.

---

## 21. Tanggung Jawab Validator

Validator (03) menegakkan aturan deterministik kemampuan khusus. Pemeriksaan:

1. identitas pemain
2. ownership / access kapal
3. kondisi operasional kapal
4. keberadaan kemampuan
5. otorisasi kemampuan
6. jumlah penggunaan
7. cooldown
8. keberadaan komponen
9. kondisi komponen
10. aturan dunia
11. tick / state version valid

Hasil: `ACCEPT` / `REJECT`.

---

## 22. Replay & Event Log

Aktivasi kemampuan = event (masuk replay & history, sinkron 03 I.8):

```
tick: 18492
intent: activate_special_capability
actor: player_x
vessel: capital_vessel_a
capability: component_x
result: accepted
activation_count: 2 → 3
state_transition: active → depleted
```

---

## 23. Anti-Ambigu (Client ≠ Sumber Kebenaran)

Sistem tidak mempercayai klaim client ("saya masih punya komponen ini", "saya
baru pakai sekali", "saya yang pertama menemukan"). World state + event/
provenance records adalah sumber kebenaran. Client hanya merender (03, 08).

---

## 24. Batas Desain

**ARCLUX**: world rules, validation, ownership, provenance, events, recovery,
persistence.
**Pemain**: code, desain kapal, implementasi komponen, strategi, politik komunitas.
**Komunitas**: trust, authorization, governance, taktik.
**Dunia**: consequences, history, technical lineage, social stories.

---

## 25. Loop & Prinsip Sentral

```
PEMAIN → REPOSITORY → KAPAL → KOMPONEN KHUSUS → KEMAMPUAN → ASET KOMUNITAS
  → OTORISASI → AKTIVASI TERBATAS → KONSEKUENSI → PERTEMPURAN
  → DAMAGE/DESTRUCTION → WRECKAGE → RECOVERY → PROVENANCE
  → OWNERSHIP/CUSTODY → KAPAL BARU → KOMUNITAS BARU → SEJARAH BARU
```

> Kemampuan khusus bukan sekadar skill. Ia aset teknologi persisten dengan
> batas penggunaan, ownership, provenance, dan konsekuensi.
>
> ARCLUX menyediakan aturan. Pemain menciptakan teknologi. Komunitas menentukan
> pengelolaan. Pertempuran menentukan yang bertahan. Recovery menentukan yang
> kembali. Provenance menentukan asal. History menentukan yang diingat dunia.

KODE MEMBUAT KAPAL. KAPAL MEMILIKI KEMAMPUAN. KEMAMPUAN MENCIPTAKAN NILAI
STRATEGIS. PENGGUNAAN MENCIPTAKAN KONSEKUENSI. PERTEMPURAN MENCIPTAKAN
KEHILANGAN. KEHILANGAN MENCIPTAKAN WRECKAGE. RECOVERY MENCIPTAKAN PERPINDAHAN.
PROVENANCE MENJAGA MASA LALU. SEJARAH MENGHUBUNGKAN KAPAL-KAPAL.

---

## 26. Catatan Implementasi (gameserver)

Sinkron dengan `packages/gameserver` (hasil PR #582/#584):

- **Validator chain** (§17, §21) → perpanjang `packages/gameserver/validator.ts`
  (reuse pola `validateIntent` yang sudah ada: identity/owner/range/cooldown/
  license) + state `uses_remaining` & `component_condition`.
- **State depletion** (§7-9) → `simulation.ts` (pola cooldown/usage yang sudah ada).
- **Event log** (§22) → `simulation.ts` replay (`computeEntityHash` / event).
- **Provenance lineage** (§13-15) → `packages/provenance`.
- **Persistence** (§10-12 recovery survive restart) → `packages/gameserver/persistence.ts`.
- Batas 2 kapal induk (§5) → invarian WorldRegion untuk asset komunitas tertentu.

Catatan roadmap ini hidup di `docs/blueprint/progres/MMO-IMPLEMENTATION.md`.
