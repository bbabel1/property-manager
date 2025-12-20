import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { supabase, supabaseAdmin } from '@/lib/db'
import { logger } from '@/lib/logger'
import { buildiumFetch } from '@/lib/buildium-http'
import { mapBankAccountFromBuildiumWithGLAccount } from '@/lib/buildium-mappers'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const db = supabaseAdmin || supabase
    const body = await request.json().catch(() => ({} as any))
    const forceSync = Boolean(body?.forceSync)

    logger.info({ userId: user.id, forceSync }, 'Starting direct bank accounts sync from Buildium')

    const pageSize = Number(body?.limit || 200)
    let offset = Number(body?.offset || 0)
    let totalFetched = 0
    const summary = { inserted: 0, updated: 0, skipped: 0, conflicts: 0, failed: 0 }

    for (;;) {
      const res = await buildiumFetch('GET', '/bankaccounts', { limit: pageSize, offset })
      if (!res.ok || !Array.isArray(res.json)) {
        return NextResponse.json(
          { error: 'Failed to fetch bank accounts from Buildium', details: res.errorText || res.json },
          { status: res.status || 502 }
        )
      }
      const accounts: any[] = res.json
      totalFetched += accounts.length

      for (const acct of accounts) {
        try {
          const now = new Date().toISOString()
          // Map Buildium -> local, including GL account resolution (creates GL if missing)
          const mapped = await mapBankAccountFromBuildiumWithGLAccount(acct, db)
          const glId = (mapped as any)?.gl_account
          if (!glId) throw new Error('Missing GL account mapping for bank account')

          // Source of truth: gl_accounts bank fields
          const glUpdate: any = {
            name: acct.Name,
            description: acct.Description ?? null,
            is_bank_account: true,
            buildium_bank_account_id: acct.Id,
            bank_account_type: (mapped as any).bank_account_type ?? null,
            bank_account_number: (mapped as any).account_number ?? null,
            bank_routing_number: (mapped as any).routing_number ?? null,
            bank_country: (mapped as any).country ?? 'United States',
            bank_buildium_balance: typeof (acct as any)?.Balance === 'number' ? (acct as any).Balance : null,
            bank_check_printing_info: (acct as any).CheckPrintingInfo ?? null,
            bank_electronic_payments: (acct as any).ElectronicPayments ?? null,
            bank_last_source: 'buildium',
            bank_last_source_ts: now,
            updated_at: now,
          }

          // Conflict policy uses gl_accounts bank_last_source/bank_last_source_ts (mirrors prior bank_accounts behavior)
          let shouldOverwrite = true
          if (!forceSync) {
            try {
              const { data: existingGl } = await db
                .from('gl_accounts')
                .select('bank_last_source, bank_last_source_ts')
                .eq('id', glId)
                .maybeSingle()
              const src = (existingGl as any)?.bank_last_source
              const tsStr = (existingGl as any)?.bank_last_source_ts as string | null
              if (src === 'local' && tsStr) {
                const ts = new Date(tsStr)
                const diffMs = Date.now() - ts.getTime()
                if (diffMs < 10 * 60 * 1000) {
                  shouldOverwrite = false
                  summary.conflicts++
                  await db.rpc('update_buildium_sync_status', {
                    p_entity_type: 'bankAccount',
                    p_entity_id: String(acct.Id),
                    p_buildium_id: acct.Id,
                    p_status: 'conflict',
                    p_error_message: 'Skipped overwrite due to recent local changes'
                  })
                }
              }
            } catch {}
          }

          if (shouldOverwrite) {
            const { error: updErr } = await db.from('gl_accounts').update(glUpdate).eq('id', glId)
            if (updErr) throw updErr
            summary.updated++
            await db.rpc('update_buildium_sync_status', {
              p_entity_type: 'bankAccount',
              p_entity_id: String(acct.Id),
              p_buildium_id: acct.Id,
              p_status: 'synced'
            })
          } else {
            summary.skipped++
          }
        } catch (e) {
          summary.failed++
        }
      }

      if (accounts.length < pageSize) break
      offset += pageSize
    }

    return NextResponse.json({ success: true, fetched: totalFetched, ...summary })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to sync bank accounts' }, { status: 500 })
  }
}
