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
      title="Couldn't load this repository"
      message={error.message || "We ran into a problem analyzing this repository."}
      onRetry={reset}
    />
  )
}
