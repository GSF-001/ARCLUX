// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/cn"

export function CTA() {
  return (
    <section className="border-t px-6 py-24">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Start mapping your codebase
        </h2>
        <p className="max-w-md text-muted-foreground">
          Point Arclux at any repository and see the full dependency graph in
          under a minute.
        </p>
        <Link href="/new" className={cn(buttonVariants({ size: "lg" }))}>
          Analyze a repository
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Link>
      </div>
    </section>
  )
}
