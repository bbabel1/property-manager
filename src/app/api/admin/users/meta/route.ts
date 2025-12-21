import { NextRequest, NextResponse } from 'next/server'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'
import { requireRole } from '@/lib/auth/guards'
import type { Database } from '@/types/database'

type StaffRole = Database['public']['Enums']['staff_roles']

const DEFAULT_STAFF_ROLE: StaffRole = 'Bookkeeper'

async function ensureStaffRecord(userId: string) {
  const admin = requireSupabaseAdmin('ensure staff for user meta')

  const { data: existing, error: fetchErr } = await admin
    .from('staff')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing?.id) return { ok: true as const }
  if (fetchErr && fetchErr.code !== 'PGRST116') {
    return { ok: false as const, error: fetchErr.message }
  }

  // Pull contact details when available to prefill staff profile
  let contactEmail: string | null = null
  let contactFirst: string | null = null
  let contactLast: string | null = null
  let contactPhone: string | null = null
  try {
    const { data: contact } = await admin
      .from('contacts')
      .select('first_name,last_name,primary_phone:primary_phone,primary_email:primary_email')
      .eq('user_id', userId)
      .maybeSingle()
    if (contact) {
      contactFirst = contact.first_name ?? null
      contactLast = contact.last_name ?? null
      contactPhone = (contact as any)?.primary_phone ?? null
      contactEmail = (contact as any)?.primary_email ?? null
    }
  } catch (err) {
    console.warn('Failed to load contact while auto-provisioning staff', err)
  }

  // Derive a reasonable staff role from membership roles
  let resolvedRole: StaffRole = DEFAULT_STAFF_ROLE
  try {
    const { data: membershipRoles } = await admin
      .from('membership_roles')
      .select('roles(name)')
      .eq('user_id', userId)
    const roleSet = new Set((membershipRoles || []).map((r: any) => r?.roles?.name).filter(Boolean))
    if (roleSet.has('org_admin')) resolvedRole = 'Administrator'
    else if (roleSet.has('org_manager')) resolvedRole = 'Property Manager'
    else if (roleSet.has('org_staff')) resolvedRole = 'Bookkeeper'
  } catch (err) {
    console.warn('Failed to derive staff role; defaulting to Bookkeeper', err)
  }

  // Fallback to auth email when contact is missing
  let userEmail: string | null = contactEmail
  try {
    const { data: authUser } = await admin.auth.admin.getUserById(userId)
    userEmail = userEmail || authUser?.user?.email || null
  } catch (err) {
    console.warn('Failed to load auth user while creating staff record', err)
  }

  const now = new Date().toISOString()
  const { error: insertErr } = await admin.from('staff').insert({
    user_id: userId,
    email: userEmail,
    first_name: contactFirst,
    last_name: contactLast,
    phone: contactPhone,
    role: resolvedRole,
    is_active: true,
    created_at: now,
    updated_at: now,
  })

  if (insertErr) {
    return { ok: false as const, error: insertErr.message }
  }

  return { ok: true as const }
}

const USER_TYPES = new Set(['staff', 'rental_owner', 'vendor'])

export async function POST(request: NextRequest) {
  try {
    await requireRole('org_admin')
    const body = await request.json().catch(() => ({}))
    const user_id = typeof body?.user_id === 'string' ? body.user_id : null
    const platform_developer = body?.platform_developer === true
    const user_types_raw = Array.isArray(body?.user_types) ? body.user_types : []
    const user_types = Array.from(
      new Set(
        user_types_raw
          .map((v: any) => (typeof v === 'string' ? v.trim().toLowerCase() : ''))
          .filter((v: string) => USER_TYPES.has(v))
      )
    )

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })
    }

    const supabaseAdmin = requireSupabaseAdmin('update user metadata')
    const appMetadata: Record<string, any> = {
      user_types: user_types,
    }
    if (platform_developer) {
      appMetadata.roles = ['platform_admin']
      appMetadata.claims = { roles: ['platform_admin'] }
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      app_metadata: appMetadata,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (user_types.includes('staff')) {
      const ensured = await ensureStaffRecord(user_id)
      if (!ensured.ok) {
        return NextResponse.json({ error: ensured.error || 'Failed to create staff record' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, app_metadata: appMetadata })
  } catch (e: any) {
    if (e?.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    if (e?.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
