// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Routes-only PHP extraction (issue #53). This is deliberately NARROW: it
// reads Laravel route files (routes/web.php, routes/api.php) and pulls out
// controller references so the requireController rule can cross-check them
// against app/Http/Controllers/. It is NOT a general PHP parser — that role
// belongs to parsePhp.ts, a documented deferral (see its header comment; it
// must not be implemented here). Uses node:fs-free plain regex/line scanning
// so it stays importable by rules without pulling in parser machinery.
//
// v1 handles ONLY the array callable syntax:
//   Route::get('/users', [UserController::class, 'index']);
// The first array element (the class, with optional namespace) is the
// controller reference; the basename after the last backslash is what the
// rule checks against app/Http/Controllers/<Name>.php.
//
// Known limitations (deliberate, v1 scope — same style as other detectors'
// limitation notes):
//   - Closures are skipped on purpose: Route::get('/', fn () => ...) binds
//     no controller, so there is nothing to cross-check.
//   - String callables ('UserController@index') are NOT recognized in v1 —
//     resolving them to a file requires a class-name -> path heuristic that
//     cannot be verified against the repo, so they are silently ignored
//     rather than guessed.
//   - The whole [X::class, 'method'] array must sit on a single line; a
//     callable split across lines is not matched.
//   - Only the class basename survives, so namespaced controllers
//     (App\Http\Controllers\Admin\UserController) can only be verified via
//     the conventional flat app/Http/Controllers/UserController.php path —
//     Laravel's automatic controller namespacing for the default layout.

export interface PhpRouteControllerRef {
  /** Controller class basename as written in the route callable, e.g. "UserController" */
  controllerName: string;
  /** Route file the reference came from, e.g. "routes/web.php" */
  routeFile: string;
  /** 1-indexed line number in the route file */
  line: number;
}

// [ClassName::class, 'method'] — first element must be a (optionally
// namespaced) class constant, second a quoted method name. Deliberately
// requires the closing bracket on the same line (v1 limitation, see header).
const ARRAY_CALLABLE_PATTERN = /\[([A-Za-z_\\][A-Za-z0-9_\\]*::class)\s*,\s*['"][^'"]*['"]\s*\]/g;

export function parsePhpRoutes(content: string, routeFile: string): PhpRouteControllerRef[] {
  const refs: PhpRouteControllerRef[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    ARRAY_CALLABLE_PATTERN.lastIndex = 0;
    const matches = lines[i].matchAll(ARRAY_CALLABLE_PATTERN);
    for (const match of matches) {
      const qualified = match[1]; // e.g. "App\\Http\\Controllers\\UserController::class"
      const controllerName = qualified.replace(/::class$/, "").split("\\").pop();
      if (!controllerName) continue;
      refs.push({ controllerName, routeFile, line: i + 1 });
    }
  }

  return refs;
}
