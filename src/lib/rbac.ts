import type { AppRole } from '@/lib/auth/roles'
import { hasRole } from '@/lib/auth/roles'

export type RouteRule = { prefix: string; roles: AppRole | AppRole[] }

// Central RBAC map for API routes (prefix match)
// Adjust as needed; more specific prefixes should come first.
export const routeRBAC: RouteRule[] = [
  { prefix: '/api/buildium/user-roles', roles: 'org_admin' },
  { prefix: '/api/staff', roles: 'org_admin' },
  // General protected resources require at least org_staff
  { prefix: '/api/buildium', roles: 'org_staff' },
  { prefix: '/api/owners', roles: 'org_staff' },
  { prefix: '/api/properties', roles: 'org_staff' },
  { prefix: '/api/units', roles: 'org_staff' },
  { prefix: '/api/work-orders', roles: 'org_staff' },
  { prefix: '/api/bank-accounts', roles: 'org_staff' },
]

export function requiredRolesFor(pathname: string): AppRole[] | null {
  const rule = routeRBAC.find((r) => pathname.startsWith(r.prefix))
  if (!rule) return null
  return Array.isArray(rule.roles) ? rule.roles : [rule.roles]
}

export function userHasRequiredRoles(userRoles: AppRole[] | undefined, required: AppRole[] | null) {
  if (!required || required.length === 0) return true
  return hasRole(userRoles ?? [], required)
}

