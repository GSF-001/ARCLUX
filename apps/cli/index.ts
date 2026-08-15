#!/usr/bin/env node
// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { Command } from "commander";
import { registerAnalyzeCommand } from "./analyze";
import { registerGraphCommand } from "./graph";
import { registerImpactCommand } from "./impact";
import { registerDiffCommand } from "./diff";
import { registerVerifyCommand } from "./verify";
import { registerDoctorCommand } from "./doctor";
import { registerConfigCommand } from "./config";
import { registerDiagnoseCommand } from "./diagnose";
import { registerDaemonCommand } from "./daemon";
import { registerPsCommand } from "./commands/ps";
import { registerWorkCommand } from "./commands/work";
import { registerEditCommand } from "./commands/edit";
import { registerOpenCommand } from "./commands/open";
import { logsCommand } from "./commands/logs";
import { registerRunCommand } from "./commands/run";
import { registerWorkspaceCommand } from "./workspace";
import { registerSystemCommand } from "./commands/system";
import { registerLanguageCommand } from "./language";

const program = new Command();
program.name("arclux").description("Repository intelligence CLI").version("0.1.0");

registerAnalyzeCommand(program);
registerGraphCommand(program);
registerImpactCommand(program);
registerDiffCommand(program);
registerVerifyCommand(program);
registerDoctorCommand(program);
registerConfigCommand(program);
registerDiagnoseCommand(program);
registerDaemonCommand(program);
registerPsCommand(program);
registerWorkCommand(program);
registerEditCommand(program);
registerOpenCommand(program);
program.addCommand(logsCommand);
registerRunCommand(program);
registerWorkspaceCommand(program);
registerSystemCommand(program);
registerLanguageCommand(program);

program.parse();
