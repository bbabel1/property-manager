import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { buildiumFetch } from '@/lib/buildium-http'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireRole('platform_admin')
    const bankAccountId = (await params).id
    logger.info({ userId: user.id, bankAccountId, action: 'get_buildium_reconciliations_by_bank' }, 'Fetching Buildium reconciliations by bank account')

    const response = await buildiumFetch('GET', `/bankaccounts/${bankAccountId}/reconciliations`, undefined, undefined, undefined)

    if (!response.ok) {
      logger.error({ status: response.status }, 'Buildium reconciliations by bank failed')
      return NextResponse.json({ error: 'Failed to fetch reconciliations' }, { status: response.status })
    }

    const rows = (response.json ?? []) as unknown[]
    return NextResponse.json({ success: true, data: rows, count: Array.isArray(rows) ? rows.length : 0 })
  } catch (error) {
    logger.error({ error, bankAccountId: (await params).id }, 'Error fetching reconciliations by bank account')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
