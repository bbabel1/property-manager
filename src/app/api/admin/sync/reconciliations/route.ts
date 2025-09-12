import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { logger } from '@/lib/logger'

// On-demand sync job for Buildium reconciliations → reconciliation_log
export async function GET(req: NextRequest) {
  const admin = supabaseAdmin
  if (!admin) return NextResponse.json({ error: 'Service key not configured' }, { status: 500 })

  const url = new URL(req.url)
  const bankAccountId = url.searchParams.get('bankAccountId')
  const propertyId = url.searchParams.get('propertyId')

  let bankAccounts: { id: string; buildium_bank_id: number; gl_account: string | null }[] = []
  try {
    let query = admin.from('bank_accounts').select('id, buildium_bank_id, gl_account')
    if (bankAccountId) query = query.eq('id', bankAccountId)
    const { data, error } = await query
    if (error) throw error
    bankAccounts = data || []
  } catch (e) {
    logger.error({ e }, 'Failed to list bank accounts for sync')
    return NextResponse.json({ error: 'Failed to list bank accounts' }, { status: 500 })
  }

  const clientId = process.env.BUILDIUM_CLIENT_ID
  const clientSecret = process.env.BUILDIUM_CLIENT_SECRET
  if (!clientId || !clientSecret) return NextResponse.json({ error: 'Buildium credentials missing' }, { status: 500 })

  let totalAccounts = 0
  let totalRecs = 0
  let totalBalances = 0
  let changes = 0

  // If propertyId provided, restrict bank accounts to the property's linked accounts
  if (propertyId) {
    try {
      const { data: pr } = await admin
        .from('properties')
        .select('operating_bank_account_id, deposit_trust_account_id')
        .eq('id', propertyId)
        .maybeSingle()
      if (pr) {
        const ids = [pr.operating_bank_account_id, pr.deposit_trust_account_id].filter(Boolean)
        if (ids.length) bankAccounts = bankAccounts.filter(b => ids.includes(b.id))
      }
    } catch {}
  }

  for (const ba of bankAccounts) {
    totalAccounts++
    try {
      // Fetch reconciliations per Buildium bank account
      const res = await fetch(`https://apisandbox.buildium.com/v1/bankaccounts/${ba.buildium_bank_id}/reconciliations`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'x-buildium-client-id': clientId, 'x-buildium-client-secret': clientSecret },
      })
      if (!res.ok) {
        logger.warn({ bank: ba.buildium_bank_id, status: res.status }, 'Reconciliations fetch failed')
        continue
      }
      const recs: any[] = await res.json()
      for (const r of recs) {
        totalRecs++
        // Map to local property via properties.operating_bank_account_id or deposit_trust_account_id
        let property_id: string | null = null
        try {
          const { data: prop } = await admin
            .from('properties')
            .select('id')
            .or(`operating_bank_account_id.eq.${ba.id},deposit_trust_account_id.eq.${ba.id}`)
            .limit(1)
            .maybeSingle()
          if (prop) property_id = prop.id
        } catch {}

        const payload: any = {
          buildium_reconciliation_id: r?.Id ?? r?.id,
          buildium_bank_account_id: ba.buildium_bank_id,
          bank_account_id: ba.id,
          gl_account_id: ba.gl_account,
          property_id,
          statement_ending_date: r?.StatementEndingDate ?? r?.statementEndingDate ?? null,
          is_finished: Boolean(r?.IsFinished ?? r?.isFinished ?? false),
        }
        const { error: upErr } = await admin.from('reconciliation_log').upsert(payload, { onConflict: 'buildium_reconciliation_id' })
        if (!upErr) changes++

        // Fetch balance for this reconciliation
        const bid = r?.Id ?? r?.id
        if (bid != null) {
          const balRes = await fetch(`https://apisandbox.buildium.com/v1/bankaccounts/reconciliations/${bid}/balance`, {
            method: 'GET',
            headers: { 'Accept': 'application/json', 'x-buildium-client-id': clientId, 'x-buildium-client-secret': clientSecret },
          })
          if (balRes.ok) {
            totalBalances++
            const b = await balRes.json()
            const balPatch: any = {
              buildium_reconciliation_id: bid,
              ending_balance: b?.EndingBalance ?? b?.endingBalance ?? null,
              total_checks_withdrawals: b?.TotalChecksAndWithdrawals ?? b?.totalChecksAndWithdrawals ?? null,
              total_deposits_additions: b?.TotalDepositsAndAdditions ?? b?.totalDepositsAndAdditions ?? null,
            }
            await admin.from('reconciliation_log').upsert(balPatch, { onConflict: 'buildium_reconciliation_id' })
          }
        }
      }
    } catch (e) {
      logger.warn({ e, bank: ba.buildium_bank_id }, 'Sync loop error for bank account')
    }
  }
  // Alert plumbing: log counts for variance and stale alerts
  try {
    const { data: varRows } = await admin.from('v_reconciliation_variance_alerts').select('property_id').eq('over_24h', true)
    const { data: staleRows } = await admin.from('v_reconciliation_stale_alerts').select('property_id')
    const varCount = Array.isArray(varRows) ? varRows.length : 0
    const staleCount = Array.isArray(staleRows) ? staleRows.length : 0
    if (varCount > 0 || staleCount > 0) {
      logger.warn({ varCount, staleCount }, 'Reconciliation alerts present after sync')
    }
  } catch {}

  return NextResponse.json({ success: true, totalAccounts, totalRecs, totalBalances, changes })
}
