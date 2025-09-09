'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { useAuth } from '@/components/providers'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function ProtectedLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [activeSection, setActiveSection] = useState('dashboard')

  // Map pathname to section ID
  useEffect(() => {
    const sectionMap: Record<string, string> = {
      '/dashboard': 'dashboard',
      '/properties': 'properties',
      '/units': 'units',
      '/leases': 'leases',
      '/owners': 'owners',
      '/tenants': 'tenants',
      '/settings': 'settings',
    }
    
    const currentSection = sectionMap[pathname] || 'dashboard'
    setActiveSection(currentSection)
  }, [pathname])

  // Handle navigation
  const handleNavigate = (section: string) => {
    const routeMap: Record<string, string> = {
      'dashboard': '/dashboard',
      'properties': '/properties',
      'units': '/units',
      'leases': '/leases',
      'owners': '/owners',
      'tenants': '/tenants',
      'lease-renewals': '/leases', // Map to leases for now
      'settings': '/settings',
    }
    
    const route = routeMap[section]
    if (route) {
      router.push(route)
    }
  }

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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect to sign-in
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeSection={activeSection} onNavigate={handleNavigate} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}