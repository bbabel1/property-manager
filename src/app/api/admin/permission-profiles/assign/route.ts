import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/guards'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'

const Schema = z.object({
  user_id: z.string().uuid(),
  org_id: z.string().uuid(),
  profile_id: z.string().uuid().nullable().optional(),
})

export async function POST(request: NextRequest) {
  try {
    await requireRole(['org_admin', 'platform_admin'])
    const supabase = hasSupabaseAdmin() ? requireSupabaseAdmin('assign permission profile') : null
    if (!supabase) return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })

    const body = await request.json().catch(() => ({}))
    const parsed = Schema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join('\n') || 'Invalid payload'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { user_id, org_id, profile_id } = parsed.data
    await supabase.from('membership_roles').delete().eq('user_id', user_id).eq('org_id', org_id)
    if (profile_id) {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('membership_roles')
        .insert({ user_id, org_id, role_id: profile_id, created_at: now, updated_at: now })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const error = e as { message?: string }
    const msg = error?.message || 'Internal Server Error'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
