# 🌍💾 ARCLUX — Persistent World (Tanpa Reset Naratif)

> **A server restart should not have to mean a world reset.**

Bagian dari blueprint ARCLUX (Repository War Universe). Extension V6 —
Persistent World.

> **Aturan inti:**
> - **SERVER RESTART ≠ WORLD RESET** — state dunia yang tervalidasi dipulihkan
>   setelah maintenance/restart/crash/recovery.
> - **NO PLAYER-INITIATED WORLD PAUSE** — pemain tidak bisa menghentikan dunia.
> - **Respawn / logout-location policy = keputusan ruleset terpisah** (belum
>   diputuskan di sini; dibawa ke `docs/blueprint/progres/decisions-mmo.md`).

---
## 1. Yang Sudah Ada (cross-reference)

| Topik | Sudah di |
|---|---|
| Persistence region (save/load `RegionSnapshot`, recovery) | `packages/gameserver/persistence.ts` + `world.ts` (`snapshot`/`regionFromState`) |
| Provenance / history vessel/component | `packages/provenance` + [04-wreckage-history.md](04-wreckage-history.md) |
| Replay / event log (server authoritative) | [03-combat.md](03-combat.md) I.8 |
| World Validator / client ≠ source of truth | [03-combat.md](03-combat.md) I.4/I.7 |
| Persistence via `packages/db` + RecoveryManager | [arsitektur.md](progres/arsitektur.md) |

---

## 2. Persistent World State

World state diperlakukan sebagai data persisten:

```
WORLD
├── Regions
├── Communities
├── Stations
├── Vessels
├── Components
├── Wreckage
├── Ownership
├── Provenance
└── Events
```

Saat server aktif kembali:

```
PERSISTED WORLD STATE → RECOVERY → VALIDATION → WORLD RESTORED → SIMULATION CONTINUES
```

Restart teknis tidak boleh menghapus keadaan dunia.

---

## 3. No Auto History Reset

Pergantian versi, maintenance, atau restart tidak otomatis menghapus: sejarah
perang, provenance, ownership history, component lineage, community history,
vessel history, recovery/governance/destruction/diplomatic events.

Data historis hanya berubah melalui **mekanisme dunia yang sah**.

---

## 4. Perang sebagai Event Persisten

Pertempuran bukan match terpisah yang di-reset:

```
WAR DECLARED → ENGAGEMENT → DAMAGE → RETREAT → RECOVERY → SECOND ENGAGEMENT
  → VESSEL LOSS → AFTERMATH
```

Setiap event jadi bagian persistent world history. Konflik berkembang dari
tindakan pemain, bukan diatur-paksa.

---

## 5. No Match Reset

Hasil pertempuran tidak dikembalikan ke kondisi awal setelah engagement/server
restart:

```
VESSEL A HP 100% → BATTLE → 63% → SERVER RESTART → WORLD RECOVERY → 63%
```

State mengikuti hasil simulasi terakhir yang tervalidasi.

---

## 6. Ship Veteran & Service History

Satu kapal bisa bertahan melewati banyak konflik:

```
VESSEL ALPHA
├── Created — Year 1
├── Battle #03 → Damaged
├── Repaired
├── Battle #11 → Component replaced
├── Battle #24 → Recovered
├── Ownership transferred
└── Active
```

Kapal punya service/battle history = identitas teknis, bukan hanya statistik.

---

## 7. Repair Tidak Menghapus Sejarah

`DAMAGED → REPAIR → OPERATIONAL`, namun event damage/repair tetap tersimpan.
Vessel veteran memiliki sejarah panjang yang dapat diverifikasi.

---

## 8. Kerusakan Punya Konsekuensi

`COMBAT → DAMAGE → SYSTEM DEGRADATION → REPAIR REQUIRED`. Repair dapat butuh:
komponen, resource, engineering capability, akses station, waktu, recovery op
(per ruleset).

---

## 9. No Retcon Tanpa Mekanisme Resmi

Event tersahkan tidak dianggap tak pernah terjadi karena: pemain menyesal,
komunitas kalah, kapal hancur, server restart, versi berubah. Koreksi/migration
jika ada = event yang dapat diaudit.

---

## 10. World History > Match History

History bukan hanya match result:

```
WORLD HISTORY
├── Battles · Vessel creation/destruction · Repairs
├── Recovery · Component transfers · Ownership changes
├── Governance · Community splits · Alliances
└── Technology lineage
```

Dunia memiliki kontinuitas.

---

## 11. Veteran Dihitung dari History

Label informal "veteran vessel" dihitung dari history (bukan scripted title):
`Battles survived · Major repairs · Recovery events · Ownership transfers · Age`.
Veteran ≠ otomatis lebih kuat; veteran berarti sejarah lebih panjang.

---

## 12. Persistence sebagai Sumber Kebenaran

```
PLAYER INTENT → WORLD VALIDATOR → SIMULATION → WORLD STATE → EVENT LOG → PERSISTENCE
```

Client tidak menentukan: serangan berhasil, kapal rusak, pemilik, komponen
ditemukan, recovery valid, kemampuan tersedia, event terjadi. Client hanya
menampilkan state tervalidasi.

---

## 13. Recovery Setelah Server Restart

```
PERSISTED REGION STATE → LOAD → RECONSTRUCT WORLD REGION → VALIDATE STATE → RESUME SIMULATION
```

Entity tercatat sebelum restart dapat dipulihkan. (Reuse `regionFromState` /
`packages/gameserver/persistence.ts`.)

---

## 14. NO PLAYER-INITIATED WORLD PAUSE

> Keluar game ≠ keluar dari dunia.

Model yang TEPAT:
```
PLAYER LOGIN → WORLD STATE → PLAYER/KAPAL DI POSISI X → LOG OUT
  → WORLD TETAP BERJALAN → LOGIN LAGI → KEMBALI KE STATE TERAKHIR
```

Bukan "resume dari save terakhir", melainkan "lanjut dari keadaan dunia yang
benar-benar terjadi saat pergi". Jika sebelum logout kapal di station, state itu
yang dipulihkan; perubahan dunia yang sah selama offline tidak di-undo.

**Pengecualian teknis:** server tetap butuh maintenance/restart. Yang persisten
adalah **state dunianya**, bukan servernya harus hidup selamanya.

---

## 15. Respawn / Logout-Location Policy (KEPUTUSAN RULESET — OPEN)

Blueprint ini **tidak menetapkan** apakah pemain selalu respawn tepat di lokasi
logout, maupun ada/tidaknya mekanisme respawn/teleport. Ini adalah **keputusan
ruleset terpisah**; dicatat sebagai **D-number** di
`docs/blueprint/progres/decisions-mmo.md` dan belum diputuskan.

(Referensi navigasi jump/teleport tetap ada — lihat §14 Jump/Teleport System di
[01-spatial-ux.md](01-spatial-ux.md) — tapi kebijakan respawn pemain dirumuskan
terpisah.)

---

## 16. Persistent Consequence Loop

```
PLAYER ACTION → VALIDATION → SIMULATION → STATE CHANGE → DAMAGE/LOSS/RECOVERY
  → EVENT → PERSISTENCE → HISTORY → FUTURE WORLD STATE → NEW PLAYER ACTION
```

Dunia tidak kembali ke keadaan awal hanya karena engagement selesai.

---

## 17. Hubungan dengan V4 & V3

- **V4 (07)**: `SPECIAL CAPABILITY → ACTIVATION #1-3 → DEPLETED → VESSEL DAMAGED
  → REPAIR → VESSEL RETURNS`. Kemampuan terkuras tetap jadi sejarah kapal
  (provenance).
- **V3 (06)**: `MEMBER → TRUST → ACCESS → SPECIAL VESSEL → BETRAYAL → ACCESS
  REVOKED → GOVERNANCE → RECOVERY → HISTORY`.

Keputusan governance/teknologi menjadi bagian sejarah komunitas, bukan hanya
sesi.

---

## 18. Final Persistence Model

```
ARCLUX WORLD → PERSISTENT STATE
  (COMMUNITIES→GOVERNANCE→TRUST→ACCESS) (VESSELS→DAMAGE→REPAIR→DESTRUCTION)
  (TECHNOLOGY→COMPONENTS→RECOVERY→CUSTODY)
  → EVENTS → PROVENANCE → HISTORY → COMMUNITY MEMORY → FUTURE WORLD STATE
```

---

## 19. Prinsip Sentral

> Code creates the vessel. Vessel creates gameplay. Gameplay creates
> relationships. Relationships create trust. Trust creates access. Access
> creates responsibility. Actions create consequences. Consequences create
> damage, recovery, and governance. Recovery preserves technical lineage.
> Governance preserves social history. History influences the future world.
> Players create the events. ARCLUX preserves the consequences.
>
> **A server restart should not have to mean a world reset.**
