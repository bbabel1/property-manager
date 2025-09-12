"use client"

import React from 'react'

export function SafeBoundary({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const [err, setErr] = React.useState<Error | null>(null)
  // Simple error boundary using error state and an inner component
  const Inner = React.useMemo(() => {
    function InnerComp({ children }: { children: React.ReactNode }) {
      try {
        return <>{children}</>
      } catch (e: any) {
        setErr(e)
        return null
      }
    }
    return InnerComp
  }, [])
  if (err) return <>{fallback ?? <div className="text-sm text-destructive">Something went wrong loading this section.</div>}</>
  return <Inner>{children}</Inner>
}

export default SafeBoundary

