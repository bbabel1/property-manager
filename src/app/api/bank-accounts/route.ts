import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { supabase } from '@/lib/db'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { BankAccountCreateSchema, BankAccountQuerySchema } from '@/schemas/bank-account'
import { buildiumEdgeClient } from '@/lib/buildium-edge-client'

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

    // Fetch bank accounts from database
    const { data: bankAccounts, error } = await supabase
      .from('bank_accounts')
      .select(`
        id,
        buildium_bank_id,
        name,
        description,
        bank_account_type,
        account_number,
        routing_number,
        country,
        created_at,
        updated_at
      `)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching bank accounts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch bank accounts', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(bankAccounts || [])
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
    
    // Validate request body with schema
    const validatedData = sanitizeAndValidate(body, BankAccountCreateSchema);
    console.log('Bank Accounts API: Validated data:', validatedData);

    const { 
      name, 
      accountNumber, 
      routingNumber, 
      bankName, 
      bankAccountType, 
      balance, 
      isActive, 
      isTrustAccount, 
      trustAccountType, 
      buildiumAccountId, 
      notes 
    } = validatedData

    // Insert new bank account
    const { data: newAccount, error } = await supabase
      .from('bank_accounts')
      .insert({
        name,
        account_number: accountNumber,
        routing_number: routingNumber,
        bank_name: bankName,
        bank_account_type: bankAccountType,
        balance,
        is_active: isActive,
        is_trust_account: isTrustAccount,
        trust_account_type: trustAccountType,
        buildium_account_id: buildiumAccountId,
        notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
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