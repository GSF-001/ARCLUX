set +H
cd ~/arclux || { echo "repo not found at ~/arclux"; exit 1; }

LICENSE_HEADER='/**
 * Copyright '"$(date +%Y)"' ARCLUX
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */'

make_stub() {
  local filepath="$1"
  local label="$2"
  mkdir -p "$(dirname "$filepath")"
  if [ -f "$filepath" ]; then
    echo "SKIP (exists): $filepath"
    return
  fi
  cat > "$filepath" << INNEREOF
$LICENSE_HEADER

// Scaffold: $label — not yet implemented.
INNEREOF
  echo "created: $filepath"
}

# ── packages/kernel ──────────────────────────────
make_stub packages/kernel/Kernel.ts "kernel/Kernel"
make_stub packages/kernel/ProcessTable.ts "kernel/ProcessTable"
make_stub packages/kernel/SignalBus.ts "kernel/SignalBus"
make_stub packages/kernel/ServiceRegistry.ts "kernel/ServiceRegistry"
make_stub packages/kernel/introspection/ProcSnapshot.ts "kernel/introspection/ProcSnapshot"
make_stub packages/kernel/introspection/formatProcTree.ts "kernel/introspection/formatProcTree"

# ── packages/semantic-diff ──────────────────────────────
make_stub packages/semantic-diff/SemanticDiff.ts "semantic-diff/SemanticDiff"
make_stub packages/semantic-diff/SymbolDiff.ts "semantic-diff/SymbolDiff"
make_stub packages/semantic-diff/AstDiff.ts "semantic-diff/AstDiff"
make_stub packages/semantic-diff/DependencyDiff.ts "semantic-diff/DependencyDiff"
make_stub packages/semantic-diff/DiffRenderer.ts "semantic-diff/DiffRenderer"

# ── packages/notifications ──────────────────────────────
make_stub packages/notifications/NotificationManager.ts "notifications/NotificationManager"
make_stub packages/notifications/Notification.ts "notifications/Notification"
make_stub packages/notifications/NotificationChannel.ts "notifications/NotificationChannel"

# ── packages/package-manager ──────────────────────────────
make_stub packages/package-manager/PackageManager.ts "package-manager/PackageManager"
make_stub packages/package-manager/PackageManifest.ts "package-manager/PackageManifest"
make_stub packages/package-manager/PackageResolver.ts "package-manager/PackageResolver"
make_stub packages/package-manager/PackageState.ts "package-manager/PackageState"

# ── apps/cli/commands (missing) ──────────────────────────────
make_stub apps/cli/commands/health.ts "cli/commands/health"
make_stub apps/cli/commands/package.ts "cli/commands/package"

echo "✅ Done. New files: $(git status --porcelain | wc -l)"
