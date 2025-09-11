export function requireSyncScope(user: { roles: string[]; org_ids: string[] }, orgId: string) {
  if (!user.org_ids?.includes(orgId)) throw new Error('ORG_FORBIDDEN')
  return { orgId }
}

