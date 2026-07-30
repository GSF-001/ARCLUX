import Link from "next/link"

const links = [
  { label: "GitHub", href: "https://github.com" },
  { label: "Documentation", href: "/docs" },
  { label: "Changelog", href: "/changelog" },
]

export function Footer() {
  return (
    <footer className="border-t px-6 py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Aries. MIT License.
        </p>
        <nav className="flex items-center gap-6">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
