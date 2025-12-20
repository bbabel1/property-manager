import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { z } from 'zod'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { supabaseAdmin } from '@/lib/db'
import { resolveBankGlAccountId } from '@/lib/buildium-mappers'

const ImportSchema = z.object({
  buildiumBankId: z.coerce.number().int().positive(),
})

export async function POST(request: NextRequest) {
  try {
    await requireUser(request)
    const body = await request.json()
    const { buildiumBankId } = sanitizeAndValidate(body, ImportSchema)

    const glAccountId = await resolveBankGlAccountId(buildiumBankId, supabaseAdmin as any)
    if (!glAccountId) {
      return NextResponse.json({ success: false, error: 'Unable to resolve bank GL account from Buildium' }, { status: 422 })
    }

    const { data: glRow, error: glErr } = await supabaseAdmin
      .from('gl_accounts')
      .select('id, name, buildium_bank_account_id, buildium_gl_account_id, bank_account_type, bank_account_number, bank_routing_number, bank_country, updated_at')
      .eq('id', glAccountId)
      .maybeSingle()

    if (glErr) {
      return NextResponse.json({ success: true, mode: 'synced', glAccountId, data: null })
    }

    return NextResponse.json({ success: true, mode: 'synced', glAccountId, data: glRow })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const message = error instanceof Error ? error.message : 'Failed to import bank account from Buildium'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
