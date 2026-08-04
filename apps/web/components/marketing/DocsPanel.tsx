// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use client"

import { GitBranch, Radar, ShieldAlert, Layers, BookOpen } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

// Content moved here from the old Features.tsx (deleted) -- previously
// rendered inline on the landing page, now tucked behind a small floating
// tab so the landing page itself stays uncluttered.
const docs = [
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

/**
 * Small floating tab, fixed to the right edge of the viewport (Apple-style
 * "peeking" tab), that opens a slide-out panel with what used to be the
 * landing page's Features section. Position in the JSX tree does not
 * matter since it's fixed-positioned -- rendered once from app/page.tsx.
 */
export function DocsPanel() {
  return (
    <Sheet>
      {/*
        This vendor-ui is Base UI, not Radix -- Base UI primitives take a
        "render" prop (pass a template element) instead of Radix's
        "asChild" pattern. Passing asChild here silently did nothing
        useful, so SheetTrigger rendered its own <button> AND kept this
        one as a child, producing invalid nested <button><button> HTML
        and a hydration error. See DialogClose in vendor-ui/shadcn/dialog.tsx
        for the same render-prop pattern already used elsewhere.
      */}
      <SheetTrigger
        render={
          <button
            type="button"
            className="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 items-center gap-1.5 rounded-l-full border border-r-0 bg-background/80 py-3 pl-3 pr-4 text-sm font-medium text-muted-foreground backdrop-blur-md transition-colors hover:text-foreground"
          />
        }
      >
        <BookOpen className="h-4 w-4" />
        Docs
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>How ARCLUX works</SheetTitle>
          <SheetDescription>
            What the tool actually does, under the hood.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 overflow-y-auto p-4">
          {docs.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex flex-col gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border">
                <Icon className="h-4 w-4" />
              </div>
              <h3 className="font-medium">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
