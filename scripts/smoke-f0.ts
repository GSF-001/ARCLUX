// 10.V F0 smoke: correctness gaps F1-F4 + F6-F8 (pure, deterministik).
// Run: ./node_modules/.bin/tsx scripts/smoke-f0.ts (exit 1 = FAIL)

import {
  landingOutcome,
  nextEmergencyState,
  applyGravity,
  surfaceGravity,
} from "../packages/gameserver/vesselState";
import { vesselMass } from "../packages/gameserver/collision";
import {
  generateCosmicEventsForTick,
} from "../packages/gameserver/cosmicEvent";
import {
  createEnvironmentalContext,
  localHour,
  chunkLonDeg,
} from "../packages/gameserver/planetary/environment";
import {
  discoverViaRadar,
  formatRadarHud,
} from "../apps/game/src/renderer/scene3d/planetary/night";
import {
  strikeDistanceTo,
  STALE_STRIKE_DISTANCE,
} from "../apps/game/src/renderer/scene3d/planetary/lightning";
import { stormAmpScale } from "../apps/game/src/renderer/scene3d/planetary/ocean";
import { timeOfDayFromMs } from "../apps/game/src/renderer/scene3d/planetary/surface";

let fail = 0;
const ok = (c: boolean, s: string): void => {
  console.log(`${c ? "PASS" : "FAIL"} ${s}`);
  if (!c) fail++;
};

// --- F1: settle MEASURED — landingOutcome dipanggil + crash_impact jujur ---
const soft = landingOutcome({ mass: 5e6, speed: 1.5, verticalSpeed: -1, slope: 0, onEmptyLand: false });
ok(soft.verdict === "landed", `F1 touchdown lembut = landed (KE=${Math.round(soft.kineticEnergy)})`);
const hard = landingOutcome({ mass: 5e6, speed: 120, verticalSpeed: -30, slope: 0, onEmptyLand: false });
ok(hard.verdict === "wrecked", `F1 hantaman 120m/s = wrecked (KE=${(hard.kineticEnergy / 1e9).toFixed(1)}GJ)`);
const slam = landingOutcome({ mass: 5e6, speed: 10, verticalSpeed: -25, slope: 0, onEmptyLand: true });
ok(slam.verdict === "wrecked", "F1 verticalSpeed < -18 = wrecked walau pelan + empty");
// Transisi falling -> crashed saat settle (mesinnya, verdict di sim):
const wreck: any = {
  id: "v-1",
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0.5, y: -0.5, z: 0.5 },
  vessel: { systems: [{ health: 5 }, { health: 4 }] },
  emergency: { state: "falling", updatedTick: 1, cause: "gravity-capture" },
};
const tr = nextEmergencyState(wreck, { x: 0, y: 0, z: 100 }, 99);
ok(tr.state === "crashed" && tr.changed && tr.cause === "settled", "F1 falling pelan -> crashed settled");
ok(vesselMass(wreck) === 5e6, "F1 konvensi massa default 5e6 (satu sumber)");

// --- F4: gravitasi per planet dari environs ---
ok(Math.abs(surfaceGravity(5.972e24, 6.371e6) - 9.81) < 0.05, `F4 g Bumi ≈ 9.81 (${surfaceGravity(5.972e24, 6.371e6).toFixed(2)})`);
ok(Math.abs(surfaceGravity(6.39e23, 3.3895e6) - 3.71) < 0.05, `F4 g Mars ≈ 3.71 (${surfaceGravity(6.39e23, 3.3895e6).toFixed(2)})`);
const pos = { x: 1e7, y: 0, z: 0 };
const vel = { x: 0, y: 0, z: 0 };
const vEarth = applyGravity(pos, vel, { x: 0, y: 0, z: 0 }, 1, 5.972e24);
const vMars = applyGravity(pos, vel, { x: 0, y: 0, z: 0 }, 1, 6.39e23);
ok(Math.hypot(vEarth.x, vEarth.y, vEarth.z) > Math.hypot(vMars.x, vMars.y, vMars.z) * 5, "F4 Bumi narik >5x Mars pada jarak sama");

// --- F6: waktu lokal ikut longitude ---
ok(Math.abs(localHour(0, 0) - 0) < 1e-9, "F6 00:00 UTC lon 0 = jam 0");
ok(Math.abs(localHour(0, 180) - 12) < 1e-9, "F6 00:00 UTC lon 180 = jam 12");
ok(Math.abs(chunkLonDeg("planet-07:0:0") - -179.99) < 0.05, `F6 chunk 0 ≈ -180° (${chunkLonDeg("planet-07:0:0").toFixed(2)})`);
// Siang UTC: chunk 0 malam, chunk antipodal (+10019) siang.
const noonUTC = 12 * 3600000;
const c0 = createEnvironmentalContext({ planetId: "planet-07", planetSeed: 7, chunkKey: "planet-07:0:0", simulationTick: 1, worldTime: noonUTC });
const cAnti = createEnvironmentalContext({ planetId: "planet-07", planetSeed: 7, chunkKey: "planet-07:10019:0", simulationTick: 1, worldTime: noonUTC });
ok(c0.timeOfDay !== cAnti.timeOfDay, `F6 barat vs timur beda waktu (${c0.timeOfDay} vs ${cAnti.timeOfDay})`);
// Kontinu via positionXZ (interpolasi, bukan step):
const pa = createEnvironmentalContext({ planetId: "p", planetSeed: 7, chunkKey: "planet-07:0:0", simulationTick: 1, worldTime: noonUTC, positionXZ: { x: 1000, z: 0 } });
ok(pa.timeOfDay === c0.timeOfDay, "F6 positionXZ dalam chunk = waktu chunk");
ok(timeOfDayFromMs(noonUTC, 0) === "day" && timeOfDayFromMs(noonUTC, 180) === "night", "F6 client timeOfDayFromMs ikut lon");

// --- F7: anomali -> chunkKey + overlay storm ---
const e1 = generateCosmicEventsForTick("r-1", 4242, "planet-07");
const e2 = generateCosmicEventsForTick("r-1", 4242, "planet-07");
ok(JSON.stringify(e1) === JSON.stringify(e2), "F7 generator deterministik (server == client)");
let anomalyChunk = "";
for (let t = 0; t < 6000 && !anomalyChunk; t++) {
  for (const e of generateCosmicEventsForTick("r-1", t, "planet-07")) {
    if (e.kind === "anomaly_gravity" && typeof e.payload["chunkKey"] === "string") anomalyChunk = e.payload["chunkKey"] as string;
  }
}
ok(/planet-07:-?\d+:-?\d+/.test(anomalyChunk), `F7 payload anomali bawa chunkKey (${anomalyChunk})`);
if (anomalyChunk) {
  const calm = createEnvironmentalContext({ planetId: "planet-07", planetSeed: 7, chunkKey: anomalyChunk, simulationTick: 4242, worldTime: noonUTC });
  const stormed = createEnvironmentalContext({ planetId: "planet-07", planetSeed: 7, chunkKey: anomalyChunk, simulationTick: 4242, worldTime: noonUTC, anomalyChunks: [anomalyChunk] });
  void calm;
  ok(stormed.weather.kind === "storm", "F7 overlay anomali memaksa storm di chunk target");
}

// --- F3: tag ADRIFT kapal orang ---
const disc = discoverViaRadar({ x: 0, y: 0, z: 0 }, [
  { id: "v-adrift-1", kind: "vessel", position: { x: 1000, y: 0, z: 0 }, health: 50, emergency: "adrift" },
  { id: "v-ok-2", kind: "vessel", position: { x: 2000, y: 0, z: 0 }, health: 90 },
]);
ok(disc.contacts[0].emergency === "adrift", "F3 emergency lolos ke kontak");
const hud = formatRadarHud(disc);
ok(hud.indexOf("[ADRIFT]") !== -1, `F3 HUD menandai [ADRIFT] (${hud})`);

// --- F2: jarak petir beneran ---
const cam = { x: 0, y: 100, z: 0 };
const fresh = { eventId: "lt-1", timestamp: 5000, position: { x: 300, y: 300, z: 400 }, intensity: 1, duration: 200, flashColor: 0xffffff };
ok(Math.abs(strikeDistanceTo(cam, fresh, 6000) - Math.hypot(300, Math.hypot(200, 400))) < 1e-6, "F2 strike segar = jarak beneran");
ok(strikeDistanceTo(cam, fresh, 60000) === STALE_STRIKE_DISTANCE, "F2 strike basi = fallback bernama");
ok(strikeDistanceTo(cam, null, 6000) === STALE_STRIKE_DISTANCE && STALE_STRIKE_DISTANCE === 2800, "F2 tanpa event = 2800 (terdokumentasi)");

// --- F8: amplitudo mesh ikut state ---
ok(Math.abs(stormAmpScale(0.9 + 6 * 0.32) - 1) < 1e-9, "F8 laut tenang = skala 1");
ok(stormAmpScale(8) > 2, "F8 badai = mesh membesar (>2x)");
ok(stormAmpScale(0.2) === 0.3 && stormAmpScale(99) === 3, "F8 skala dijepit 0.3..3");

process.exit(fail ? 1 : 0);
