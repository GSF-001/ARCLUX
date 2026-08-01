// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Thin re-export of vendor-ui/shadcn/avatar.tsx. Kept as a separate
// primitives/ file (rather than importing vendor-ui directly everywhere)
// so app code has one stable import path even if the underlying shadcn
// component gets regenerated or swapped later.

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
} from "@/vendor-ui/shadcn/avatar"
