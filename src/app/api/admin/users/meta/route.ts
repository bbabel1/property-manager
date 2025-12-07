import { NextRequest, NextResponse } from 'next/server'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'
import { requireRole } from '@/lib/auth/guards'

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

    return NextResponse.json({ success: true, app_metadata: appMetadata })
  } catch (e: any) {
    if (e?.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    if (e?.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
