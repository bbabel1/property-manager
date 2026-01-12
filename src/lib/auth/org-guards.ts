import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { AppRole } from '@/lib/auth/roles'
import { supabaseAdminMaybe } from '@/lib/db'

const ADMIN_ROLE_SET = new Set<AppRole>(['org_admin', 'org_manager', 'platform_admin'])

type Client = SupabaseClient<Database, 'public', any>

type OrgResolution =
  | { ok: true; orgId: string }
  | { ok: false; error: string }

const resourceResolvers: Record<
  string,
  (client: Client, id: string) => Promise<OrgResolution>
> = {
  property: async (client, id) => {
    const { data, error } = await client
      .from('properties')
      .select('org_id')
      .eq('id', id)
      .maybeSingle()
    if (error) return { ok: false, error: error.message }
    if (!data?.org_id) return { ok: false, error: 'org not found for property' }
    return { ok: true, orgId: String(data.org_id) }
  },
  owner: async (client, id) => {
    const { data, error } = await client
      .from('owners')
      .select('org_id')
      .eq('id', id)
      .maybeSingle()
    if (error) return { ok: false, error: error.message }
    if (!data?.org_id) return { ok: false, error: 'org not found for owner' }
    return { ok: true, orgId: String(data.org_id) }
  },
  unit: async (client, id) => {
    const { data, error } = await client
      .from('units')
      .select('org_id')
      .eq('id', id)
      .maybeSingle()
    if (error) return { ok: false, error: error.message }
    if (!data?.org_id) return { ok: false, error: 'org not found for unit' }
    return { ok: true, orgId: String(data.org_id) }
  },
  tenant: async (client, id) => {
    const { data, error } = await client
      .from('tenants')
      .select('org_id')
      .eq('id', id)
      .maybeSingle()
    if (error) return { ok: false, error: error.message }
    if (!data?.org_id) return { ok: false, error: 'org not found for tenant' }
    return { ok: true, orgId: String(data.org_id) }
  },
  vendor: async (client, id) => {
    const { data, error } = await client
      .from('vendors')
      .select('org_id')
      .eq('id', id)
      .maybeSingle()
    if (error) return { ok: false, error: error.message }
    if (!data?.org_id) return { ok: false, error: 'org not found for vendor' }
    return { ok: true, orgId: String(data.org_id) }
  },
  monthly_log: async (client, id) => {
    const { data, error } = await client
      .from('monthly_logs')
      .select('org_id')
      .eq('id', id)
      .maybeSingle()
    if (error) return { ok: false, error: error.message }
    if (!data?.org_id) return { ok: false, error: 'org not found for monthly log' }
    return { ok: true, orgId: String(data.org_id) }
  },
}

export async function resolveResourceOrg(
  client: Client,
  resource: keyof typeof resourceResolvers,
  id: string,
): Promise<OrgResolution> {
  return resourceResolvers[resource](client, id)
}

export async function requireOrgMember(params: {
  client: Client
  userId: string
  orgId: string
}) {
  const { client, userId, orgId } = params
  const { data, error } = await client
    .from('org_memberships')
    .select('org_id')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('ORG_FORBIDDEN')
  return { orgId }
}

export async function requireOrgAdmin(params: {
  client: Client
  userId: string
  orgId: string
  orgRoles?: Record<string, AppRole[]>
  roles?: AppRole[]
  adminClient?: Client
}) {
  const { client, userId, orgId, orgRoles, roles: claimedRoles, adminClient } = params

  const collected = new Set<AppRole>()
  const addRoles = (list: (AppRole | null | undefined)[]) => {
    list.forEach((role) => {
      if (role && ADMIN_ROLE_SET.has(role)) collected.add(role)
    })
  }

  const orgClaimRoles = orgRoles?.[orgId] ?? []
  addRoles(orgClaimRoles)
  if (collected.size) {
    const role = collected.values().next().value as AppRole
    return { orgId, role, roles: Array.from(collected) }
  }

  addRoles(claimedRoles ?? [])
  if (collected.size) {
    const role = collected.values().next().value as AppRole
    return { orgId, role, roles: Array.from(collected) }
  }

  const fetchRoles = async (supabaseClient: Client) => {
    try {
      const { data, error } = await supabaseClient
        .from('membership_roles')
        .select('role_id, roles(name)')
        .eq('user_id', userId)
        .eq('org_id', orgId)
      if (error) throw error
      const rows = (data ?? []) as Array<{
        role_id?: string | null
        roles?: { name?: string | null } | null
      }>
      return (
        rows
          .map((row) => {
          const roleName = row?.roles?.name ?? row?.role_id
          return typeof roleName === 'string' ? (roleName as AppRole) : null
          })
          .filter(Boolean) ?? []
      )
    } catch (error) {
      console.warn('requireOrgAdmin: failed to load membership roles', error)
      return []
    }
  }

  const candidates: AppRole[] = []

  const maybeAddFromClient = async (supabaseClient: Client | undefined) => {
    if (!supabaseClient) return
    const fetched = await fetchRoles(supabaseClient)
    fetched.forEach((role) => {
      if (role) {
        candidates.push(role)
        if (ADMIN_ROLE_SET.has(role)) collected.add(role)
      }
    })
  }

  await maybeAddFromClient(client)
  if (!collected.size) {
    await maybeAddFromClient(adminClient)
  }
  if (!collected.size && supabaseAdminMaybe && supabaseAdminMaybe !== client && supabaseAdminMaybe !== adminClient) {
    await maybeAddFromClient(supabaseAdminMaybe)
  }

  const adminRole = collected.values().next().value as AppRole | undefined
  if (!adminRole) throw new Error('ORG_FORBIDDEN')
  return { orgId, role: adminRole, roles: candidates.length ? candidates : Array.from(collected) }
}
