import { cn } from "@/lib/cn"

interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-6 py-8", className)}>
      {children}
    </div>
  )
}
