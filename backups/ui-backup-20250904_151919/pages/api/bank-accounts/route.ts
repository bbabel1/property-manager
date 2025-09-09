import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { supabase } from '@/lib/db'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { BankAccountQuerySchema } from '@/schemas/bank-account'
import { z } from 'zod'
import { buildiumEdgeClient } from '@/lib/buildium-edge-client'
import { bankAccountService } from '@/lib/bank-account-service'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const query = sanitizeAndValidate(Object.fromEntries(searchParams), BankAccountQuerySchema);
    console.log('Bank Accounts API: Validated query parameters:', query);

    // Check if sync is requested
    const syncFromBuildium = searchParams.get('syncFromBuildium') === 'true'
    
    if (syncFromBuildium) {
      console.log('Bank Accounts API: Syncing from Buildium requested')
      
      // Sync bank accounts from Buildium first
      const syncResult = await buildiumEdgeClient.syncBankAccountsFromBuildium()
      
      if (!syncResult.success) {
        console.error('Failed to sync bank accounts from Buildium:', syncResult.error)
        return NextResponse.json(
          { error: 'Failed to sync bank accounts from Buildium', details: syncResult.error },
          { status: 500 }
        )
      }
      
      console.log('Bank Accounts API: Sync completed successfully')
    }

    const list = await bankAccountService.list({
      limit: query.limit,
      offset: query.offset,
      bankAccountType: query.bankAccountType || undefined,
      isActive: typeof query.isActive === 'boolean' ? query.isActive : undefined,
      search: query.search || undefined
    })

    // Mask sensitive numbers by default
    const reveal = searchParams.get('revealNumbers') === 'true'
    const masked = list.map((a: any) => {
      if (reveal) return a
      const mask = (v: string | null) => (v ? v.replace(/.(?=.{4}$)/g, '•') : v)
      return { ...a, account_number: mask(a.account_number), routing_number: mask(a.routing_number) }
    })

    return NextResponse.json(masked)
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    console.error('Error in bank accounts GET:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bank accounts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)

    const body = await request.json()

    // Local DB-focused schema (matches bank_accounts table)
    const LocalBankAccountCreateSchema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      bankAccountType: z.string().min(1),
      accountNumber: z.string().min(1),
      routingNumber: z.string().min(1),
      isActive: z.boolean().default(true),
      glAccountId: z.string().uuid(),
      balance: z.number().optional(),
      buildiumBankId: z.number().optional(),
      checkPrintingInfo: z.any().optional(),
      electronicPayments: z.any().optional(),
      syncToBuildium: z.boolean().optional().default(false),
      country: z.string().optional()
    })

    const validatedData = sanitizeAndValidate(body, LocalBankAccountCreateSchema)
    console.log('Bank Accounts API: Validated data:', validatedData)

    const { name, description, bankAccountType, accountNumber, routingNumber, isActive, glAccountId, balance, buildiumBankId, checkPrintingInfo, electronicPayments, syncToBuildium, country } = validatedData

    // Insert new bank account
    const nowIso = new Date().toISOString()

    const { data: newAccount, error } = await supabase
      .from('bank_accounts')
      .insert({
        name,
        description: description ?? null,
        bank_account_type: normalizeType(bankAccountType),
        account_number: accountNumber,
        routing_number: routingNumber,
        is_active: isActive,
        gl_account: glAccountId,
        balance: balance ?? null,
        check_printing_info: checkPrintingInfo ?? null,
        electronic_payments: electronicPayments ?? null,
        buildium_bank_id: buildiumBankId ?? undefined,
        country: country || 'United States',
        last_source: 'local',
        last_source_ts: nowIso,
        created_at: nowIso,
        updated_at: nowIso
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating bank account:', error)
      return NextResponse.json(
        { error: 'Failed to create bank account', details: error.message },
        { status: 500 }
      )
    }

    // optional immediate Buildium create
    if (syncToBuildium) {
      const result = await buildiumEdgeClient.syncBankAccountToBuildium(newAccount)
      if (!result.success) {
        return NextResponse.json({ success: true, data: newAccount, buildiumSync: { success: false, error: result.error } })
      }
      // persist newly assigned buildium id
      const { data: patched } = await supabase
        .from('bank_accounts')
        .update({ buildium_bank_id: result.buildiumId, updated_at: new Date().toISOString() })
        .eq('id', newAccount.id)
        .select('*')
        .single()
      return NextResponse.json(patched || { ...newAccount, buildium_bank_id: result.buildiumId })
    }

    return NextResponse.json(newAccount)
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    console.error('Error in bank accounts POST:', error)
    return NextResponse.json(
      { error: 'Failed to create bank account' },
      { status: 500 }
    )
  }
}

function normalizeType(t: string): string {
  const lc = t.toLowerCase()
  if (lc === 'money_market' || lc === 'moneymarket') return 'money_market'
  if (lc === 'certificate_of_deposit' || lc === 'certificateofdeposit') return 'certificate_of_deposit'
  if (lc === 'savings') return 'savings'
  return 'checking'
}
