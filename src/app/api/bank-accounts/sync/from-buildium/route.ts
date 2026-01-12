import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { buildiumFetch } from '@/lib/buildium-http'
import { mapBankAccountFromBuildiumWithGLAccount } from '@/lib/buildium-mappers'
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id'
import { requireOrgMember } from '@/lib/auth/org-guards'
import { assertBuildiumEnabled, BuildiumDisabledError } from '@/lib/buildium-gate'
import { requireBuildiumEnabledOr403 } from '@/lib/buildium-route-guard'

type BuildiumBankAccount = {
  Id: number
  Name: string
  Description?: string | null
  Balance?: number | null
  CheckPrintingInfo?: unknown
  ElectronicPayments?: unknown
  AccountNumber?: string | null
  RoutingNumber?: string | null
  BankAccountType?: string | null
  IsActive?: boolean | null
  BranchNumber?: string | null
  CreatedDate?: string | null
  ModifiedDate?: string | null
};

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const db = await getSupabaseServerClient()
    const orgIdResult = await requireBuildiumEnabledOr403(request)
    if (orgIdResult instanceof NextResponse) return orgIdResult
    const orgId = orgIdResult
    await requireOrgMember({ client: db, userId: user.id, orgId })
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const forceSync = Boolean(body?.forceSync)

    logger.info({ userId: user.id, orgId, forceSync }, 'Starting direct bank accounts sync from Buildium')

    const pageSize = Number(body?.limit || 200)
    let offset = Number(body?.offset || 0)
    let totalFetched = 0
    const summary = { inserted: 0, updated: 0, skipped: 0, conflicts: 0, failed: 0 }

    for (;;) {
      const res = await buildiumFetch('GET', '/bankaccounts', { limit: pageSize, offset }, undefined, orgId)
      if (!res.ok || !Array.isArray(res.json)) {
        return NextResponse.json(
          { error: 'Failed to fetch bank accounts from Buildium', details: res.errorText || res.json },
          { status: res.status || 502 }
        )
      }
      const accounts: BuildiumBankAccount[] = res.json
      totalFetched += accounts.length

      for (const acct of accounts) {
        try {
          const now = new Date().toISOString()
          // Map Buildium -> local, including GL account resolution (creates GL if missing)
          const mapped = await mapBankAccountFromBuildiumWithGLAccount(acct as any, db, orgId)
          const glId = (mapped as { gl_account?: string | null })?.gl_account
          if (!glId) throw new Error('Missing GL account mapping for bank account')

          // Source of truth: gl_accounts bank fields
          const glUpdate: Record<string, unknown> = {
            name: acct.Name,
            description: acct.Description ?? null,
            is_bank_account: true,
            buildium_gl_account_id: acct.Id,
            bank_account_type: (mapped as Record<string, unknown>).bank_account_type ?? null,
            bank_account_number:
              (mapped as Record<string, unknown>).bank_account_number ??
              (mapped as Record<string, unknown>).account_number ??
              null,
            bank_routing_number: (mapped as Record<string, unknown>).routing_number ?? null,
            bank_country: (mapped as Record<string, unknown>).country ?? 'United States',
            bank_buildium_balance: typeof acct?.Balance === 'number' ? acct.Balance : null,
            bank_check_printing_info: acct.CheckPrintingInfo ?? null,
            bank_electronic_payments: acct.ElectronicPayments ?? null,
            bank_last_source: 'buildium',
            bank_last_source_ts: now,
            org_id: orgId,
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
                .or(`org_id.eq.${orgId},org_id.is.null`)
                .maybeSingle()
              const src = existingGl?.bank_last_source as string | null
              const tsStr = existingGl?.bank_last_source_ts as string | null
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
            const { error: updErr } = await db
              .from('gl_accounts')
              .update(glUpdate)
              .eq('id', glId)
              .or(`org_id.eq.${orgId},org_id.is.null`)
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
        } catch {
          summary.failed++
        }
      }

      if (accounts.length < pageSize) break
      offset += pageSize
    }

    return NextResponse.json({ success: true, fetched: totalFetched, ...summary })
  } catch (error) {
    if (error instanceof Error) {
      if (error instanceof BuildiumDisabledError) {
        return NextResponse.json(
          { error: 'Buildium integration is disabled for this organization' },
          { status: 403 }
        )
      }
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    return NextResponse.json({ error: 'Failed to sync bank accounts' }, { status: 500 })
  }
}
