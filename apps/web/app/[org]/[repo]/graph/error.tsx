"use client"

import { useEffect } from "react"
import { ErrorState } from "@/components/patterns/ErrorState"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <ErrorState
      title="Couldn't render the graph"
      message={error.message || "Something went wrong while building the dependency graph."}
      onRetry={reset}
    />
  )
}
