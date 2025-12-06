import type { Permission } from '@/lib/permissions'

export type PermissionProfile = {
  id: string
  org_id: string | null
  name: string
  description?: string | null
  is_system: boolean
  permissions: Permission[]
}

export const DefaultProfiles: Array<Omit<PermissionProfile, 'id' | 'org_id'>> = [
  {
    name: 'Developer',
    description: 'Full platform access',
    is_system: true,
    permissions: [
      'properties.read',
      'properties.write',
      'owners.read',
      'owners.write',
      'leases.read',
      'leases.write',
      'monthly_logs.read',
      'monthly_logs.write',
      'monthly_logs.approve',
      'monthly_logs.send_statement',
    ],
  },
  {
    name: 'Staff - Manager',
    description: 'Full staff access (manager)',
    is_system: true,
    permissions: [
      'properties.read',
      'properties.write',
      'owners.read',
      'owners.write',
      'leases.read',
      'leases.write',
      'monthly_logs.read',
      'monthly_logs.write',
      'monthly_logs.approve',
      'monthly_logs.send_statement',
    ],
  },
  {
    name: 'Staff - Standard',
    description: 'Read/edit without approvals',
    is_system: true,
    permissions: ['properties.read', 'owners.read', 'leases.read', 'monthly_logs.read', 'monthly_logs.write'],
  },
  {
    name: 'Owner Portal',
    description: 'Owner portal default',
    is_system: true,
    permissions: ['properties.read', 'leases.read', 'monthly_logs.read'],
  },
  {
    name: 'Tenant Portal',
    description: 'Tenant portal default',
    is_system: true,
    permissions: ['leases.read'],
  },
  {
    name: 'Vendor Portal',
    description: 'Vendor portal default',
    is_system: true,
    permissions: ['properties.read'],
  },
]

export function pickDefaultProfileNameForRoles(roles: string[] | undefined) {
  const set = new Set((roles ?? []).map((r) => r.toLowerCase()))
  if (set.has('platform_admin') || set.has('org_admin')) return 'Developer'
  if (set.has('platform_admin') || set.has('org_admin') || set.has('org_manager')) return 'Staff - Manager'
  if (set.has('org_staff')) return 'Staff - Standard'
  if (set.has('owner_portal')) return 'Owner Portal'
  if (set.has('tenant_portal')) return 'Tenant Portal'
  if (set.has('vendor_portal')) return 'Vendor Portal'
  return null
}
