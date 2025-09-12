'use client'

// Single source of truth for auth context.
// Re-export from components/providers to avoid duplicate implementations.
export { Providers, useAuth, AuthContext } from '@/components/providers'
