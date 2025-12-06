import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'
import { requireRole } from '@/lib/auth/guards'

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
    // Enforce admin in production, relaxed in dev for bootstrap similar to other endpoints
    if (process.env.NODE_ENV === 'production') {
      await requireRole('org_admin')
    }
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
    if (process.env.NODE_ENV === 'production') {
      await requireRole('org_admin')
    }
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
