export type AppRole =
  | 'platform_admin'
  | 'org_admin'
  | 'org_manager'
  | 'org_staff'
  | 'owner_portal'
  | 'tenant_portal'

export const RoleRank: Record<AppRole, number> = {
  platform_admin: 100,
  org_admin: 80,
  org_manager: 60,
  org_staff: 40,
  owner_portal: 20,
  tenant_portal: 10,
}

export function hasRole(userRoles: AppRole[] | undefined, required: AppRole | AppRole[]) {
  if (!userRoles?.length) return false
  const req = Array.isArray(required) ? required : [required]
  const maxRank = Math.max(...userRoles.map((r) => RoleRank[r]))
  const needed = Math.min(...req.map((r) => RoleRank[r]))
  return maxRank >= needed
}

