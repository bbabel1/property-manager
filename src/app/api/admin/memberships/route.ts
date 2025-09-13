import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { requireRole } from '@/lib/auth/guards'

// Assign or update a user's role within an org
// Body: { user_id: string, org_id: string, role: 'platform_admin'|'org_admin'|'org_manager'|'org_staff'|'owner_portal'|'tenant_portal' }
export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      await requireRole('org_admin')
    }

    const body = await request.json().catch(() => null)
    if (!body || !body.user_id || !body.org_id || !body.role) {
      return NextResponse.json({ error: 'user_id, org_id and role are required' }, { status: 400 })
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured with service role' }, { status: 500 })
    }

    const { data, error } = await supabaseAdmin
      .from('org_memberships')
      .upsert(
        { user_id: body.user_id, org_id: body.org_id, role: body.role },
        { onConflict: 'user_id,org_id' }
      )
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'Internal Server Error'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
