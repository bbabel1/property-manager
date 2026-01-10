import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/guards'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'
import { AllPermissions, type Permission } from '@/lib/permissions'
import type { Database } from '@/types/database'

type RoleRow = Database['public']['Tables']['roles']['Row']
type RolePermissionRow = Database['public']['Tables']['role_permissions']['Row'] & {
  permissions?: { key?: Permission | null } | null
}
type RoleWithPermissions = Pick<RoleRow, 'id' | 'org_id' | 'name' | 'description' | 'is_system'> & {
  role_permissions: RolePermissionRow[] | null
}
type RolePermissionInsert = Database['public']['Tables']['role_permissions']['Insert']

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
    await requireRole('platform_admin')
    const orgId = request.nextUrl.searchParams.get('org_id')
    const supabase = hasSupabaseAdmin() ? requireSupabaseAdmin('list permission profiles') : null
    if (!supabase) return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })

    const { data: profiles, error } = await supabase
      .from('roles')
      .select('id, org_id, name, description, is_system, role_permissions(permission_id, permissions(key))')
      .order('name', { ascending: true })
      .returns<RoleWithPermissions[]>()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const filtered = (profiles ?? []).filter((p) => !orgId || p.org_id === orgId || p.org_id === null)
    const mapped = filtered.map((p) => {
      const perms = (p.role_permissions ?? [])
        .map((row) => row?.permissions?.key)
        .filter((key): key is Permission => Boolean(key))
      return {
        id: p.id,
        org_id: p.org_id,
        name: p.name,
        description: p.description,
        is_system: !!p.is_system,
        permissions: Array.from(new Set(perms)),
      }
    })

    return NextResponse.json({ profiles: mapped })
  } catch (e: unknown) {
    const error = e as { message?: string }
    const msg = error?.message || 'Internal Server Error'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole('platform_admin')
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
    const profileRow: Database['public']['Tables']['roles']['Insert'] = {
      id: payload.id,
      org_id: payload.org_id ?? null,
      name: payload.name.trim(),
      description: payload.description?.trim() || null,
      is_system: payload.is_system ?? false,
      updated_at: now,
    }

    const { data: upserted, error: upsertError } = await supabase
      .from('roles')
      .upsert(profileRow, { onConflict: 'id' })
      .select('id')
      .maybeSingle()
    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    const profileId = payload.id || upserted?.id
    if (!profileId) {
      return NextResponse.json({ error: 'Failed to persist profile' }, { status: 500 })
    }

    await supabase.from('role_permissions').delete().eq('role_id', profileId)
    const permissionKeys = Array.from(new Set(payload.permissions))
    const { data: permissionRows, error: permissionFetchError } = await supabase
      .from('permissions')
      .select('id, key, org_id')
      .in('key', permissionKeys)
    if (permissionFetchError) {
      return NextResponse.json({ error: permissionFetchError.message }, { status: 500 })
    }
    const missing = permissionKeys.filter((key) => !permissionRows?.some((row) => row?.key === key))
    if (missing.length) {
      return NextResponse.json(
        { error: `Unknown permissions: ${missing.join(', ')}` },
        { status: 400 },
      )
    }

    const rows: RolePermissionInsert[] = []
    for (const perm of permissionRows ?? []) {
      if (!perm?.id) continue
      rows.push({
        role_id: profileId,
        permission_id: perm.id,
        updated_at: now,
        created_at: now,
      })
    }

    const { error: permError } = await supabase.from('role_permissions').insert(rows)
    if (permError) {
      return NextResponse.json({ error: permError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: profileId })
  } catch (e: unknown) {
    const error = e as { message?: string }
    const msg = error?.message || 'Internal Server Error'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
