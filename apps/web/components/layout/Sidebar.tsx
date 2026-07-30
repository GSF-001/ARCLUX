"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Network, Search, Settings } from "lucide-react"
import { cn } from "@/lib/cn"

interface SidebarProps {
  org: string
  repo: string
}

export function Sidebar({ org, repo }: SidebarProps) {
  const pathname = usePathname()
  const base = `/${org}/${repo}`

  const links = [
    { label: "Overview", href: base, icon: LayoutDashboard },
    { label: "Graph", href: `${base}/graph`, icon: Network },
    { label: "Search", href: `${base}/search`, icon: Search },
    { label: "Settings", href: `${base}/settings`, icon: Settings },
  ]

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col gap-1 border-r bg-background p-3">
      {links.map(({ label, href, icon: Icon }) => {
        const isActive = pathname === href

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        )
      })}
    </aside>
  )
}
