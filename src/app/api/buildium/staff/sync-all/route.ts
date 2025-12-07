import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { getServerSupabaseClient } from '@/lib/supabase-client'

export async function POST(request: NextRequest) {
  try {
    await requireRole('platform_admin')
    const supabase = getServerSupabaseClient()
    const { data, error } = await supabase.functions.invoke('buildium-staff-sync', { body: { mode: 'manual' } })
    if (error) return NextResponse.json({ error: error.message || 'Invoke failed' }, { status: 500 })
    return NextResponse.json({ success: true, data })
  } catch (e:any) {
    if (e?.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  // Latest run status helper (require auth; use admin to bypass RLS)
  try {
    await requireRole('platform_admin')
    const client = getServerSupabaseClient()
    const { data, error } = await client
      .from('buildium_sync_runs')
      .select('*')
      .eq('job_type', 'staff_sync')
      .order('started_at', { ascending: false })
      .limit(1)
    if (error) return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
    return NextResponse.json({ last: Array.isArray(data) ? data[0] : null })
  } catch (e: any) {
    if (e?.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    return NextResponse.json({ last: null })
  }
}
