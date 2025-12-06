import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/guards'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'
import { AllPermissions, type Permission } from '@/lib/permissions'

const PayloadSchema = z.object({
  id: z.string().uuid().optional(),
  org_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  permissions: z.array(z.enum(AllPermissions as [Permission, ...Permission[]])).min(1, 'At least one permission is required'),
  is_system: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      await requireRole(['org_admin', 'platform_admin'])
    }
    const orgId = request.nextUrl.searchParams.get('org_id')
    const supabase = hasSupabaseAdmin() ? requireSupabaseAdmin('list permission profiles') : null
    if (!supabase) return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })

    const { data: profiles, error } = await supabase
      .from('permission_profiles')
      .select('id, org_id, name, description, is_system, permission_profile_permissions(permission)')
      .order('name', { ascending: true })
      .returns<any[]>()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const filtered = (profiles || []).filter((p) => !orgId || p.org_id === orgId || p.org_id === null)
    const mapped = filtered.map((p) => ({
      id: p.id,
      org_id: p.org_id,
      name: p.name,
      description: p.description,
      is_system: !!p.is_system,
      permissions: Array.from(new Set((p.permission_profile_permissions || []).map((row: any) => row.permission).filter(Boolean))),
    }))

    return NextResponse.json({ profiles: mapped })
  } catch (e: any) {
    const msg = e?.message || 'Internal Server Error'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['org_admin', 'platform_admin'])
    const supabase = hasSupabaseAdmin() ? requireSupabaseAdmin('upsert permission profiles') : null
    if (!supabase) return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })

    const body = await request.json().catch(() => ({}))
    const parsed = PayloadSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join('\n') || 'Invalid payload'
      return NextResponse.json({ error: message }, { status: 400 })
    }
    const payload = parsed.data
    const now = new Date().toISOString()
    const profileRow = {
      id: payload.id,
      org_id: payload.org_id ?? null,
      name: payload.name.trim(),
      description: payload.description?.trim() || null,
      is_system: payload.is_system ?? false,
      updated_at: now,
    } as any

    const { data: upserted, error: upsertError } = await supabase
      .from('permission_profiles')
      .upsert(profileRow, { onConflict: 'id' })
      .select('id')
      .maybeSingle()
    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    const profileId = payload.id || (upserted as any)?.id
    if (!profileId) {
      return NextResponse.json({ error: 'Failed to persist profile' }, { status: 500 })
    }

    await supabase.from('permission_profile_permissions').delete().eq('profile_id', profileId)
    const rows = payload.permissions.map((p) => ({
      profile_id: profileId,
      permission: p,
      updated_at: now,
    }))
    const { error: permError } = await supabase.from('permission_profile_permissions').insert(rows)
    if (permError) {
      return NextResponse.json({ error: permError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: profileId })
  } catch (e: any) {
    const msg = e?.message || 'Internal Server Error'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
