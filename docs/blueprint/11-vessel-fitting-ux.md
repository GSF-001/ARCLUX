# 11 — VESSEL FITTING UX (ekstraksi pola Pyfa → model ARCLUX)

> Status: **DESIGN REFERENCE — pola boleh, kode tidak.**
> Tanggal: 2026-10-05. Induk: `05-vessel-design-dashboard.md`
> (Vessel Design Dashboard), `decisions-mmo.md` (K1, D-007),
> `MMO-CONTRACT.md` §4.2.
> Referensi: [github.com/pyfa-org/Pyfa](https://github.com/pyfa-org/Pyfa)
> — Python Fitting Assistant for EVE Online (1.8k★, 466 fork,
> 9.788 commit, aktif 2026-10-05).
> Ekosistem referensi EVE lain (Pathfinder, EveVision,
> Z-S Overview Pack): lihat §9.

---

## 0. Apa yang sebenarnya ditemukan di repo itu

**Pyfa** = tool fitting kapal EVE Online paling lengkap yang
ada: buat/eksperimen/simpan fitting kapal **di luar game**.
Stack: Python + wxPython (desktop), SQLite (`staticdata/`),
engine kalkulasi `eos/` (EVE Online Simulator), graph
`graphs/`, GUI `gui/`, service `service/`, test `tests/`.
Lisensi: **GPL-3.0**.

Kenapa ini "jackpot" untuk ARCLUX: ARCLUX ingin jadi
"EVE-grade" — dan Pyfa adalah **referensi de-facto** bagaimana
fitting tool harus bekerja (UX + engine calc). Seluruh pola
yang ARCLUX butuhkan untuk **Vessel Design Dashboard** (blueprint
05) sudah dipecahkan Pyfa selama 9.788 commit.

**Tapi**: Pyfa = GPL-3.0 + data CCP. ARCLUX = Apache-2.0 (engine
di npm) + MMO License. **Kode Pyfa DILARANG di-copy** (§4).
Yang diambil = **pola desainnya saja**, reimplementasi clean-room
di TS.

---

## 1. Arsitektur Pyfa (4 lapis — bersih, dipetakan ke ARCLUX)

```
staticdata/   SQLite dogma EVE (item, attribute, effect)
     ↓
eos/          ENGINE: calc.py · capSim.py · effects.py ·
              eqBase.py · gamedata.py · modifiedAttributeDict.py
              saveddata/: fit · ship · module · drone · fighter ·
              cargo · character · implant · implantSet · booster ·
              damagePattern · targetProfile · mode · mutator ·
              override · citadel · price
     ↓
service/      fit · attribute · damagePattern · market · price ·
              targetProfile · prereqsCheck · esi · settings
              port/: dna · eft · efs · esi · multibuy · muta ·
              xml · shipstats  (import/export format!)
     ↓
gui/          mainFrame · fittingView · shipBrowser ·
              marketBrowser · statsViews · itemStatsViews ·
              patternEditor · propertyEditor · setEditor ·
              characterEditor · attribute_gauge · pyfa_gauge ·
              multiSwitch · chrome_tabs · esiFittings
graphs/       calc · events · data · gui · style (proyeksi
              kapasitor/DPS seiring waktu)
```

---

## 2. Pola yang diekstrak (the jackpot)

1. **Slot model** — kapal punya slot terstruktur (high/mid/
   low/rig + drone bay + fighter + implant + booster). Setiap
   slot: tipe terbatas, constraint, satu module per slot.
2. **Stat projection real-time** — pasang/lepas module → semua
   stat dihitung ulang instan (`eos/effects.py` pipeline
   attribute modification, `modifiedAttributeDict.py`).
3. **Capacitor simulation** (`eos/capSim.py`) — simulasi
   konsumsi/regen kapasitor seiring waktu, bukan angka statis.
4. **Damage patterns** (`saveddata/damagePattern.py` +
   `gui/patternEditor.py`) — profil damage (EM/thermal/kinetic
   /explosive) → resistensi kapal dihitung terhadap profil.
5. **Target profiles** (`saveddata/targetProfile.py`) — lawan
   punya profil (ukuran, kecepatan) → akurasi/tracking dihitung.
6. **Fit browser + tabs** (`fitBrowserLite`, `multiSwitch`,
   `chrome_tabs`) — banyak fitting dibandingkan berdampingan.
7. **Gauges** (`attribute_gauge`, `pyfa_gauge`) — stat
   divisualisasikan gauge, bukan tabel mentah.
8. **Fit code** (`service/port/`: EFT, DNA, MUTA, XML,
   multibuy) — fitting = string terkompresi yang bisa
   diekspor/diimpor/dibagikan.
9. **ESI integration** (`gui/esiFittings.py`) — export fitting
   langsung ke game (in-game).
10. **Mutator/override** (`saveddata/mutator.py`, `override.py`)
    — varian module (mutaplasmid) dengan stat berubah.
11. **Prereq check** (`service/prereqsCheck.py`) — skill
    requirement sebelum module bisa dipakai.
12. **Implant set / booster** — buff set (implantSet) +
    booster dengan side-effect (boosterSideEffect.py).
13. **Citadel** (`saveddata/citadel.py`) — struktur pemain
    sebagai entitas fitting tersendiri.

---

## 3. Mapping 1:1 Pyfa → ARCLUX

| Pyfa | ARCLUX | Keterangan |
|---|---|---|
| `ship.py` | `VesselModel` (`universe/types.ts:70`) | 1 repo = 1 vessel (D-007) |
| `module.py` + slot | `ComponentBinding` + subsystem slot (`engine/reactor/navigation/defense/weapons/ai`) | slot constraint = aturan validator baru |
| `eos/effects.py` pipeline | `deriveBaseStats`/`mergeManifest` (`universe/stats.ts`) — **extension**: component-effect calc | deterministic, server-authoritative |
| `capSim.py` | `capability.ts` + `component.ts` (`gameserver`) | V4: 3× capital, depletion, cooldown — ARCLUX sudah punya, Pyfa = referensi sim-nya |
| `damagePattern.py` | `combat.ts` per-subsystem damage | profil damage incoming → resistensi subsystem |
| `targetProfile.py` | `intel.ts` | intel-kordinat (D-021) |
| `mutator.py`/`override.py` | `schema.ts` `capOverride` (K1-C: cap `baseStat+10`) | anti-abuse — override tetap dibatasi |
| `implantSet.py` | fleet/community buffs (M4) | milestone lanjutan |
| `booster.py` | station facility buffs (`02-station-infrastructure.md`) | |
| `citadel.py` | `StationEntity` (`gameserver/types.ts:72`) | safe-zone radius |
| `drone.py`/`fighter.py` | spawnable entities (`CharacterEntity`) | |
| fit code (EFT/DNA/MUTA) | `.arclux/vessel/*.arclux` DSL (`packages/dsl`) | **sudah ada** — ARCLUX pakai DSL sendiri |
| `service/port/` | export/import vessel definition | format fit ARCLUX (JSON/DSL) |
| `esiFittings.py` | `connect.ts` + `gate.ts` handoff | |
| `prereqsCheck.py` | `validator.ts` rules | component prerequisite |
| `graphs/` | chart proyeksi (kapasitor, DPS) di dashboard | |
| `attribute_gauge`/`pyfa_gauge` | gauge widget HUD (`cockpit.ts` registry) | |
| `fittingView.py` | **Vessel Design Dashboard** (`05-vessel-design-dashboard.md`) | inti UX |
| `shipBrowser`/`marketBrowser` | component discovery / Extension Registry (M4) | |

---

## 4. Yang DILARANG (non-negotiable)

1. **DILARANG copy kode Pyfa** — GPL-3.0. Turunan Pyfa wajib
   GPL-3.0 → menginfeksi engine ARCLUX (Apache-2.0, live di
   npm) dan game (MMO License). **Clean-room reimplementasi
   saja**: baca polanya, tulis kode sendiri di TS.
2. **DILARANG ship data EVE** — seluruh `staticdata/` Pyfa =
   dogma CCP (item name, attribute, effect). ARCLUX tidak
   boleh pakai data EVE; stat kapal ARCLUX **di-derive dari
   analisis repo user** (`analyzeRepository` →
   `buildVesselModel`), bukan dari dogma.
3. **DILARANG pakai aset Pyfa** (imgs/, logo) — bagian dari
   repo GPL + CCP copyright notice.
4. Pola desain (UX, arsitektur, algoritma concept) = **boleh**,
   itu tujuan dokumen ini.

---

## 5. Rencana eksekusi

### Fase 1 — Engine calc (`packages/universe`, TS)
- [ ] `fitCalc.ts` — component-effect pipeline: pasang/lepas
      `ComponentBinding` → hitung ulang `SystemState.health`
      + `VesselModel` stats (deterministic, pure function).
- [ ] `capSim.ts` — simulasi kapasitor per tick (konsumsi vs
      regen, depletion warning) — referensi `capSim.py`,
      implementasi sendiri.
- [ ] Slot constraint engine — tiap subsystem punya slot
      capacity; validator menolak overflow.
- [ ] Damage profile — incoming damage type → resistensi
      subsystem (referensi `damagePattern.py`).
- [ ] Regresi test: same input → same output (determinism law).

### Fase 2 — Vessel Design Dashboard (`apps/web`, blueprint 05)
- [ ] Slot grid UI (6 subsystem + component slots).
- [ ] Stat projection real-time (Fase 1 dipanggil per perubahan).
- [ ] Cap gauge + gauge widget (referensi `pyfa_gauge`).
- [ ] Fit browser + diff (bandingkan 2 vessel — pakai
      `packages/semantic-diff`).
- [ ] Export/import vessel definition (DSL `.arclux`).
- [ ] Prereq check UI (component requirement).

### Fase 3 — Wire ke gameserver
- [ ] Validator: slot constraint + component prerequisite
      (`validator.ts` rules baru).
- [ ] `capSim` server-side (authoritative — client hanya render
      proyeksi).
- [ ] Damage profile masuk `combat.ts`.

### Fase 4 — UE5 slice (eksekusi kode di UE5 dengan referensi ini)
- [ ] UMG Fitting Window: slot grid + stat projection + cap
      gauge (kontrak UI baru, mirror `UE5Types.h`:
      `FUE5Component`, `FUE5Fit`, `FUE5CapState`).
- [ ] Import/export fit code (DSL) via `UUE5Transport`.
- [ ] **Server tetap TS authoritative** — UE5 hanya render +
      kirim intent (D-008). Tidak ada calc di UE5.
- [ ] Acceptance: screenshot parity dashboard TS vs UE5
      (banded, per `04-graphics.md`).

---

## 6. Acceptance criteria

1. `fitCalc` deterministic: 2× run, hash identik (test CI).
2. Dashboard: pasang/lepas component → stat update <16ms
      (60fps interaction).
3. Validator menolak slot overflow + prerequisite tidak terpenuhi.
4. Export DSL → `arclux connect` → vessel termuat di region
      (e2e).
5. (Fase 4) Screenshot parity TS vs UE5 per tier.

## 7. Checklist verifikasi PR

```
[ ] npx tsc --noEmit — bersih (universe + gameserver + apps)
[ ] Regresi test determinism fitCalc — PASS
[ ] Tidak ada kode/data Pyfa yang di-copy (GPL audit)
[ ] Tidak ada string/data EVE di kode (CCP audit)
[ ] MMO-IMPLEMENTATION.md §2 + §3 di-update
[ ] decisions-mmo.md entry baru (keputusan desain)
[ ] docs/ di-add pakai git add -f
```

## 8. Referensi

- Pyfa: https://github.com/pyfa-org/Pyfa (GPL-3.0)
- `eos/capSim.py`, `eos/effects.py`, `eos/saveddata/fit.py`,
  `service/port/eft.py`, `gui/builtinViews/fittingView.py`
- Blueprint ARCLUX: `05-vessel-design-dashboard.md`,
  `07-special-capabilities.md` (V4), `06-community-social-ownership.md`
- ARCLUX: `packages/universe/stats.ts`, `packages/gameserver/capability.ts`

---

## 9. Referensi ekosistem EVE (tambahan — pola saja)

Subjek dokumen ini tetap **Pyfa** (fitting). Tiga repo
lain = referensi silang untuk lapisan ARCLUX lain:

| Repo | Apa adanya | Dipakai untuk ARCLUX | Lisensi |
|---|---|---|---|
| [exodus4d/pathfinder](https://github.com/exodus4d/pathfinder) | tool map + intel + koordinasi player EVE (Python: map engine, pathfinding, intel tracking) | rujukan **map engine + intel layer** — **kandidat blueprint terpisah** (belum ada): node/link graph → `packages/graph`, intel koordinasi → `intel.ts` (D-021) | GPL-3.0 (pola saja) |
| [evevision/evevision](https://github.com/evevision/evevision) | overlay UI di dalam client EVE: Electron (split `app/main` + `app/renderer` + `app/shared`) + C++ DLL inject (minhook, DirectX) + native node module + **FlatBuffers** (DLL↔Node) | (a) **FlatBuffers = kandidat format bridge UE5(C++)↔gameserver(TS)** — schema-first, version-tolerant, zero-copy (bandingkan vs JSON/Protobuf sebelum putuskan); (b) disiplin proses Electron: split main/renderer/shared + IPC contract + `electron-store` + Sentry; (c) doktrin fair-play CCP ("overlay tanpa keuntungan tidak adil = boleh") — selaras combat design 6.B | GPL-3.0 (pola saja) |
| [Arziel1992/Z-S-Overview-Pack](https://github.com/Arziel1992/Z-S-Overview-Pack) | preset konfigurasi Overview EVE (YAML: `columnOrder`/`backgroundOrder`/`backgroundStates`); 6-tab layout (Full/Compact, swappable), preset modular per aktivitas (PvX/D-Scan/Friendly/Targets), color-coded per kategori | pola **information architecture tactical overview** → wire `apps/game/src/renderer/tacticalWindows.ts` (**sudah dibangun, belum wired** — `09-client-polish.md`); konsep "overview preset" (`.arclux/overview/`, modular + swappable); color-coding sudah ada di `intel.ts` (`classifyEntity` green/yellow/red) | GPL-3.0 (pola saja) |

Aturan (non-negotiable):

1. **DILARANG copy kode/data** keempat repo — GPL-3.0
   menginfeksi lisensi ARCLUX, dan isi datanya = dogma
   CCP (typeID EVE, nama kapal, faction). Clean-room
   reimplementasi saja.
2. **DILARANG pakai teknik injection EveVision** (minhook,
   DX hook, DLL inject) — ARCLUX **adalah gamenya sendiri**
   (`apps/game` Electron + `apps/ue5` render sendiri),
   bukan overlay di game orang lain.
3. **Plugin system EveVision = vaporware** — README
   menjanjikannya sejak 2020, tidak ada di kode. Jangan
   dijadikan acuan; ARCLUX sudah punya registry-driven
   DSL (`packages/dsl`) sebagai basis plugin masa depan.
4. Pathfinder & Z-S **bukan subjek blueprint 11** —
   hanya referensi silang; fitting (subjek dokumen ini)
   tetap mengacu ke Pyfa.
