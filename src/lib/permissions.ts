import type { AppRole } from './auth/roles'

export type Permission =
  | 'properties.read'
  | 'properties.write'
  | 'owners.read'
  | 'owners.write'
  | 'leases.read'
  | 'leases.write'

const Matrix: Record<AppRole, Permission[]> = {
  platform_admin: ['properties.read', 'properties.write', 'owners.read', 'owners.write', 'leases.read', 'leases.write'],
  org_admin: ['properties.read', 'properties.write', 'owners.read', 'owners.write', 'leases.read', 'leases.write'],
  org_manager: ['properties.read', 'properties.write', 'owners.read', 'owners.write', 'leases.read', 'leases.write'],
  org_staff: ['properties.read', 'owners.read', 'leases.read'],
  owner_portal: ['properties.read', 'leases.read'],
  tenant_portal: ['leases.read'],
}

export function hasPermission(roles: AppRole[], perm: Permission) {
  return roles.some((r) => Matrix[r]?.includes(perm))
}

