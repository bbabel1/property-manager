import { Pool, type PoolClient } from 'pg'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TablesInsert } from '@/types/database'
import type { DepositBuildiumSyncStatus, DepositStatus } from '@/types/deposits'
import { supabaseAdmin, type TypedSupabaseClient } from '@/lib/db'
import { resolveUndepositedFundsGlAccountId } from '@/lib/buildium-mappers'

type AnySupabaseClient = SupabaseClient<any>

export type DepositLineInput = Omit<TablesInsert<'transaction_lines'>, 'transaction_id'>
export type DepositPaymentSplitInput = Omit<TablesInsert<'transaction_payment_transactions'>, 'transaction_id'>
export type DepositItemInput = {
  payment_transaction_id: string
  buildium_payment_transaction_id?: number | null
  amount: number
  created_at?: string
  updated_at?: string
}

export type CreateDepositWithMetaParams = {
  transaction: TablesInsert<'transactions'>
  lines: DepositLineInput[]
  depositItems: DepositItemInput[]
  paymentSplits?: DepositPaymentSplitInput[]
  status?: DepositStatus
  buildiumSyncStatus?: DepositBuildiumSyncStatus
}

type CreateDepositResult = { transactionId: string; depositId: string }

export type DepositSummary = {
  transactionId: string
  depositId: string
  status: DepositStatus
  orgId: string
  bankGlAccountId: string | null
  date: string | null
  memo: string | null
  totalAmount: number | null
  buildiumDepositId: number | null
  buildiumTransactionId: number | null
  buildiumSyncStatus: DepositBuildiumSyncStatus | null
  buildiumLastSyncedAt: string | null
}

let servicePool: Pool | null = null

const getServiceRolePool = (): Pool => {
  if (servicePool) return servicePool

  const directUrl = process.env.SUPABASE_DB_URL
  const password = process.env.SUPABASE_DB_PASSWORD
  const projectRef = process.env.SUPABASE_PROJECT_REF_PRODUCTION
  const connectionString =
    directUrl ||
    (password && projectRef
      ? `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`
      : null)

  if (!connectionString) {
    throw new Error(
      'Cannot create deposit: missing SUPABASE_DB_URL or SUPABASE_DB_PASSWORD + SUPABASE_PROJECT_REF_PRODUCTION',
    )
  }

  servicePool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })
  return servicePool
}

const normalizeValue = (value: unknown) => (value === undefined ? null : value)

const buildInsert = (table: string, row: Record<string, unknown>) => {
  const columns = Object.keys(row)
  if (columns.length === 0) throw new Error(`Cannot insert into ${table}: no columns provided`)
  const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ')
  const text = `INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`
  const values = columns.map((c) => normalizeValue(row[c]))
  return { text, values }
}

const withTransaction = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await getServiceRolePool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // ignore rollback failures to avoid masking original error
    }
    throw error
  } finally {
    client.release()
  }
}

export async function createDepositWithMeta(params: CreateDepositWithMetaParams): Promise<CreateDepositResult> {
  const nowIso = new Date().toISOString()

  return withTransaction<CreateDepositResult>(async (client) => {
    const txInsert: TablesInsert<'transactions'> = {
      ...params.transaction,
      transaction_type: params.transaction.transaction_type ?? 'Deposit',
      status: params.transaction.status ?? 'Paid',
      created_at: params.transaction.created_at ?? nowIso,
      updated_at: params.transaction.updated_at ?? nowIso,
    }

    if (!txInsert.org_id) {
      throw new Error('Cannot create deposit without org_id on transaction')
    }

    const txQuery = buildInsert('public.transactions', txInsert)
    const { rows: txRows } = await client.query<{ id: string; org_id: string }>(
      `${txQuery.text} RETURNING id, org_id`,
      txQuery.values,
    )
    const transactionId = txRows?.[0]?.id
    const orgId = txRows?.[0]?.org_id
    if (!transactionId || !orgId) {
      throw new Error('Failed to create deposit transaction header')
    }

    const { rows: depositIdRows } = await client.query<{ deposit_id: string }>(
      'SELECT public.generate_deposit_id($1)::text AS deposit_id',
      [transactionId],
    )
    const depositId = depositIdRows?.[0]?.deposit_id
    if (!depositId) throw new Error('Failed to generate deposit_id')

    const depositMetaRow = {
      transaction_id: transactionId,
      org_id: orgId,
      deposit_id: depositId,
      status: params.status ?? 'posted',
      buildium_sync_status: params.buildiumSyncStatus ?? 'pending',
      created_at: txInsert.created_at ?? nowIso,
      updated_at: txInsert.updated_at ?? nowIso,
    }
    const depositMetaQuery = buildInsert('public.deposit_meta', depositMetaRow)
    await client.query(depositMetaQuery.text, depositMetaQuery.values)

    for (const line of params.lines) {
      const row = {
        ...line,
        transaction_id: transactionId,
        created_at: line.created_at ?? nowIso,
        updated_at: line.updated_at ?? nowIso,
      }
      const q = buildInsert('public.transaction_lines', row)
      await client.query(q.text, q.values)
    }

    for (const item of params.depositItems) {
      const row = {
        deposit_transaction_id: transactionId,
        payment_transaction_id: item.payment_transaction_id,
        buildium_payment_transaction_id: item.buildium_payment_transaction_id ?? null,
        amount: item.amount,
        created_at: item.created_at ?? nowIso,
        updated_at: item.updated_at ?? nowIso,
      }
      const q = buildInsert('public.deposit_items', row)
      await client.query(q.text, q.values)
    }

    if (params.paymentSplits && params.paymentSplits.length > 0) {
      for (const split of params.paymentSplits) {
        const row = {
          ...split,
          transaction_id: transactionId,
          created_at: split.created_at ?? nowIso,
          updated_at: split.updated_at ?? nowIso,
        }
        const q = buildInsert('public.transaction_payment_transactions', row)
        await client.query(q.text, q.values)
      }
    }

    return { transactionId, depositId }
  })
}

const asAny = (client: TypedSupabaseClient = supabaseAdmin): AnySupabaseClient =>
  (client as unknown as AnySupabaseClient) || (supabaseAdmin as unknown as AnySupabaseClient)

const canTransition = (current: DepositStatus, next: DepositStatus) => {
  if (current === next) return true
  if (current === 'reconciled') return false
  if (current === 'voided') return next === 'voided'
  // current is posted
  return next === 'reconciled' || next === 'voided'
}

const transitionErrorMessage = (current: DepositStatus, next: DepositStatus) => {
  if (current === 'reconciled' && next !== 'reconciled') return 'Cannot regress status from reconciled'
  if (current === 'voided' && next !== 'voided') return 'Cannot change status of a voided deposit'
  return `Invalid status transition from ${current} to ${next}`
}

export async function getDepositMetaByTransactionId(
  transactionId: string,
  client: TypedSupabaseClient = supabaseAdmin,
) {
  const db = asAny(client)
  const { data, error } = await db
    .from('deposit_meta')
    .select('*')
    .eq('transaction_id', transactionId)
    .maybeSingle()
  return { data, error }
}

export async function getDepositItemsByDepositTransactionId(
  transactionId: string,
  client: TypedSupabaseClient = supabaseAdmin,
) {
  const db = asAny(client)
  const { data, error } = await db
    .from('deposit_items')
    .select('*')
    .eq('deposit_transaction_id', transactionId)
  return { data, error }
}

export async function updateDepositStatus(
  client: TypedSupabaseClient,
  params: { transactionId: string; status: DepositStatus },
) {
  const db = asAny(client)
  const { data: existing, error: fetchError } = await db
    .from('deposit_meta')
    .select('id, status')
    .eq('transaction_id', params.transactionId)
    .maybeSingle()

  if (fetchError || !existing) {
    return { ok: false as const, error: fetchError?.message ?? 'Deposit metadata not found' }
  }

  const currentStatus = existing.status as DepositStatus
  if (!canTransition(currentStatus, params.status)) {
    return { ok: false as const, error: transitionErrorMessage(currentStatus, params.status) }
  }
  if (currentStatus === params.status) {
    return { ok: true as const, status: currentStatus }
  }

  const { error: updateError } = await db
    .from('deposit_meta')
    .update({ status: params.status, updated_at: new Date().toISOString() })
    .eq('id', existing.id)

  if (updateError) {
    return { ok: false as const, error: updateError.message }
  }

  return { ok: true as const, status: params.status }
}

export async function updateDepositStatusByIdentifier(
  identifier: string,
  status: DepositStatus,
  client: TypedSupabaseClient = supabaseAdmin,
) {
  const summary = await getDepositSummary(identifier, client)
  if (!summary.ok) return summary
  return updateDepositStatus(client, { transactionId: summary.summary!.transactionId, status })
}

export async function listDepositsByBankAccount(
  bankGlAccountId: string,
  client: TypedSupabaseClient = supabaseAdmin,
) {
  const db = asAny(client)
  const { data, error } = await db
    .from('transactions')
    .select(
      `
      id,
      date,
      memo,
      total_amount,
      bank_gl_account_id,
      buildium_transaction_id,
      deposit_meta:deposit_meta(deposit_id, status, buildium_deposit_id, buildium_sync_status, buildium_last_synced_at)
    `,
    )
    .eq('transaction_type', 'Deposit')
    .eq('bank_gl_account_id', bankGlAccountId)
    .order('date', { ascending: false })

  return { data, error }
}

export async function touchDepositMeta(
  transactionId: string,
  updates: Partial<{
    buildium_deposit_id: number | null
    buildium_sync_status: DepositBuildiumSyncStatus
    buildium_sync_error: string | null
    buildium_last_synced_at: string | null
  }>,
  client: TypedSupabaseClient = supabaseAdmin,
) {
  const db = asAny(client)
  const payload = {
    ...updates,
    updated_at: new Date().toISOString(),
  }
  const { error } = await db.from('deposit_meta').update(payload).eq('transaction_id', transactionId)
  return { error }
}

export async function getDepositSummary(identifier: string, client: TypedSupabaseClient = supabaseAdmin) {
  const db = asAny(client)

  // Try lookup by deposit_id first
  const { data: metaByDepositId } = await db
    .from('deposit_meta')
    .select('*')
    .eq('deposit_id', identifier)
    .maybeSingle()

  let metaRow = metaByDepositId
  if (!metaRow) {
    const { data: metaByTransactionId } = await db
      .from('deposit_meta')
      .select('*')
      .eq('transaction_id', identifier)
      .maybeSingle()
    metaRow = metaByTransactionId || null
  }

  if (!metaRow) {
    return { ok: false as const, error: 'Deposit not found' }
  }

  const transactionId = metaRow.transaction_id as string

  const { data: txRow, error: txError } = await db
    .from('transactions')
    .select(
      `
      id,
      org_id,
      bank_gl_account_id,
      date,
      memo,
      total_amount,
      transaction_type,
      buildium_transaction_id
    `,
    )
    .eq('id', transactionId)
    .maybeSingle()

  if (txError || !txRow) {
    return { ok: false as const, error: 'Deposit transaction not found' }
  }

  const summary: DepositSummary = {
    transactionId,
    depositId: (metaRow.deposit_id as string) ?? transactionId,
    status: (metaRow.status as DepositStatus) ?? 'posted',
    orgId: (metaRow.org_id as string) ?? (txRow.org_id as string),
    bankGlAccountId: (txRow.bank_gl_account_id as string) ?? null,
    date: (txRow.date as string) ?? null,
    memo: (txRow.memo as string) ?? null,
    totalAmount: (txRow.total_amount as number) ?? null,
    buildiumDepositId:
      typeof metaRow.buildium_deposit_id === 'number' ? (metaRow.buildium_deposit_id as number) : null,
    buildiumTransactionId:
      typeof txRow.buildium_transaction_id === 'number' ? (txRow.buildium_transaction_id as number) : null,
    buildiumSyncStatus: (metaRow.buildium_sync_status as DepositBuildiumSyncStatus) ?? null,
    buildiumLastSyncedAt: (metaRow.buildium_last_synced_at as string) ?? null,
  }

  return { ok: true as const, summary }
}

export async function ensurePaymentToUndepositedFunds(
  transactionId: string,
  orgId: string | null,
  client: TypedSupabaseClient = supabaseAdmin,
  opts?: { intendedBankBuildiumId?: number | null },
) {
  const db = asAny(client)
  const { data: tx, error: txError } = await db
    .from('transactions')
    .select('id, org_id, bank_gl_account_id')
    .eq('id', transactionId)
    .maybeSingle()

  if (txError) throw txError
  const orgIdToUse = orgId ?? (tx?.org_id as string | null) ?? null
  if (!orgIdToUse) throw new Error('Cannot route to Undeposited Funds: transaction is missing org_id')

  const udfId = await resolveUndepositedFundsGlAccountId(db as any, orgIdToUse)
  if (!udfId) throw new Error('Undeposited Funds GL account could not be resolved')

  const nowIso = new Date().toISOString()
  const updates: Record<string, unknown> = {
    bank_gl_account_id: udfId,
    updated_at: nowIso,
  }
  if (opts?.intendedBankBuildiumId !== undefined) {
    updates.bank_gl_account_buildium_id = opts.intendedBankBuildiumId ?? null
  }

  await db.from('transactions').update(updates).eq('id', transactionId)

  // Reclass bank-side lines to UDF
  const { data: lines, error: linesError } = await db
    .from('transaction_lines')
    .select('id, gl_account_id, posting_type, amount')
    .eq('transaction_id', transactionId)
  if (linesError) throw linesError

  const glIds = Array.from(
    new Set((lines || []).map((l) => (l?.gl_account_id ? String(l.gl_account_id) : null)).filter(Boolean)),
  )
  if (glIds.length === 0) return

  const { data: glRows, error: glError } = await db
    .from('gl_accounts')
    .select('id, is_bank_account')
    .in('id', glIds)
  if (glError) throw glError
  const bankSet = new Set(
    (glRows || [])
      .filter((g) => g?.is_bank_account === true && g?.id)
      .map((g) => String(g.id)),
  )

  const bankLineIds = (lines || [])
    .filter((l) => l?.id && l.gl_account_id && bankSet.has(String(l.gl_account_id)) && String(l.gl_account_id) !== udfId)
    .map((l) => l.id as string)

  if (bankLineIds.length > 0) {
    await db
      .from('transaction_lines')
      .update({ gl_account_id: udfId, updated_at: nowIso })
      .in('id', bankLineIds)
  }
}
