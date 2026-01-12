import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/db'

export async function GET(request: Request) {
  try {
    await requireRole('platform_admin')
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 403 })
  }

  const url = new URL(request.url)
  const orgId = url.searchParams.get('orgId')
  const limitParam = Number(url.searchParams.get('limit') || '200')
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 200

  const warningsQuery = supabaseAdmin.from('v_udf_warnings').select('*').limit(limit)
  const paymentsQuery = supabaseAdmin.from('v_undeposited_payments').select('*').limit(limit)

  if (orgId) {
    warningsQuery.eq('org_id', orgId)
    paymentsQuery.eq('org_id', orgId)
  }

  const [{ data: warnings, error: warnErr }, { data: payments, error: payErr }] = await Promise.all([
    warningsQuery,
    paymentsQuery,
  ])

  if (warnErr) {
    return NextResponse.json({ error: warnErr.message }, { status: 500 })
  }
  if (payErr) {
    return NextResponse.json({ error: payErr.message }, { status: 500 })
  }

  return NextResponse.json({ data: { warnings: warnings ?? [], payments: payments ?? [] } })
}
