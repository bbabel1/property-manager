"use client"
import { ReactNode } from 'react'
import { useAuth } from '@/components/providers'
import type { AppRole } from '@/lib/auth/roles'
import { hasRole } from '@/lib/auth/roles'

export function Guard({ require, children }: { require: AppRole | AppRole[]; children: ReactNode }) {
  const { user } = useAuth()
  const roles = ((user?.app_metadata as any)?.claims?.roles ?? []) as AppRole[]
  if (!hasRole(roles, require)) return null
  return <>{children}</>
}
