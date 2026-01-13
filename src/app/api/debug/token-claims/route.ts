import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Debug endpoint to check JWT token claims
 * GET /api/debug/token-claims
 * 
 * Returns the decoded JWT payload from the current session
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Missing Supabase configuration' }, { status: 500 })
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {},
      },
    })

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session?.access_token) {
      return NextResponse.json(
        { error: 'No active session', details: sessionError?.message },
        { status: 401 },
      )
    }

    // Decode JWT payload (middle section of JWT: header.payload.signature)
    try {
      const payload = JSON.parse(
        Buffer.from(session.access_token.split('.')[1] || '', 'base64').toString('utf-8'),
      )

      return NextResponse.json({
        success: true,
        tokenInfo: {
          user_id: payload.sub,
          email: payload.email,
          exp: payload.exp,
          exp_date: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
          org_ids: payload.org_ids || null,
          roles: payload.roles || null,
          // Include full payload for inspection
          full_payload: payload,
        },
      })
    } catch (decodeError) {
      return NextResponse.json(
        { error: 'Failed to decode token', details: String(decodeError) },
        { status: 500 },
      )
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

