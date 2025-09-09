import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { z } from 'zod'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { bankAccountService } from '@/lib/bank-account-service'

const ImportSchema = z.object({
  buildiumBankId: z.coerce.number().int().positive(),
})

export async function POST(request: NextRequest) {
  try {
    await requireUser(request)
    const body = await request.json()
    const { buildiumBankId } = sanitizeAndValidate(body, ImportSchema)

    const result = await bankAccountService.importFromBuildium(buildiumBankId)

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const message = error instanceof Error ? error.message : 'Failed to import bank account from Buildium'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

