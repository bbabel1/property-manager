import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { getServerSupabaseClient } from '@/lib/supabase-client'
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard'

type StaffSyncInvokeResult = {
  success?: boolean
  data?: unknown
  message?: string
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    await requireRole('platform_admin')
    const guard = await getBuildiumOrgIdOr403(request)
    if ('response' in guard) return guard.response
    const { orgId } = guard
    const supabase = getServerSupabaseClient()
    const invokeResult: { data: StaffSyncInvokeResult | null; error: unknown } =
      await supabase.functions.invoke<StaffSyncInvokeResult>('buildium-staff-sync', {
        body: { mode: 'manual', orgId },
      })
    const invokeError = invokeResult.error as { message?: unknown } | null
    if (invokeError) {
      const message =
        typeof invokeError.message === 'string' && invokeError.message.trim()
          ? invokeError.message
          : 'Invoke failed'
      return NextResponse.json({ error: message }, { status: 500 })
    }
    const payload: StaffSyncInvokeResult = invokeResult.data ?? {}
    return NextResponse.json({ success: true, data: payload })
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  // Latest run status helper (require auth; use admin to bypass RLS)
  try {
    await requireRole('platform_admin')
    const guard = await getBuildiumOrgIdOr403(request)
    if ('response' in guard) return guard.response
    const client = getServerSupabaseClient()
    const { data, error } = await client
      .from('buildium_sync_runs')
      .select('*')
      .eq('job_type', 'staff_sync')
      .order('started_at', { ascending: false })
      .limit(1)
    if (error) return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
    return NextResponse.json({ last: Array.isArray(data) ? data[0] : null })
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    return NextResponse.json({ last: null })
  }
}
