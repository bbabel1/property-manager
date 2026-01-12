import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { buildiumFetch } from '@/lib/buildium-http'
import { requireSupabaseAdmin } from '@/lib/supabase-client'
import { upsertBillWithLines } from '@/lib/buildium-mappers'
import type { BuildiumBillWithLines } from '@/types/buildium'
import { requireBuildiumEnabledOr403 } from '@/lib/buildium-route-guard'
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id'

// POST /api/buildium/bills/[id]/sync
// Fetch a single bill from Buildium by Id and persist to DB
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const { user } = await requireRole('platform_admin')
    const billId = (await params).id
    if (!billId) return NextResponse.json({ error: 'Missing billId' }, { status: 400 })

    const orgIdResult = await requireBuildiumEnabledOr403(request)
    if (orgIdResult instanceof NextResponse) return orgIdResult
    const orgId = orgIdResult

    const response = await buildiumFetch('GET', `/bills/${billId}`, undefined, undefined, orgId)
    if (!response.ok) {
      const details = response.json ?? {}
      return NextResponse.json({ error: 'Failed to fetch bill from Buildium', details }, { status: response.status })
    }

    const bill = (response.json ?? {}) as BuildiumBillWithLines
    const supabaseAdmin = requireSupabaseAdmin('sync bill from Buildium')
    const { transactionId } = await upsertBillWithLines(bill, supabaseAdmin, orgId)
    return NextResponse.json({ success: true, transactionId })
  } catch (error) {
    logger.error({ error }, 'Error syncing bill by ID from Buildium')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
