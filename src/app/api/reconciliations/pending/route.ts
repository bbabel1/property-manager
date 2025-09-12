import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'

// Returns the latest pending reconciliation for a given property + bank account
export async function GET(req: NextRequest) {
  const admin = supabaseAdmin
  if (!admin) return NextResponse.json({ error: 'Service key not configured' }, { status: 500 })
  const { searchParams } = new URL(req.url)
  const propertyId = searchParams.get('propertyId')
  const bankAccountId = searchParams.get('bankAccountId')
  if (!propertyId || !bankAccountId) return NextResponse.json({ error: 'Missing propertyId or bankAccountId' }, { status: 400 })

  const { data, error } = await admin
    .from('reconciliation_log')
    .select('buildium_reconciliation_id, statement_ending_date')
    .eq('property_id', propertyId)
    .eq('bank_account_id', bankAccountId)
    .eq('is_finished', false)
    .order('statement_ending_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}

