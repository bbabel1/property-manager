'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers'
import AppSidebarLayout from '@/components/layout/app-sidebar'
import AppStateProvider from '@/components/layout/app-state'

export default function ProtectedLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const { user, loading } = useAuth()
  const router = useRouter()

  // Check authentication
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect to sign-in
  }

  return (
    <AppStateProvider>
      <AppSidebarLayout>
        {children}
      </AppSidebarLayout>
    </AppStateProvider>
  )
}
