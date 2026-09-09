// 10.V P1 smoke: mood derivasi, uniform grade/touch, urutan pass final.
// Run: ./node_modules/.bin/tsx scripts/smoke-post.ts (exit 1 = FAIL)

import type { EnvironmentalContext } from "../packages/gameserver/planetary/environment";
import { POST_PASS_ORDER } from "../apps/game/src/renderer/scene3d/post";
import {
  createGradePass,
  deriveGradeMood,
  updateGradePass,
} from "../apps/game/src/renderer/scene3d/gradePass";
import {
  createFinalTouchPass,
  updateFinalTouchPass,
} from "../apps/game/src/renderer/scene3d/finalTouchPass";

let fail = 0;
const ok = (c: boolean, s: string): void => {
  console.log(`${c ? "PASS" : "FAIL"} ${s}`);
  if (!c) fail++;
};

const base = {
  sun: { elevation: 0.8 },
  moonState: { illumination: 0.6 },
  weather: { kind: "clear" },
  timeOfDay: "day",
} as EnvironmentalContext;

// Urutan composer FINAL — didefinisikan sekali, di-assert di sini.
ok(
  JSON.stringify(POST_PASS_ORDER) ===
    JSON.stringify(["render", "bloom", "grade", "cockpit", "touch", "output"]),
  "urutan pass [render,bloom,grade,cockpit,touch,output]",
);
// Siang cerah: semua mood nol.
const noon = deriveGradeMood(base);
ok(noon.warm === 0 && noon.storm === 0 && noon.night === 0, "siang cerah = mood nol");
// Dusk: warm hidup (elevasi 0.12).
const dusk = deriveGradeMood({ ...base, sun: { elevation: 0.12 }, timeOfDay: "dusk" } as EnvironmentalContext);
ok(dusk.warm > 0.8, `dusk = warm hidup (${dusk.warm.toFixed(2)})`);
// Storm: storm penuh; rain: 0.35.
const storm = deriveGradeMood({ ...base, weather: { kind: "storm" } } as EnvironmentalContext);
ok(storm.storm === 1, "storm = 1");
const rain = deriveGradeMood({ ...base, weather: { kind: "rain" } } as EnvironmentalContext);
ok(Math.abs(rain.storm - 0.35) < 1e-9, "rain = 0.35");
// Night: night penuh.
const night = deriveGradeMood({ ...base, timeOfDay: "night", sun: { elevation: -0.2 } } as EnvironmentalContext);
ok(night.night === 1 && night.warm === 0, "night = 1, warm mati di bawah horizon");
// Uniform grade ter-update + moon ikut.
const grade = createGradePass();
updateGradePass(grade, { ...base, weather: { kind: "storm" }, timeOfDay: "night", sun: { elevation: -0.2 } } as EnvironmentalContext);
ok(grade.uniforms["uStorm"].value === 1, "uniform uStorm ter-update");
ok(grade.uniforms["uNight"].value === 1, "uniform uNight ter-update (P1.4)");
ok(grade.uniforms["uMoon"].value === 0.6, "uniform uMoon ikut moonState");
// Touch: time + aspect ter-update (grain hash-based, bukan Date.now).
const touch = createFinalTouchPass();
updateFinalTouchPass(touch, 77.5, 21 / 9);
ok(touch.uniforms["uTime"].value === 77.5, "uniform uTime ter-update");
ok(Math.abs(touch.uniforms["uAspect"].value - 21 / 9) < 1e-9, "uniform uAspect ter-update");
process.exit(fail ? 1 : 0);
