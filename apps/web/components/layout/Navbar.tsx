"use client"

import Link from "next/link"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/hooks/useTheme"
import { Button } from "@/components/ui/button"

export function Navbar() {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
      <Link href="/" className="text-sm font-semibold tracking-tight">
        Arclux
      </Link>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  )
}
