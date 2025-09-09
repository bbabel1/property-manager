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
          const row: any = {
            ...mapped,
            updated_at: now,
            last_source: 'buildium' as const,
            last_source_ts: now,
          }
          // Ensure NOT NULL columns are satisfied
          if (!row.country) row.country = 'United States'

          // Upsert by buildium_bank_id with conflict window when local edited recently
          const { data: existing } = await db
            .from('bank_accounts')
            .select('id, last_source, last_source_ts')
            .eq('buildium_bank_id', acct.Id)
            .maybeSingle()

          if (existing?.id) {
            let shouldOverwrite = true
            if (!forceSync) {
              try {
                const src = (existing as any).last_source
                const tsStr = (existing as any).last_source_ts as string | null
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
              const { error: updErr } = await db.from('bank_accounts').update(row).eq('id', existing.id)
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
          } else {
            const insertRow = { ...row, created_at: now }
            const { error: insErr } = await db.from('bank_accounts').insert(insertRow)
            if (insErr) throw insErr
            summary.inserted++
            await db.rpc('update_buildium_sync_status', {
              p_entity_type: 'bankAccount',
              p_entity_id: String(acct.Id),
              p_buildium_id: acct.Id,
              p_status: 'synced'
            })
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
