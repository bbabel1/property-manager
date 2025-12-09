import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Json = Record<string, any>

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

const BUILDIUM_BASE = (Deno.env.get('BUILDIUM_BASE_URL') || 'https://apisandbox.buildium.com').replace(/\/$/, '')

async function buildium<T>(method: string, path: string, body?: any): Promise<T> {
  const headers: HeadersInit = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'x-buildium-client-id': Deno.env.get('BUILDIUM_CLIENT_ID') || '',
    'x-buildium-client-secret': Deno.env.get('BUILDIUM_CLIENT_SECRET') || ''
  }
  const res = await fetch(`${BUILDIUM_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`${res.status} ${res.statusText} - ${err?.Message || err?.message || 'Buildium error'}`)
  }
  return await res.json()
}

function dateOnly(s?: string | null): string {
  if (!s) return new Date().toISOString().slice(0, 10)
  return s.slice(0, 10)
}

function resolvePostingType(line: any): 'Debit' | 'Credit' {
  const raw =
    typeof line?.PostingType === 'string'
      ? line.PostingType
      : typeof line?.posting_type === 'string'
      ? line.posting_type
      : typeof line?.PostingTypeEnum === 'string'
      ? line.PostingTypeEnum
      : typeof line?.PostingTypeString === 'string'
      ? line.PostingTypeString
      : typeof line?.postingType === 'string'
      ? line.postingType
      : null
  const normalized = (raw || '').toLowerCase()
  if (normalized === 'debit' || normalized === 'dr' || normalized.includes('debit')) return 'Debit'
  if (normalized === 'credit' || normalized === 'cr' || normalized.includes('credit')) return 'Credit'
  const amountNum = Number(line?.Amount ?? 0)
  return amountNum < 0 ? 'Debit' : 'Credit'
}

// Minimal GL account resolver: ensures a local gl_accounts row exists for a Buildium GL account id
async function resolveGLAccountId(supabase: any, buildiumGLAccountId?: number | null): Promise<string | null> {
  if (!buildiumGLAccountId) return null
  const { data: existing } = await supabase
    .from('gl_accounts')
    .select('id')
    .eq('buildium_gl_account_id', buildiumGLAccountId)
    .single()
  if (existing?.id) return existing.id

  // Fetch GL account details from Buildium, insert minimal row
  const acc = await buildium<any>('GET', `/glaccounts/${buildiumGLAccountId}`)
  const now = new Date().toISOString()
  const insert = {
    buildium_gl_account_id: acc?.Id ?? buildiumGLAccountId,
    buildium_parent_gl_account_id: acc?.ParentGLAccountId ?? null,
    name: acc?.Name || `GL ${buildiumGLAccountId}`,
    type: acc?.Type || 'Asset',
    account_number: acc?.AccountNumber ?? null,
    description: acc?.Description ?? null,
    cash_flow_classification: acc?.CashFlowClassification ?? null,
    exclude_from_cash_balances: acc?.ExcludeFromCashBalances ?? null,
    is_default_gl_account: acc?.IsDefaultGLAccount ?? null,
    is_contra_account: acc?.IsContraAccount ?? null,
    is_bank_account: acc?.IsBankAccount ?? null,
    is_credit_card_account: acc?.IsCreditCardAccount ?? null,
    sub_type: acc?.SubType ?? null,
    sub_accounts: (Array.isArray(acc?.SubAccounts) ? acc.SubAccounts.map((s: any) => s?.Id).filter(Boolean) : null),
    created_at: now,
    updated_at: now
  }
  const { data, error } = await supabase.from('gl_accounts').insert(insert).select('id').single()
  if (error) throw error
  return data.id
}

async function resolveLocalPropertyId(supabase: any, buildiumId?: number | null): Promise<string | null> {
  if (!buildiumId) return null
  const { data } = await supabase.from('properties').select('id').eq('buildium_property_id', buildiumId).single()
  return data?.id ?? null
}

async function resolveLocalUnitId(supabase: any, buildiumId?: number | null): Promise<string | null> {
  if (!buildiumId) return null
  const { data } = await supabase.from('units').select('id').eq('buildium_unit_id', buildiumId).single()
  return data?.id ?? null
}

async function resolveLocalLeaseId(supabase: any, buildiumLeaseId?: number | null): Promise<number | null> {
  if (!buildiumLeaseId) return null
  const { data } = await supabase.from('lease').select('id').eq('buildium_lease_id', buildiumLeaseId).single()
  return data?.id ?? null
}

function mapHeaderFromBuildium(tx: any) {
  return {
    buildium_transaction_id: tx?.Id,
    date: dateOnly(tx?.Date || tx?.TransactionDate || tx?.PostDate),
    transaction_type: tx?.TransactionTypeEnum || tx?.TransactionType,
    total_amount: typeof tx?.TotalAmount === 'number' ? tx.TotalAmount : (tx?.Amount ?? 0),
    check_number: tx?.CheckNumber ?? null,
    memo: tx?.Memo || tx?.Journal?.Memo || null,
    buildium_lease_id: tx?.LeaseId ?? null,
    payee_tenant_id: tx?.PayeeTenantId ?? null,
  }
}

async function upsertWithLines(supabase: any, tx: any): Promise<{ transactionId: string }> {
  const now = new Date().toISOString()
  const header = mapHeaderFromBuildium(tx)
  const leaseIdLocal = await resolveLocalLeaseId(supabase, tx?.LeaseId)
  let existing: any = null
  {
    const { data } = await supabase
      .from('transactions')
      .select('id')
      .eq('buildium_transaction_id', header.buildium_transaction_id)
      .single()
    existing = data ?? null
  }
  let transactionId: string
  if (existing) {
    const { data, error } = await supabase
      .from('transactions')
      .update({ ...header, lease_id: leaseIdLocal, updated_at: now })
      .eq('id', existing.id)
      .select('id')
      .single()
    if (error) throw error
    transactionId = data.id
  } else {
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...header, lease_id: leaseIdLocal, created_at: now, updated_at: now })
      .select('id')
      .single()
    if (error) throw error
    transactionId = data.id
  }

  const lines: any[] = (Array.isArray(tx?.Lines) ? tx.Lines : []) || tx?.Journal?.Lines || []
  // Replace all lines
  await supabase.from('transaction_lines').delete().eq('transaction_id', transactionId)

  const pending: any[] = []
  for (const line of lines) {
    const amountAbs = Math.abs(Number(line?.Amount ?? 0))
    const postingType = resolvePostingType(line)
    const glBuildiumId = line?.GLAccountId ?? (typeof line?.GLAccount === 'number' ? line.GLAccount : line?.GLAccount?.Id)
    const glId = await resolveGLAccountId(supabase, glBuildiumId)
    if (!glId) continue
    const buildiumPropertyId = line?.PropertyId ?? null
    const buildiumUnitId = line?.UnitId ?? null
    const propertyId = await resolveLocalPropertyId(supabase, buildiumPropertyId)
    const unitId = await resolveLocalUnitId(supabase, buildiumUnitId)
    pending.push({
      transaction_id: transactionId,
      gl_account_id: glId,
      amount: amountAbs,
      posting_type: postingType,
      memo: line?.Memo ?? null,
      account_entity_type: 'Rental',
      account_entity_id: buildiumPropertyId,
      date: dateOnly(tx?.Date),
      created_at: now,
      updated_at: now,
      buildium_property_id: buildiumPropertyId,
      buildium_unit_id: buildiumUnitId,
      buildium_lease_id: tx?.LeaseId ?? null,
      property_id: propertyId,
      unit_id: unitId
    })
  }
  if (pending.length > 0) await supabase.from('transaction_lines').insert(pending)
  return { transactionId }
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors() })

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const headers = { ...cors(), 'Content-Type': 'application/json' }

    const body: Json = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const action = body.action as string
    const leaseId = Number(body.leaseId)
    const transactionId = body.transactionId != null ? Number(body.transactionId) : undefined
    const recurringId = body.recurringId != null ? Number(body.recurringId) : undefined
    const payload = body.payload
    const persist = Boolean(body.persist)

    let data: any

    switch (action) {
      case 'list': {
        const qp = new URLSearchParams()
        for (const k of ['orderby','offset','limit','dateFrom','dateTo']) {
          if (body?.[k] != null) qp.set(k, String(body[k]))
        }
        data = await buildium<any[]>('GET', `/leases/${leaseId}/transactions?${qp.toString()}`)
        break
      }
      case 'get': {
        data = await buildium<any>('GET', `/leases/${leaseId}/transactions/${transactionId}`)
        if (persist) await upsertWithLines(supabase, data)
        break
      }
      case 'create': {
        data = await buildium<any>('POST', `/leases/${leaseId}/transactions`, payload)
        if (persist) await upsertWithLines(supabase, data)
        break
      }
      case 'update': {
        data = await buildium<any>('PUT', `/leases/${leaseId}/transactions/${transactionId}`, payload)
        if (persist) await upsertWithLines(supabase, data)
        break
      }
      case 'listRecurring': {
        data = await buildium<any[]>('GET', `/leases/${leaseId}/recurringtransactions`)
        break
      }
      case 'getRecurring': {
        data = await buildium<any>('GET', `/leases/${leaseId}/recurringtransactions/${recurringId}`)
        break
      }
      case 'createRecurring': {
        data = await buildium<any>('POST', `/leases/${leaseId}/recurringtransactions`, payload)
        break
      }
      case 'updateRecurring': {
        data = await buildium<any>('PUT', `/leases/${leaseId}/recurringtransactions/${recurringId}`, payload)
        break
      }
      case 'deleteRecurring': {
        await buildium<void>('DELETE', `/leases/${leaseId}/recurringtransactions/${recurringId}`)
        data = { deleted: true }
        break
      }
      default:
        return new Response(JSON.stringify({ success: false, error: `Unsupported action: ${action}` }), { headers, status: 400 })
    }

    return new Response(JSON.stringify({ success: true, data }), { headers, status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: (error as Error).message || 'Internal error' }), { headers: { ...cors(), 'Content-Type': 'application/json' }, status: 500 })
  }
})
