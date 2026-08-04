// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import Link from "next/link"
import { Code2 } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/cn"

export function Hero() {
  return (
    <section className="flex flex-col items-center gap-6 px-6 py-28 text-center sm:py-36">
      <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Alpha
      </div>

      <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
        Know the blast radius before you commit.
      </h1>

      <p className="max-w-md text-balance text-lg text-muted-foreground">
        Dependency graphs and impact analysis for any repository.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        {/*
          Glass-style override, scoped to this button only -- not a change
          to buttonVariants() in components/ui/button.tsx, so it does not
          affect any other button in the app. bg-white/10 + backdrop-blur
          + border-white/20 gives the frosted-glass look; hover bumps
          opacity slightly instead of using the default variant's
          bg-primary/80 hover state.
        */}
        <Link
          href="/new"
          className={cn(
            buttonVariants({ size: "lg", variant: "outline" }),
            "border-white/20 bg-white/10 text-white backdrop-blur-md hover:bg-white/20"
          )}
        >
          Analyze a repository
        </Link>
        <Link
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
        >
          <Code2 className="mr-1.5 h-4 w-4" />
          View on GitHub
        </Link>
      </div>
    </section>
  )
}
