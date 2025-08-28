'use client'

import { SessionProvider, useSession } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  )
}

// Lightweight auth hook backed by next-auth session
export function useAuth(): { user: any | null; loading: boolean } {
  const { data, status } = useSession()
  return {
    user: data?.user ?? null,
    loading: status === 'loading'
  }
}
