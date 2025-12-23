// deno-lint-ignore-file
export type LeaseOrgLookupResult = { id: number; org_id: string | null }

// Resolve local lease id and org, falling back to property org when the lease row has a null org_id.
export async function resolveLeaseWithOrg(
  supabase: any,
  buildiumLeaseId: number | null | undefined
): Promise<LeaseOrgLookupResult | null> {
  if (!buildiumLeaseId) return null

  const { data, error } = await supabase
    .from('lease')
    .select('id, org_id, property_id')
    .eq('buildium_lease_id', buildiumLeaseId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  if (!data) return null

  let orgId = data.org_id ?? null

  // Fallback: if lease.org_id is missing, attempt to pull org from the linked property.
  if (!orgId && data.property_id) {
    const { data: property, error: propErr } = await supabase
      .from('properties')
      .select('org_id')
      .eq('id', data.property_id)
      .single()
    if (propErr && propErr.code !== 'PGRST116') throw propErr
    orgId = property?.org_id ?? null
  }

  return { id: data.id, org_id: orgId }
}
