import Link from "next/link"
import { ArrowRight, Code2 } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/cn"

export function Hero() {
  return (
    <section className="flex flex-col items-center gap-8 px-6 py-28 text-center sm:py-36">
      <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Now in alpha
      </div>

      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
        Know the blast radius of every change, before you make it.
      </h1>

      <p className="max-w-xl text-balance text-lg text-muted-foreground">
        Arclux maps your repository into a dependency graph, flags structural
        issues, and traces the exact impact of any file, module, or route.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/new" className={cn(buttonVariants({ size: "lg" }))}>
          Analyze a repository
          <ArrowRight className="ml-1.5 h-4 w-4" />
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
