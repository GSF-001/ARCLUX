import { Hero } from "@/components/marketing/Hero"
import { Features } from "@/components/marketing/Features"
import { Example } from "@/components/marketing/Example"
import { CTA } from "@/components/marketing/CTA"
import { Footer } from "@/components/marketing/Footer"

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Hero />
      <Features />
      <Example />
      <CTA />
      <Footer />
    </div>
  )
}
