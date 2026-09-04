#!/usr/bin/env tsx
// scripts/mmo-bot-harness.ts — bot player headless buat validasi MMO.
//
// BUKAN dummy/skeleton di dalam game: 2 bot ini jalan di jalur client
// beneran (HTTP POST /intent + GET /snapshot, sama kayak net.ts
// HttpClientTransport). Server tidak bisa bedain bot vs manusia —
// intent yang sama, validator yang sama, simulation yang sama (D-008).
//
// Pakai: fondasi verifikasi Fase 8+ (2+ player di plaza, hangar 32 slot,
// bazaar trade 2 arah, jalan di corridor) + validasi kapan pun:
//   npx tsx scripts/mmo-bot-harness.ts
//   npx tsx scripts/mmo-bot-harness.ts --url http://127.0.0.1:24001
// Exit 0 = semua check PASS. Exit 1 = ada yang FAIL (lihat log).

import { createGameServer } from "../packages/gameserver/server";
import type { PlayerIntent, RegionSnapshot } from "../packages/gameserver/types";
import type { VesselModel } from "../packages/universe/types";

const args = process.argv.slice(2);
const urlFlag = args.find((a) => a.startsWith("--url="))?.split("=")[1] ?? null;

interface Check { name: string; ok: boolean; detail: string }
const checks: Check[] = [];
function check(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${name} — ${detail}`);
}

function botVessel(id: string, name: string, owner: string): VesselModel {
  const sys = (sid: string, label: string) => ({ id: sid, label, health: 100, baseStat: 50 });
  return {
    id, name,
    source: { org: "harness", repo: id, defaultBranch: "main", analyzedAt: new Date().toISOString() },
    license: "open",
    systems: [sys("engine", "Engine"), sys("defense", "Defense"), sys("weapons", "Weapons"), sys("reactor", "Reactor"), sys("navigation", "Navigation"), sys("hull", "Hull")] as unknown as VesselModel["systems"],
    components: [],
    integrity: 100, defense: 80, weapons: 80, engine: 80,
    derivation: { integrity: [], defense: [], weapons: [], engine: [] },
  };
}

async function postIntent(base: string, intent: PlayerIntent): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(`${base}/intent`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(intent),
  });
  return { ok: res.ok, status: res.status };
}

async function snapshot(base: string): Promise<RegionSnapshot> {
  const res = await fetch(`${base}/snapshot`);
  if (!res.ok) throw new Error(`snapshot HTTP ${res.status}`);
  return (await res.json()) as RegionSnapshot;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const dist = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number =>
  Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2);

async function main(): Promise<void> {
  let base = urlFlag;
  let stop: (() => Promise<void>) | null = null;
  let seq = 1;
  const intent = (playerId: string, entityId: string, type: string, payload: Record<string, unknown> = {}): PlayerIntent =>
    ({ playerId, entityId, type, payload, seq: seq++ });

  if (!base) {
    // Boot region sendiri (register:false — tidak mengotori directory).
    // Port eksplisit: handle tidak melaporkan port acak listen(0).
    const gs = createGameServer({ regionId: "harness-region", port: 24801, register: false });
    const started = await gs.start();
    base = started.url;
    stop = gs.stop;
    gs.spawnPlayerVessel({ playerId: "bot-alpha", vessel: botVessel("bot-alpha-vessel", "Harness Alpha", "bot-alpha") });
    gs.spawnPlayerVessel({ playerId: "bot-beta", vessel: botVessel("bot-beta-vessel", "Harness Beta", "bot-beta") });
    // Station 1800 m dari spawn default (4e9): dalam dock range (≤2000)
    // tapi di luar safe zone (>1000) — tempur tetap legal (validator.ts).
    gs.region.spawnStation({ id: "harness-hub", name: "Harness Hub", position: { x: 4e9 + 1800, y: 0, z: 0 }, safeZoneRadius: 1000 });
    console.log(`[harness] region live di ${base}`);
  } else {
    // Target server jalan (mis. serve --vessel): spawn via /deliver publik.
    console.log(`[harness] target server jalan: ${base}`);
    for (const [vid, pid, nm] of [["bot-alpha-vessel", "bot-alpha", "Harness Alpha"], ["bot-beta-vessel", "bot-beta", "Harness Beta"]]) {
      await fetch(`${base}/deliver`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ vesselId: vid, owner: pid, vessel: botVessel(vid, nm, pid) }),
      });
    }
  }

  console.log("[harness] 1. sim hidup (tick jalan)");
  const s0 = await snapshot(base);
  await sleep(600);
  const s1 = await snapshot(base);
  check("tick-advances", s1.tick > s0.tick, `tick ${s0.tick} → ${s1.tick}`);

  console.log("[harness] 2. dua bot kelihatan di snapshot yang sama (multipemain)");
  const ids = new Set(s1.entities.map((e) => e.id));
  check("both-bots-visible", ids.has("bot-alpha-vessel") && ids.has("bot-beta-vessel"), `${s1.entities.length} entities`);

  console.log("[harness] 3. intent move jalan (posisi berubah)");
  const a0 = s1.entities.find((e) => e.id === "bot-alpha-vessel")!;
  const dest = { x: a0.position.x + 5000, y: 100, z: -2000 };
  const mr = await postIntent(base, intent("bot-alpha", "bot-alpha-vessel", "move", dest));
  await sleep(1500);
  const s2 = await snapshot(base);
  const a1 = s2.entities.find((e) => e.id === "bot-alpha-vessel")!;
  check("move-accepted", mr.ok, `POST /intent → ${mr.status}`);
  check("move-changes-position", dist(a0.position, a1.position) > 1, `bergeser ${dist(a0.position, a1.position).toFixed(1)} m`);

  console.log("[harness] 4. intent scan jalan");
  const sr = await postIntent(base, intent("bot-beta", "bot-beta-vessel", "scan", { range: 1e10 }));
  check("scan-accepted", sr.ok, `POST /intent → ${sr.status}`);

  console.log("[harness] 5. combat authoritative (attack nurunin subsystem target)");
  const b0 = s2.entities.find((e) => e.id === "bot-beta-vessel")!;
  const sysHealth = (e: typeof b0): number =>
    e.kind === "vessel" ? (e.vessel.systems.find((s) => s.id === "weapons")?.health ?? -1) : -1;
  const hp0 = sysHealth(b0);
  // Dekatkan alpha ke beta (weapon range 5000 m, di luar safe zone), lalu
  // serang 5x via HTTP — payload WAJIB ada weapon (validator+combat, railgun
  // cooldown 4 tick ≈ 400 ms, spacing 700 ms biar tiap hit diterima).
  await postIntent(base, intent("bot-alpha", "bot-alpha-vessel", "move", { x: b0.position.x + 500, y: b0.position.y, z: b0.position.z }));
  await sleep(2500);
  for (let i = 0; i < 5; i++) {
    await postIntent(base, intent("bot-alpha", "bot-alpha-vessel", "attack", { targetId: "bot-beta-vessel", weapon: "weapon.railgun" }));
    await sleep(700);
  }
  await sleep(800);
  const s3 = await snapshot(base);
  const b1 = s3.entities.find((e) => e.id === "bot-beta-vessel")!;
  const hp1 = sysHealth(b1);
  check("attack-accepted", true, "5x attack terkirim");
  check("attack-damages-target", hp1 >= 0 && hp1 < hp0, `weapons health ${hp0} → ${hp1}`);

  console.log("[harness] 6. dock ke station (posisi = station, velocity 0)");
  const dr = await postIntent(base, intent("bot-beta", "bot-beta-vessel", "dock", { stationId: "harness-hub" }));
  await sleep(600);
  const s4 = await snapshot(base);
  const hub = s4.entities.find((e) => e.id === "harness-hub")!;
  const bd = s4.entities.find((e) => e.id === "bot-beta-vessel")!;
  const docked = dist(bd.position, hub.position) < 1 && bd.velocity.x === 0 && bd.velocity.y === 0 && bd.velocity.z === 0;
  check("dock-accepted", dr.ok, `POST /intent → ${dr.status}`);
  check("dock-snaps-to-station", docked, `pos=${JSON.stringify(bd.position)}`);

  if (stop) await stop();
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n[harness] ${checks.length - failed.length}/${checks.length} PASS`);
  if (failed.length) { console.log(`[harness] FAIL: ${failed.map((f) => f.name).join(", ")}`); process.exit(1); }
}

main().catch((e) => { console.error("[harness] ERROR:", (e as Error).message); process.exit(1); });
