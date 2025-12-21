import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { requireAuth } from '@/lib/auth/guards'
import { resolveUserOrgIds } from '@/lib/auth/org-access'
import { getSupabaseServiceRoleClient } from '@/lib/db'

const normalizeOrgId = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'asOfDate must be YYYY-MM-DD')

const UuidSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, 'Invalid UUID')

const QuerySchema = z.object({
  orgId: z.string().optional(),
  asOfDate: IsoDateSchema,
  propertyId: UuidSchema.optional(),
  glAccountId: UuidSchema.optional(),
  useCache: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v == null ? true : v === 'true')),
  type: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform((v) => {
      const parsed = Number.parseInt(v ?? '', 10)
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
    }),
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const parsed = Number.parseInt(v ?? '', 10)
      if (!Number.isFinite(parsed) || parsed <= 0) return 50
      return Math.min(parsed, 200)
    }),
})

type GlAccountMeta = {
  id: string
  name: string
  type: string
  sub_type: string | null
  account_number: string | null
  is_active: boolean | null
  is_bank_account: boolean | null
  is_contra_account: boolean | null
  is_credit_card_account: boolean | null
  exclude_from_cash_balances: boolean | null
  buildium_gl_account_id: number
  buildium_parent_gl_account_id: number | null
}

type BalanceRow = {
  orgId: string
  glAccountId: string
  propertyId: string | null
  asOfDate: string
  balance: number
  computedAt?: string | null
  payload?: unknown
  glAccount: GlAccountMeta
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

export async function GET(request: NextRequest) {
  const startedAt = new Date().toISOString()
  try {
    const { searchParams } = new URL(request.url)
    const parsed = QuerySchema.safeParse({
      orgId:
        searchParams.get('orgId') ||
        request.headers.get('x-org-id') ||
        request.cookies.get('x-org-id')?.value ||
        undefined,
      asOfDate: searchParams.get('asOfDate'),
      propertyId: searchParams.get('propertyId') || undefined,
      glAccountId: searchParams.get('glAccountId') || undefined,
      useCache: searchParams.get('useCache') || undefined,
      type: searchParams.get('type') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    })

    if (!parsed.success) {
      const issue = parsed.error.issues?.[0]
      return NextResponse.json({ error: issue?.message ?? 'Invalid query' }, { status: 400 })
    }

    const { asOfDate, propertyId, glAccountId, type, page, limit, useCache } = parsed.data

    const auth = await requireAuth()
    const db = auth.supabase
    const userOrgIds = await resolveUserOrgIds({ supabase: db, user: auth.user })

    let orgId =
      normalizeOrgId(parsed.data.orgId) ??
      (userOrgIds[0] ?? null)

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }
    if (!userOrgIds.includes(orgId)) {
      return NextResponse.json({ error: 'Forbidden for organization' }, { status: 403 })
    }

    const from = (page - 1) * limit
    const to = from + limit // inclusive; fetch one extra record to detect hasMore

    // 1) Cache path: snapshots table (preferred for list + pagination)
    if (useCache) {
      let cacheQuery = (db as any)
        .from('gl_account_balances')
        .select(
          [
            'org_id',
            'gl_account_id',
            'property_id',
            'as_of_date',
            'balance',
            'computed_at',
            'payload',
            'gl_accounts ( id, name, type, sub_type, account_number, is_active, is_bank_account, is_contra_account, is_credit_card_account, exclude_from_cash_balances, buildium_gl_account_id, buildium_parent_gl_account_id )',
          ].join(', '),
        )
        .eq('org_id', orgId)
        .eq('as_of_date', asOfDate)

      if (propertyId) cacheQuery = cacheQuery.eq('property_id', propertyId)
      else cacheQuery = cacheQuery.is('property_id', null)

      if (glAccountId) cacheQuery = cacheQuery.eq('gl_account_id', glAccountId)
      if (type) cacheQuery = cacheQuery.eq('gl_accounts.type', type)

      cacheQuery = cacheQuery.range(from, to)

      const { data: cacheRows, error: cacheErr } = await cacheQuery
      if (cacheErr) {
        logger.error({ cacheErr }, 'Error querying gl_account_balances cache')
        return NextResponse.json({ error: cacheErr.message }, { status: 500 })
      }

      const records = Array.isArray(cacheRows) ? cacheRows : []
      if (records.length > 0) {
        const hasMore = records.length > limit
        const trimmed = hasMore ? records.slice(0, limit) : records
        const data: BalanceRow[] = trimmed.map((r: any) => ({
          orgId: r?.org_id,
          glAccountId: r?.gl_account_id,
          propertyId: r?.property_id ?? null,
          asOfDate: r?.as_of_date,
          balance: toNumber(r?.balance),
          computedAt: r?.computed_at ?? null,
          payload: r?.payload ?? null,
          glAccount: {
            id: r?.gl_accounts?.id,
            name: r?.gl_accounts?.name,
            type: r?.gl_accounts?.type,
            sub_type: r?.gl_accounts?.sub_type ?? null,
            account_number: r?.gl_accounts?.account_number ?? null,
            is_active: r?.gl_accounts?.is_active ?? null,
            is_bank_account: r?.gl_accounts?.is_bank_account ?? null,
            is_contra_account: r?.gl_accounts?.is_contra_account ?? null,
            is_credit_card_account: r?.gl_accounts?.is_credit_card_account ?? null,
            exclude_from_cash_balances: r?.gl_accounts?.exclude_from_cash_balances ?? null,
            buildium_gl_account_id: r?.gl_accounts?.buildium_gl_account_id,
            buildium_parent_gl_account_id: r?.gl_accounts?.buildium_parent_gl_account_id ?? null,
          },
        }))

        return NextResponse.json({
          success: true,
          orgId,
          asOfDate,
          source: 'cache',
          generatedAt: startedAt,
          data,
          pagination: { page, limit, hasMore },
        })
      }
    }

    // 2) Live computation path: DB functions
    if (glAccountId) {
      const glAccountQuery = db
        .from('gl_accounts')
        .select(
          [
            'id',
            'name',
            'type',
            'sub_type',
            'account_number',
            'is_active',
            'is_bank_account',
            'is_contra_account',
            'is_credit_card_account',
            'exclude_from_cash_balances',
            'buildium_gl_account_id',
            'buildium_parent_gl_account_id',
          ].join(', '),
        )
        .eq('id', glAccountId)
        .eq('org_id', orgId)

      const { data: glAccountRaw, error: glErr } = await glAccountQuery.maybeSingle()
      const glAccount = (glAccountRaw ?? null) as GlAccountMeta | null

      if (glErr) return NextResponse.json({ error: glErr.message }, { status: 500 })
      if (!glAccount) return NextResponse.json({ error: 'GL account not found' }, { status: 404 })
      if (type && glAccount.type !== type) {
        return NextResponse.json({
          success: true,
          orgId,
          asOfDate,
          source: 'live',
          generatedAt: startedAt,
          data: [],
          pagination: { page, limit, hasMore: false },
        })
      }

      const { data: balanceRaw, error: rpcErr } = await (db as any).rpc(
        'gl_account_balance_as_of',
        {
          p_org_id: orgId,
          p_gl_account_id: glAccountId,
          p_as_of: asOfDate,
          p_property_id: propertyId ?? null,
        },
      )
      if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 })

      // Optional cache backfill: if the caller requested cache, try to upsert the computed value.
      // This is best-effort; lack of write permissions should not fail the request.
      if (useCache) {
        try {
          const adminDb = getSupabaseServiceRoleClient('writing gl_account_balances snapshots')
          const payload = {
            input: { orgId, asOfDate, propertyId: propertyId ?? null },
            output: { balance: toNumber(balanceRaw) },
            debug: { linesCount: null },
            computedAt: startedAt,
          }
          await (adminDb as any)
            .from('gl_account_balances')
            .upsert(
              {
                org_id: orgId,
                gl_account_id: glAccountId,
                property_id: propertyId ?? null,
                as_of_date: asOfDate,
                balance: toNumber(balanceRaw),
                source: 'local',
                computed_at: startedAt,
                payload,
              },
              { onConflict: 'org_id,gl_account_id,property_id,as_of_date' },
            )
        } catch (cacheWriteErr) {
          logger.warn({ cacheWriteErr, orgId, glAccountId, asOfDate }, 'Cache backfill failed')
        }
      }

      const row: BalanceRow = {
        orgId,
        glAccountId,
        propertyId: propertyId ?? null,
        asOfDate,
        balance: toNumber(balanceRaw),
        computedAt: startedAt,
        glAccount,
      }

      return NextResponse.json({
        success: true,
        orgId,
        asOfDate,
        source: 'live',
        generatedAt: startedAt,
        data: [row],
        pagination: { page: 1, limit: 1, hasMore: false },
      })
    }

    const { data: rows, error: listErr } = await (db as any).rpc(
      'v_gl_account_balances_as_of',
      { p_org_id: orgId, p_as_of: asOfDate },
    )
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })

    const allRows = Array.isArray(rows) ? rows : []
    const scopedRows = allRows.filter((r: any) => {
      const rowPropertyId = r?.property_id ?? null
      if (propertyId) return rowPropertyId === propertyId
      return rowPropertyId == null
    })
    const typeFiltered = type
      ? scopedRows.filter((r: any) => String(r?.type ?? '') === type)
      : scopedRows

    // Deterministic ordering for UI: type, then account_number, then name
    typeFiltered.sort((a: any, b: any) => {
      const at = String(a?.type ?? '')
      const bt = String(b?.type ?? '')
      if (at !== bt) return at.localeCompare(bt)
      const aan = String(a?.account_number ?? '')
      const ban = String(b?.account_number ?? '')
      if (aan !== ban) return aan.localeCompare(ban)
      const an = String(a?.name ?? '')
      const bn = String(b?.name ?? '')
      return an.localeCompare(bn)
    })

    const slice = typeFiltered.slice(from, to + 1) // +1 to detect hasMore
    const hasMore = slice.length > limit
    const trimmed = hasMore ? slice.slice(0, limit) : slice

    const data: BalanceRow[] = trimmed.map((r: any) => ({
      orgId: r?.org_id,
      glAccountId: r?.gl_account_id,
      propertyId: r?.property_id ?? null,
      asOfDate: r?.as_of_date,
      balance: toNumber(r?.balance),
      computedAt: startedAt,
      payload: { linesCount: r?.lines_count ?? null },
      glAccount: {
        id: r?.gl_account_id,
        name: r?.name,
        type: r?.type,
        sub_type: r?.sub_type ?? null,
        account_number: r?.account_number ?? null,
        is_active: r?.is_active ?? null,
        is_bank_account: r?.is_bank_account ?? null,
        is_contra_account: r?.is_contra_account ?? null,
        is_credit_card_account: r?.is_credit_card_account ?? null,
        exclude_from_cash_balances: r?.exclude_from_cash_balances ?? null,
        buildium_gl_account_id: r?.buildium_gl_account_id,
        buildium_parent_gl_account_id: r?.buildium_parent_gl_account_id ?? null,
      },
    }))

    return NextResponse.json({
      success: true,
      orgId,
      asOfDate,
      source: 'live',
      generatedAt: startedAt,
      data,
      pagination: { page, limit, hasMore },
    })
  } catch (err) {
    logger.error({ err }, 'Error in GET /api/gl-accounts/balances')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


