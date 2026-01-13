import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { buildiumFetch } from '@/lib/buildium-http'
import { requireSupabaseAdmin, SupabaseAdminUnavailableError } from '@/lib/supabase-client'

import { upsertBillWithLines } from '@/lib/buildium-mappers'
import type { BuildiumBillWithLines } from '@/types/buildium'
import { requireBuildiumEnabledOr403 } from '@/lib/buildium-route-guard'

const toNumber = (value: unknown): number | null => {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : null
}

type BillLine = NonNullable<BuildiumBillWithLines['Lines']>[number]
type BillLineAccountingEntity = NonNullable<BillLine['AccountingEntity']>

const normalizeBillLine = (line: unknown): BillLine | null => {
  if (!line || typeof line !== 'object') return null
  const source = line as Record<string, unknown>
  const amount = toNumber(source.Amount ?? (source as { amount?: unknown }).amount)
  const glAccountId = toNumber(
    source.GlAccountId ?? (source as { GLAccountId?: unknown; glAccountId?: unknown }).GLAccountId,
  )
  if (amount == null || glAccountId == null) return null

  const accountingEntity = source.AccountingEntity
  if (!accountingEntity || typeof accountingEntity !== 'object') return null

  const entityId = toNumber((accountingEntity as { Id?: unknown }).Id)
  const entityTypeRaw = (accountingEntity as { AccountingEntityType?: unknown })?.AccountingEntityType
  const normalizedEntityType =
    typeof entityTypeRaw === 'string'
      ? (entityTypeRaw as BillLineAccountingEntity['AccountingEntityType'])
      : undefined
  if (entityId == null || !normalizedEntityType) return null

  const unitId = toNumber((accountingEntity as { UnitId?: unknown }).UnitId)
  const normalizedUnitSource = (accountingEntity as { Unit?: unknown })?.Unit
  const normalizedUnitId =
    normalizedUnitSource && typeof normalizedUnitSource === 'object'
      ? toNumber((normalizedUnitSource as { Id?: unknown }).Id)
      : null

  const normalizedEntity: BillLineAccountingEntity = {
    Id: entityId ?? undefined,
    AccountingEntityType: normalizedEntityType,
  }

  if (unitId != null) {
    normalizedEntity.UnitId = unitId
  }
  if (normalizedUnitId != null) {
    normalizedEntity.Unit = { Id: normalizedUnitId }
  }

  return {
    Amount: amount,
    Memo: typeof source.Memo === 'string' ? source.Memo : null,
    GlAccountId: glAccountId,
    GLAccount: (source as { GLAccount?: unknown }).GLAccount ?? null,
    AccountingEntity: normalizedEntity,
  }
}

const normalizeBillPayload = (bill: unknown): BuildiumBillWithLines | null => {
  if (!bill || typeof bill !== 'object') return null
  const source = bill as Record<string, unknown>
  const id = toNumber(source.Id)
  const vendorId = toNumber(source.VendorId)
  const amount = toNumber(source.Amount) ?? 0
  const date = typeof source.Date === 'string' ? source.Date : null
  if (!Number.isFinite(id) || !Number.isFinite(vendorId) || !date) return null

  const lines =
    Array.isArray(source.Lines) && source.Lines.length
      ? source.Lines.map(normalizeBillLine).filter((line): line is BillLine => !!line)
      : undefined

  return {
    ...(source as Partial<BuildiumBillWithLines>),
    Id: id as number,
    VendorId: vendorId as number,
    Amount: amount,
    Date: date,
    Lines: lines,
  } as BuildiumBillWithLines
}

export async function GET(request: NextRequest) {
  try {
    const isCron = request.headers.get('x-cron-secret') === process.env.CRON_SECRET
    let orgId: string
    if (!isCron) {
      const rate = await checkRateLimit(request)
      if (!rate.success) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
      }
      const { user } = await requireRole('platform_admin')
      const guardResult = await requireBuildiumEnabledOr403(request)
      if (guardResult instanceof NextResponse) return guardResult
      orgId = guardResult
    } else {
      const guardResult = await requireBuildiumEnabledOr403(request)
      if (guardResult instanceof NextResponse) return guardResult
      orgId = guardResult
    }

    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') || '50'
    const offset = searchParams.get('offset') || '0'
    const vendorId = searchParams.get('vendorId') || undefined
    const propertyId = searchParams.get('propertyId') || undefined
    const unitId = searchParams.get('unitId') || undefined
    const status = searchParams.get('status') || undefined
    const dateFrom = searchParams.get('dateFrom') || undefined
    const dateTo = searchParams.get('dateTo') || undefined

    const queryParams: Record<string, string> = {}
    if (limit) queryParams.limit = limit
    if (offset) queryParams.offset = offset
    if (vendorId) queryParams.vendorId = vendorId
    if (propertyId) queryParams.propertyId = propertyId
    if (unitId) queryParams.unitId = unitId
    if (status) queryParams.status = status
    if (dateFrom) queryParams.dateFrom = dateFrom
    if (dateTo) queryParams.dateTo = dateTo

    const response = await buildiumFetch('GET', '/bills', queryParams, undefined, orgId)

    if (!response.ok) {
      const details = response.json ?? {}
      logger.error('Buildium bills fetch failed for sync')
      return NextResponse.json({ error: 'Failed to fetch bills from Buildium', details }, { status: response.status })
    }

    const admin = requireSupabaseAdmin('buildium bills sync GET')

    const billsRaw = Array.isArray(response.json) ? response.json : []
    const bills = billsRaw
      .map((bill) => normalizeBillPayload(bill))
      .filter((bill): bill is BuildiumBillWithLines => bill !== null)
    if (!Array.isArray(bills)) {
      return NextResponse.json({ error: 'Unexpected bills response shape' }, { status: 502 })
    }

    let success = 0
    const failures: Array<{ id?: number; error: string }> = []
    for (const bill of bills) {
      try {
        await upsertBillWithLines(bill as BuildiumBillWithLines, admin)
        success += 1
      } catch (e) {
        failures.push({ id: bill?.Id, error: e instanceof Error ? e.message : 'Unknown error' })
      }
    }

    const skipped = Math.max(billsRaw.length - bills.length, 0)

    logger.info({ imported: success, failed: failures.length, skipped }, 'Buildium bills synced to DB')
    return NextResponse.json(
      { success: true, imported: success, failed: failures.length, skipped, failures },
      { status: 200 },
    )
  } catch (error) {
    if (error instanceof SupabaseAdminUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 501 })
    }
    logger.error('Error syncing Buildium bills to DB')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const isCron = request.headers.get('x-cron-secret') === process.env.CRON_SECRET
    if (!isCron) {
      const rate = await checkRateLimit(request)
      if (!rate.success) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
      }
      await requireRole('platform_admin')
    }

    const guardResult = await requireBuildiumEnabledOr403(request)
    if (guardResult instanceof NextResponse) return guardResult

    // Accept a single Buildium bill payload and upsert it
    const admin = requireSupabaseAdmin('buildium bills sync POST')
    const payload = normalizeBillPayload(await request.json())
    if (!payload) {
      return NextResponse.json({ error: 'Invalid bill payload' }, { status: 400 })
    }
    const { transactionId } = await upsertBillWithLines(payload, admin)
    return NextResponse.json({ success: true, transactionId }, { status: 201 })
  } catch (error) {
    if (error instanceof SupabaseAdminUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 501 })
    }
    return NextResponse.json({ error: 'Failed to upsert bill' }, { status: 400 })
  }
}
