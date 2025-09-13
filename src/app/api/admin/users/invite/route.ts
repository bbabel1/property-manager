import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { requireRole } from '@/lib/auth/guards'

// Invite a new user to the platform
// Body: { email: string, org_id?: string, roles?: string[] }
export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      await requireRole('org_admin')
    }

    const body = await request.json().catch(() => null)
    if (!body || !body.email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured with service role' }, { status: 500 })
    }

    const { email, org_id, roles = ['org_staff'] } = body

    // Check if user already exists
    const { data: existingUser, error: userError } = await supabaseAdmin.auth.admin.getUserByEmail(email)
    
    if (userError && userError.message !== 'User not found') {
      return NextResponse.json({ error: userError.message }, { status: 500 })
    }

    let userId: string

    if (existingUser?.user) {
      // User exists, use their ID
      userId = existingUser.user.id
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        email_confirm: true, // Auto-confirm for admin invites
        user_metadata: {
          invited_by_admin: true
        }
      })

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 })
      }

      userId = newUser.user.id
    }

    // If org_id and roles are provided, create memberships
    if (org_id && roles.length > 0) {
      const memberships = roles.map(role => ({
        user_id: userId,
        org_id: org_id,
        role: role
      }))

      const { error: membershipError } = await supabaseAdmin
        .from('org_memberships')
        .insert(memberships)

      if (membershipError) {
        return NextResponse.json({ error: membershipError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: { 
        user_id: userId, 
        email: email,
        created: !existingUser?.user 
      } 
    })
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'Internal Server Error'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}