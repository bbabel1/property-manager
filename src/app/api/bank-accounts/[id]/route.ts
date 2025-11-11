import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import {
  getServerSupabaseClient,
  hasSupabaseAdmin,
  requireSupabaseAdmin,
  SupabaseAdminUnavailableError,
} from '@/lib/supabase-client'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { z } from 'zod'
import { buildiumEdgeClient } from '@/lib/buildium-edge-client'

const BankAccountUpdateLocalSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  bankAccountType: z.string().optional(),
  accountNumber: z.string().optional(),
  routingNumber: z.string().optional(),
  isActive: z.boolean().optional(),
  glAccountId: z.string().uuid().optional(),
  balance: z.number().optional(),
  checkPrintingInfo: z.any().optional(),
  electronicPayments: z.any().optional(),
  country: z.string().optional(),
  syncToBuildium: z.boolean().optional().default(false)
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(request)
    const client = getServerSupabaseClient()
    const { data, error } = await client
      .from('bank_accounts')
      .select(`
        id,
        buildium_bank_id,
        name,
        description,
        bank_account_type,
        account_number,
        routing_number,
        gl_account,
        balance,
        buildium_balance,
        is_active,
        country,
        created_at,
        updated_at
      `)
      .eq('id', (await params).id)
      .single()
    if (error) {
      if ((error as any).code === 'PGRST116') return NextResponse.json({ error: 'Bank account not found' }, { status: 404 })
      return NextResponse.json({ error: 'Failed to fetch bank account', details: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to fetch bank account' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request)
    const id = (await params).id

    // Support query param override for sync
    const url = new URL(request.url)
    const syncQuery = url.searchParams.get('syncToBuildium')
    const body = await request.json()
    const validated = sanitizeAndValidate(body, BankAccountUpdateLocalSchema)
    const syncToBuildium = syncQuery ? syncQuery === 'true' : validated.syncToBuildium

    const now = new Date().toISOString()

    // Prepare DB update payload
    const toDb: any = {}
    if (validated.name !== undefined) toDb.name = validated.name
    if (validated.description !== undefined) toDb.description = validated.description
    if (validated.bankAccountType !== undefined) toDb.bank_account_type = normalizedType(validated.bankAccountType)
    if (validated.accountNumber !== undefined) toDb.account_number = validated.accountNumber
    if (validated.routingNumber !== undefined) toDb.routing_number = validated.routingNumber
    if (validated.isActive !== undefined) toDb.is_active = validated.isActive
    if (validated.glAccountId !== undefined) toDb.gl_account = validated.glAccountId
    if (validated.balance !== undefined) toDb.balance = validated.balance
    if (validated.checkPrintingInfo !== undefined) toDb.check_printing_info = validated.checkPrintingInfo
    if (validated.electronicPayments !== undefined) toDb.electronic_payments = validated.electronicPayments
    if (validated.country !== undefined) toDb.country = validated.country

    // always set last_source to local for this update
    toDb.last_source = 'local'
    toDb.last_source_ts = now
    toDb.updated_at = now

    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Server not configured for bank account updates (service role missing)' }, { status: 501 })
    }
    const admin = requireSupabaseAdmin('bank accounts PUT')

    const { data: updated, error } = await admin
      .from('bank_accounts')
      .update(toDb)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update bank account', details: error.message }, { status: 500 })
    }

    // Optional two-way sync to Buildium
    if (syncToBuildium) {
      // Enrich with GLAccountId when available
      let syncPayload: any = { ...updated }
      try {
        if (updated.gl_account) {
          const { data: gl } = await admin
            .from('gl_accounts')
            .select('buildium_gl_account_id')
            .eq('id', updated.gl_account)
            .maybeSingle()
          const glId = gl?.buildium_gl_account_id
          if (typeof glId === 'number' && glId > 0) syncPayload = { ...syncPayload, GLAccountId: glId }
        }
      } catch {}
      const result = await buildiumEdgeClient.syncBankAccountToBuildium(syncPayload)
      if (!result.success) {
        const currentBuildiumId = updated.buildium_bank_id ?? undefined
        if (typeof currentBuildiumId === 'number') {
          await admin.rpc('update_buildium_sync_status', {
            p_entity_type: 'bankAccount',
            p_entity_id: id,
            p_buildium_id: currentBuildiumId,
            p_status: 'failed',
            p_error_message: result.error || 'Unknown error'
          })
        }
        return NextResponse.json({ success: true, data: updated, buildiumSync: { success: false, error: result.error } })
      }

      if (!updated.buildium_bank_id && result.buildiumId) {
        await admin.from('bank_accounts').update({ buildium_bank_id: result.buildiumId, updated_at: new Date().toISOString() }).eq('id', id)
      }

      const syncedBuildiumId = result.buildiumId ?? updated.buildium_bank_id
      if (typeof syncedBuildiumId === 'number') {
        await admin.rpc('update_buildium_sync_status', {
          p_entity_type: 'bankAccount',
          p_entity_id: id,
          p_buildium_id: syncedBuildiumId,
          p_status: 'synced'
        })
      }
      return NextResponse.json({ success: true, data: { ...updated, buildium_bank_id: result.buildiumId || updated.buildium_bank_id } })
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    if (error instanceof SupabaseAdminUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 501 })
    }
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to update bank account' }, { status: 500 })
  }
}

function normalizedType(t?: string): string | undefined {
  if (!t) return undefined
  const lc = t.toLowerCase()
  if (lc === 'money_market' || lc === 'moneymarket') return 'money_market'
  if (lc === 'certificate_of_deposit' || lc === 'certificateofdeposit') return 'certificate_of_deposit'
  if (lc === 'savings') return 'savings'
  return 'checking'
}
