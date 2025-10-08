import { NextRequest, NextResponse } from 'next/server'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'
import { requireRole } from '@/lib/auth/guards'

// Update a user's email address
// Body: { user_id: string, email: string }
export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      await requireRole('org_admin')
    }

    const body = await request.json().catch(() => null)
    if (!body || !body.user_id || !body.email) {
      return NextResponse.json({ error: 'user_id and email are required' }, { status: 400 })
    }
    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Server not configured with service role' }, { status: 500 })
    }

    const { user_id, email } = body
    const supabaseAdmin = requireSupabaseAdmin('admin update email')

    // Update the user's email in auth.users
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      email: email
    })

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
