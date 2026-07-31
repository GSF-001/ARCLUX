// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { Loader2 } from "lucide-react"

interface LoadingStateProps {
  label?: string
}

export function LoadingState({ label = "Loading..." }: LoadingStateProps) {
  return (
    <div className="flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
