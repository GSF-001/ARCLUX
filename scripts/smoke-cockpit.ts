// 10.V U4 smoke: resolver deterministik (nol Date.now), uniform pass
// ter-update, tick smoothing jalan.
// Run: ./node_modules/.bin/tsx scripts/smoke-cockpit.ts (exit 1 = FAIL)

import type { EnvironmentalContext } from "../packages/gameserver/planetary/environment";
import type { FlightTurbulence } from "../apps/game/src/renderer/scene3d/cinematic/AtmosphericFlightResolver";
import {
  deriveCockpitState,
  tickCockpit,
} from "../apps/game/src/renderer/scene3d/cinematic/CockpitResponseResolver";
import {
  createCockpitGradePass,
  updateCockpitGradePass,
} from "../apps/game/src/renderer/scene3d/cockpitGradePass";

let fail = 0;
const ok = (c: boolean, s: string): void => {
  console.log(`${c ? "PASS" : "FAIL"} ${s}`);
  if (!c) fail++;
};

const env = {
  weather: { precipitationIntensity: 0.8 },
  clouds: { density: 0.7, coverage: 0.8 },
  atmosphere: { haze: 0.3, scattering: 0.6, density: 0.9 },
  precipitation: { accumulation: 0.5 },
  terrain: { height: 120 },
} as EnvironmentalContext;
const turb = { cameraShake: 0.8 } as FlightTurbulence;

// Determinism: input sama + timeSec sama -> shake IDENTIK (bunuh Date.now).
const s1 = deriveCockpitState(env, null, turb, 1000, 1 / 60, 123.456);
const s2 = deriveCockpitState(env, null, turb, 1000, 1 / 60, 123.456);
ok(
  s1.hudShake.x === s2.hudShake.x && s1.hudShake.y === s2.hudShake.y,
  "hudShake deterministik (Date.now mati)",
);
// Hidup: timeSec beda -> shake beda (bukan konstanta mati).
const s3 = deriveCockpitState(env, null, turb, 1000, 1 / 60, 124.456);
ok(s1.hudShake.x !== s3.hudShake.x, "hudShake ikut jam tick (hidup)");
// Hujan deras -> basah + droplet kelihatan.
ok(s1.windshieldWet > 0.5 && s1.dropletOpacity > 0.3, "hujan -> windshieldWet + droplet");
// Tick smoothing: flash lerp lebih cepat dari wet (9.5 vs 4.2).
const prev = { ...s1, flashIntensity: 0, windshieldWet: 0 };
const next = { ...s1, flashIntensity: 1, windshieldWet: 1 };
const sm = tickCockpit(prev, next, 1 / 60);
ok(sm.flashIntensity > sm.windshieldWet, "flash smoothing lebih cepat dari wet");
// Grade pass: uniform ter-update dari state.
const pass = createCockpitGradePass();
updateCockpitGradePass(pass, { ...s1, flashIntensity: 0.7, heatVignette: 0.4, cloudDim: 0.5 });
ok(pass.uniforms["uFlash"].value === 0.7, "uniform uFlash ter-update");
ok(pass.uniforms["uHeat"].value === 0.4, "uniform uHeat ter-update");
ok(pass.uniforms["uDim"].value === 0.5, "uniform uDim ter-update");
process.exit(fail ? 1 : 0);
