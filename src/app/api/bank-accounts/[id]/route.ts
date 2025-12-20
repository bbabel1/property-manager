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
import { normalizeBankAccountType } from '@/lib/gl-bank-account-normalizers'

const BankAccountUpdateLocalSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  bankAccountType: z.string().optional(),
  accountNumber: z.string().optional(),
  routingNumber: z.string().optional(),
  isActive: z.boolean().optional(),
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
      .from('gl_accounts')
      .select(`
        id,
        buildium_bank_account_id,
        buildium_gl_account_id,
        name,
        description,
        bank_account_type,
        bank_account_number,
        bank_routing_number,
        bank_balance,
        bank_buildium_balance,
        is_active,
        bank_country,
        bank_check_printing_info,
        bank_electronic_payments,
        created_at,
        updated_at
      `)
      .eq('id', (await params).id)
      .eq('is_bank_account', true)
      .single()
    if (error) {
      if ((error as any).code === 'PGRST116') return NextResponse.json({ error: 'Bank account not found' }, { status: 404 })
      return NextResponse.json({ error: 'Failed to fetch bank account', details: error.message }, { status: 500 })
    }
    // Backwards-compatible response shape for older clients
    return NextResponse.json({
      id: (data as any).id,
      name: (data as any).name,
      description: (data as any).description,
      bank_account_type: (data as any).bank_account_type,
      account_number: (data as any).bank_account_number,
      routing_number: (data as any).bank_routing_number,
      buildium_bank_id: (data as any).buildium_bank_account_id,
      buildium_bank_account_id: (data as any).buildium_bank_account_id,
      buildium_gl_account_id: (data as any).buildium_gl_account_id,
      balance: (data as any).bank_balance,
      buildium_balance: (data as any).bank_buildium_balance,
      is_active: (data as any).is_active,
      country: (data as any).bank_country,
      check_printing_info: (data as any).bank_check_printing_info,
      electronic_payments: (data as any).bank_electronic_payments,
      created_at: (data as any).created_at,
      updated_at: (data as any).updated_at,
      gl_account: (data as any).id,
    })
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
    if (validated.bankAccountType !== undefined) toDb.bank_account_type = normalizeBankAccountType(validated.bankAccountType)
    if (validated.accountNumber !== undefined) toDb.bank_account_number = validated.accountNumber
    if (validated.routingNumber !== undefined) toDb.bank_routing_number = validated.routingNumber
    if (validated.isActive !== undefined) toDb.is_active = validated.isActive
    if (validated.balance !== undefined) toDb.bank_balance = validated.balance
    if (validated.checkPrintingInfo !== undefined) toDb.bank_check_printing_info = validated.checkPrintingInfo
    if (validated.electronicPayments !== undefined) toDb.bank_electronic_payments = validated.electronicPayments
    if (validated.country !== undefined) toDb.bank_country = validated.country

    // Always set bank_last_source to local for this update
    toDb.is_bank_account = true
    toDb.bank_last_source = 'local'
    toDb.bank_last_source_ts = now
    toDb.updated_at = now

    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Server not configured for bank account updates (service role missing)' }, { status: 501 })
    }
    const admin = requireSupabaseAdmin('bank accounts PUT')

    const { data: updated, error } = await admin
      .from('gl_accounts')
      .update(toDb)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update bank account', details: error.message }, { status: 500 })
    }

    // Optional two-way sync to Buildium
    if (syncToBuildium) {
      const syncPayload: any = {
        id: (updated as any).id,
        name: (updated as any).name,
        description: (updated as any).description,
        bank_account_type: (updated as any).bank_account_type,
        bank_account_number: (updated as any).bank_account_number,
        bank_routing_number: (updated as any).bank_routing_number,
        bank_country: (updated as any).bank_country,
        is_active: (updated as any).is_active ?? true,
        buildium_bank_account_id: (updated as any).buildium_bank_account_id,
        buildium_gl_account_id: (updated as any).buildium_gl_account_id,
      }

      const result = await buildiumEdgeClient.syncBankAccountToBuildium(syncPayload)
      if (!result.success) {
        const currentBuildiumId = (updated as any).buildium_bank_account_id ?? undefined
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

      if (!(updated as any).buildium_bank_account_id && result.buildiumId) {
        await admin
          .from('gl_accounts')
          .update({ buildium_bank_account_id: result.buildiumId, updated_at: new Date().toISOString() } as any)
          .eq('id', id)
      }

      const syncedBuildiumId = result.buildiumId ?? (updated as any).buildium_bank_account_id
      if (typeof syncedBuildiumId === 'number') {
        await admin.rpc('update_buildium_sync_status', {
          p_entity_type: 'bankAccount',
          p_entity_id: id,
          p_buildium_id: syncedBuildiumId,
          p_status: 'synced'
        })
      }
      return NextResponse.json({ success: true, data: { ...updated, buildium_bank_account_id: result.buildiumId || (updated as any).buildium_bank_account_id } })
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
