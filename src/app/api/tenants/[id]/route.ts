import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { requireAuth } from '@/lib/auth/guards'
import { resolveResourceOrg, requireOrgAdmin } from '@/lib/auth/org-guards'
import { getOrgScopedBuildiumEdgeClient } from '@/lib/buildium-edge-client'

type AllowedTenantFields =
  | 'tax_id'
  | 'comment'
  | 'emergency_contact_name'
  | 'emergency_contact_email'
  | 'emergency_contact_phone'
  | 'emergency_contact_relationship'

const ALLOWED_FIELDS: AllowedTenantFields[] = [
  'tax_id',
  'comment',
  'emergency_contact_name',
  'emergency_contact_email',
  'emergency_contact_phone',
  'emergency_contact_relationship'
]

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    const { id } = await params

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing tenant id' }, { status: 400 })
    }

    // Resolve org and enforce admin-level access for writes
    const resolvedOrg = await resolveResourceOrg(auth.supabase, 'tenant', id)
    if (!resolvedOrg.ok) {
      return NextResponse.json({ success: false, error: resolvedOrg.error }, { status: 404 })
    }
    await requireOrgAdmin({ client: auth.supabase, userId: auth.user.id, orgId: resolvedOrg.orgId })

    const payload = (await request.json()) as Record<string, unknown>
    const updates: Record<string, unknown> = {}

    for (const field of ALLOWED_FIELDS) {
      if (field in payload) {
        const value = payload[field]
        updates[field] = value ?? null
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields provided' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const { data: updatedTenant, error } = await supabaseAdmin
      .from('tenants')
      .update(updates)
      .eq('id', id)
      .eq('org_id', resolvedOrg.orgId)
      .select('id, buildium_tenant_id, tax_id, comment, emergency_contact_name, emergency_contact_email, emergency_contact_phone, emergency_contact_relationship')
      .maybeSingle()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    let buildiumSyncError: string | null = null
    if (updatedTenant?.buildium_tenant_id) {
      const buildiumPayload: Record<string, unknown> = {
        TaxId: updates.tax_id ?? updatedTenant.tax_id ?? undefined,
        Comment: updates.comment ?? updatedTenant.comment ?? undefined
      }
      const emergencyContact: Record<string, unknown> = {
        Name: updates.emergency_contact_name ?? updatedTenant.emergency_contact_name ?? undefined,
        Email: updates.emergency_contact_email ?? updatedTenant.emergency_contact_email ?? undefined,
        Phone: updates.emergency_contact_phone ?? updatedTenant.emergency_contact_phone ?? undefined,
        RelationshipDescription:
          updates.emergency_contact_relationship ?? updatedTenant.emergency_contact_relationship ?? undefined
      }
      const clean = (obj: Record<string, unknown>) =>
        Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== ''))
      const contactClean = clean(emergencyContact)
      if (Object.keys(contactClean).length) buildiumPayload.EmergencyContact = contactClean
      const payloadClean = clean(buildiumPayload)

      if (Object.keys(payloadClean).length) {
        // Use org-scoped client for Buildium sync
        const edgeClient = await getOrgScopedBuildiumEdgeClient(resolvedOrg.orgId);
        const res = await edgeClient.updateTenantInBuildium(
          Number(updatedTenant.buildium_tenant_id),
          payloadClean
        )
        if (!res.success) {
          buildiumSyncError = res.error || 'Failed to sync tenant to Buildium'
        }
      }
    }

    return NextResponse.json(
      { success: true, buildium_sync_error: buildiumSyncError || undefined },
      { status: buildiumSyncError ? 422 : 200 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
