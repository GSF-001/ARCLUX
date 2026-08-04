// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { Hero } from "@/components/marketing/Hero"
import { DocsPanel } from "@/components/marketing/DocsPanel"
import { LanguageCoverage } from "@/components/marketing/LanguageCoverage"
import { Example } from "@/components/marketing/Example"
import { CTA } from "@/components/marketing/CTA"
import { Footer } from "@/components/marketing/Footer"

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Hero />
      <LanguageCoverage />
      <Example />
      <CTA />
      <Footer />
      <DocsPanel />
    </div>
  )
}
