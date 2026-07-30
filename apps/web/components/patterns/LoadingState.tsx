import { Loader2 } from "lucide-react"

interface LoadingStateProps {
  label?: string
}

export function LoadingState({ label = "Loading..." }: LoadingStateProps) {
  return (
    <div className="flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
