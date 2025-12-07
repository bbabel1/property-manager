type Membership = { org_id: string; role: string }

export function jwtCustomClaims(input: { memberships: Membership[]; membershipRoles?: Membership[] }) {
  // Mimic the SQL logic in jwt_custom_claims: prefer membershipRoles when present, fallback to memberships per org
  const rolesByOrg = new Map<string, Set<string>>()

  const add = (org: string, role: string) => {
    const set = rolesByOrg.get(org) ?? new Set<string>()
    set.add(role)
    rolesByOrg.set(org, set)
  }

  const perOrgRoleExists = new Set(input.membershipRoles?.map((r) => `${r.org_id}`) ?? [])

  for (const r of input.membershipRoles ?? []) {
    add(r.org_id, r.role)
  }

  for (const r of input.memberships) {
    if (!perOrgRoleExists.has(r.org_id)) {
      add(r.org_id, r.role)
    }
  }

  const org_roles: Record<string, string[]> = {}
  for (const [org, set] of rolesByOrg.entries()) {
    org_roles[org] = Array.from(set)
  }

  return {
    org_roles,
    org_ids: Object.keys(org_roles),
    preferred_org_id: Object.keys(org_roles)[0] ?? null,
  }
}
