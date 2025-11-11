import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request)
    const bankAccountId = (await params).id
    logger.info({ userId: user.id, bankAccountId, action: 'get_buildium_reconciliations_by_bank' }, 'Fetching Buildium reconciliations by bank account')

    const response = await fetch(`https://apisandbox.buildium.com/v1/bankaccounts/${bankAccountId}/reconciliations`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    })

    if (!response.ok) {
      const body = await response.text()
      logger.error({ status: response.status, body }, 'Buildium reconciliations by bank failed')
      return NextResponse.json({ error: 'Failed to fetch reconciliations' }, { status: response.status })
    }

    const rows = await response.json()
    return NextResponse.json({ success: true, data: rows, count: Array.isArray(rows) ? rows.length : 0 })
  } catch (error) {
    logger.error({ error, bankAccountId: (await params).id }, 'Error fetching reconciliations by bank account')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
