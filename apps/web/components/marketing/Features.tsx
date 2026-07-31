// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { GitBranch, Radar, ShieldAlert, Layers } from "lucide-react"

const features = [
  {
    icon: GitBranch,
    title: "Dependency graph",
    description:
      "Imports, exports, calls, and folders resolved into one navigable graph — built from real static analysis.",
  },
  {
    icon: Radar,
    title: "Impact analysis",
    description:
      "Ask what breaks if you touch a file, and get every consumer traced back in milliseconds.",
  },
  {
    icon: ShieldAlert,
    title: "Structural detectors",
    description:
      "Circular dependencies, dead code, orphan files, and layer violations — flagged automatically.",
  },
  {
    icon: Layers,
    title: "Framework-aware rules",
    description:
      "Conventions for Next.js, React, NestJS, Express, Vite, and Electron, out of the box.",
  },
]

export function Features() {
  return (
    <section className="border-t px-6 py-24">
      <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2">
        {features.map(({ icon: Icon, title, description }) => (
          <div key={title} className="flex flex-col gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border">
              <Icon className="h-4 w-4" />
            </div>
            <h3 className="font-medium">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
