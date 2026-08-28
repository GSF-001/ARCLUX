// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// apps/game — ARCLUX MMO client (Electron). Entry: bootstrap Electron main.
//
// 🚧 SCAFFOLD — lihat README.md + docs/blueprint/progres/MMO-IMPLEMENTATION.md.

import { startMain } from "./src/main/main";

// IMPL: panggil startMain() setelah Electron devDependencies terpasang.
// Jalankan: cd apps/game && npx electron .
console.log("arclux-game: scaffold — bootstrap Electron main di src/main/main.ts");
void startMain;
