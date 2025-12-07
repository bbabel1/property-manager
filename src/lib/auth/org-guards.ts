import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { AppRole } from '@/lib/auth/roles'

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
}) {
  const { client, userId, orgId } = params
  const { data, error } = await client
    .from('org_memberships')
    .select('role')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const role = data?.role as AppRole | undefined
  if (!role || !['org_admin', 'org_manager', 'platform_admin'].includes(role)) {
    throw new Error('ORG_FORBIDDEN')
  }
  return { orgId, role }
}
