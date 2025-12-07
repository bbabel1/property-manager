import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'
import { requireRole } from '@/lib/auth/guards'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateMembershipChange } from '@/lib/auth/membership-authz'

const RoleEnum = z.enum([
  'platform_admin',
  'org_admin',
  'org_manager',
  'org_staff',
  'owner_portal',
  'tenant_portal',
  'vendor_portal',
])

const UpsertSchema = z.object({
  user_id: z.string().min(1, 'user_id is required'),
  org_id: z.string().min(1, 'org_id is required'),
  role: RoleEnum,
})

const DeleteSchema = z.object({
  user_id: z.string().min(1, 'user_id is required'),
  org_id: z.string().min(1, 'org_id is required'),
})

// POST /api/admin/memberships/simple
// Body: { user_id, org_id, role }
export async function POST(request: NextRequest) {
  try {
    if (process.env.DISABLE_MEMBERSHIP_APIS === 'true') {
      return NextResponse.json({ error: 'Membership maintenance in progress' }, { status: 503 })
    }

    const rateLimit = await checkRateLimit(request, 'api')
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests', retryAfter: rateLimit.retryAfter }, { status: 429 })
    }

    const { supabase, user, roles: callerRoles } = await requireRole('org_admin')
    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })
    }
    const admin = requireSupabaseAdmin('upsert membership')
    const body = await request.json().catch(() => ({}))
    const parsed = UpsertSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join('\n') || 'Invalid payload'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { user_id, org_id, role } = parsed.data

    const { data: membership, error: membershipError } = await supabase
      .from('org_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', org_id)
      .maybeSingle()
    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 500 })
    }
    const validation = validateMembershipChange({
      callerOrgRole: membership?.role as any,
      callerGlobalRoles: callerRoles,
      requestedRoles: [role],
    })
    if (!validation.ok) {
      const message =
        validation.reason === 'platform_admin_required'
          ? 'Only platform_admin can grant platform_admin'
          : validation.reason === 'no_roles_provided'
            ? 'No valid roles provided'
            : 'Not authorized for this organization'
      const status = validation.reason === 'no_roles_provided' ? 400 : 403
      return NextResponse.json({ error: message }, { status })
    }

    const { error } = await admin
      .from('org_memberships')
      .upsert({ user_id, org_id, role }, { onConflict: 'user_id,org_id' })

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to upsert membership' }, { status: 500 })
    }

    // Persist full role set (single role for this endpoint) to multi-role table
    try {
      await admin.from('org_membership_roles').delete().eq('user_id', user_id).eq('org_id', org_id)
      await admin.from('org_membership_roles').insert({ user_id, org_id, role })
    } catch (rolesError) {
      console.warn('Failed to sync org_membership_roles for simple upsert', rolesError)
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    const msg = e?.message || 'Internal Server Error'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

// DELETE /api/admin/memberships/simple
// Body: { user_id, org_id }
export async function DELETE(request: NextRequest) {
  try {
    if (process.env.DISABLE_MEMBERSHIP_APIS === 'true') {
      return NextResponse.json({ error: 'Membership maintenance in progress' }, { status: 503 })
    }
    const rateLimit = await checkRateLimit(request, 'api')
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests', retryAfter: rateLimit.retryAfter }, { status: 429 })
    }
    const { supabase, user, roles: callerRoles } = await requireRole('org_admin')
    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })
    }
    const admin = requireSupabaseAdmin('delete membership')
    const body = await request.json().catch(() => ({}))
    const parsed = DeleteSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join('\n') || 'Invalid payload'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { user_id, org_id } = parsed.data

    const { data: membership, error: membershipError } = await supabase
      .from('org_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', org_id)
      .maybeSingle()
    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 500 })
    }
    const validation = validateMembershipChange({
      callerOrgRole: membership?.role as any,
      callerGlobalRoles: callerRoles,
      requestedRoles: ['org_staff'], // placeholder to satisfy guard
    })
    if (!validation.ok && validation.reason !== 'no_roles_provided') {
      return NextResponse.json({ error: 'Not authorized for this organization' }, { status: 403 })
    }

    const { error } = await admin
      .from('org_memberships')
      .delete()
      .eq('user_id', user_id)
      .eq('org_id', org_id)

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to delete membership' }, { status: 500 })
    }

    try {
      await admin
        .from('org_membership_roles')
        .delete()
        .eq('user_id', user_id)
        .eq('org_id', org_id)
    } catch (rolesError) {
      console.warn('Failed to delete org_membership_roles for membership removal', rolesError)
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    const msg = e?.message || 'Internal Server Error'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
