// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// NOT IMPLEMENTED YET — deferred deliberately.
//
// A meaningful "props must be typed" rule needs to know whether a
// component's props parameter is annotated (an inline type, an interface,
// or a shared Props type). The pipeline's RawExport/ModuleInfo shape
// captures export names and kinds but not function parameters, so this
// rule would be guessing from filenames only — the same false-positive
// class detectRouteConvention's header warns about. Revisit when the
// parser exposes parameter-level type information.

