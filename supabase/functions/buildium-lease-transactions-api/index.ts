// deno-lint-ignore-file
import '../_shared/buildiumEgressGuard.ts';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildiumFetchEdge } from '../_shared/buildiumFetch.ts'

type Json = Record<string, any>
type BuildiumCredentials = { baseUrl: string; clientId: string; clientSecret: string }

let currentBuildiumCreds: BuildiumCredentials | null = null

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

async function buildium<T>(
  supabase: any,
  orgId: string,
  method: string,
  path: string,
  body?: any,
): Promise<T> {
  const creds = currentBuildiumCreds
  if (!creds?.clientId || !creds?.clientSecret) {
    throw new Error('Buildium credentials not provided')
  }
  const res = await buildiumFetchEdge(supabase, orgId, method, path, body, creds)
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
async function resolveGLAccountId(supabase: any, orgId: string, buildiumGLAccountId?: number | null): Promise<string | null> {
  if (!buildiumGLAccountId) return null
  const { data: existing } = await supabase
    .from('gl_accounts')
    .select('id')
    .eq('buildium_gl_account_id', buildiumGLAccountId)
    .single()
  if (existing?.id) return existing.id

  // Fetch GL account details from Buildium, insert minimal row
  const acc = await buildium<any>(supabase, orgId, 'GET', `/glaccounts/${buildiumGLAccountId}`)
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

async function resolveOrgIdFromBuildiumAccount(
  supabase: any,
  accountId?: number | null
): Promise<string | null> {
  if (!accountId) return null
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('buildium_org_id', accountId)
    .maybeSingle()
  if (error && error.code !== 'PGRST116') throw error
  return data?.id ?? null
}

async function resolveLocalTenantId(
  supabase: any,
  buildiumTenantId?: number | null
): Promise<string | null> {
  if (!buildiumTenantId) return null
  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('buildium_tenant_id', buildiumTenantId)
    .maybeSingle()
  if (error && error.code !== 'PGRST116') throw error
  return data?.id ?? null
}

async function resolveLeaseWithOrg(supabase: any, buildiumLeaseId?: number | null): Promise<{ id: number | null; org_id: string | null }> {
  if (!buildiumLeaseId) return { id: null, org_id: null }
  const { data, error } = await supabase
    .from('lease')
    .select('id, org_id, property_id')
    .eq('buildium_lease_id', buildiumLeaseId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  if (!data) return { id: null, org_id: null }

  if (data.org_id) return { id: data.id, org_id: data.org_id }

  if (data.property_id) {
    const { data: property, error: propErr } = await supabase.from('properties').select('org_id').eq('id', data.property_id).single()
    if (propErr && propErr.code !== 'PGRST116') throw propErr
    return { id: data.id, org_id: property?.org_id ?? null }
  }

  return { id: data.id, org_id: null }
}

function mapHeaderFromBuildium(tx: any) {
  const payeeTenantId =
    tx?.PayeeTenantId ??
    tx?.PayeeTenantID ??
    tx?.Payee?.TenantId ??
    null
  return {
    buildium_transaction_id: tx?.Id,
    date: dateOnly(tx?.Date || tx?.TransactionDate || tx?.PostDate),
    transaction_type: tx?.TransactionTypeEnum || tx?.TransactionType,
    total_amount: typeof tx?.TotalAmount === 'number' ? tx.TotalAmount : (tx?.Amount ?? 0),
    check_number: tx?.CheckNumber ?? null,
    memo: tx?.Memo || tx?.Journal?.Memo || null,
    buildium_lease_id: tx?.LeaseId ?? null,
    payee_tenant_id: payeeTenantId,
  }
}

async function upsertWithLines(
  supabase: any,
  tx: any,
  buildiumAccountId?: number | null
): Promise<{ transactionId: string }> {
  const now = new Date().toISOString()
  const header = mapHeaderFromBuildium(tx)
  const leaseLookup = await resolveLeaseWithOrg(supabase, tx?.LeaseId)
  const leaseIdLocal = leaseLookup?.id ?? null
  const orgFromAccount = await resolveOrgIdFromBuildiumAccount(
    supabase,
    buildiumAccountId ?? (tx as any)?.AccountId ?? null
  )
  const orgIdLocal = orgFromAccount ?? leaseLookup?.org_id ?? null
  const tenantIdLocal = await resolveLocalTenantId(supabase, header.payee_tenant_id ?? null)
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
      .update({ ...header, lease_id: leaseIdLocal, org_id: orgIdLocal, tenant_id: tenantIdLocal, updated_at: now })
      .eq('id', existing.id)
      .select('id')
      .single()
    if (error) throw error
    transactionId = data.id
  } else {
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...header, lease_id: leaseIdLocal, org_id: orgIdLocal, tenant_id: tenantIdLocal, created_at: now, updated_at: now })
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
    const glId = await resolveGLAccountId(supabase, orgIdLocal, glBuildiumId)
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
    const credsRaw = body.credentials as Partial<BuildiumCredentials> | undefined
    const orgId = typeof body?.orgId === 'string' ? body.orgId : (typeof body?.org_id === 'string' ? body.org_id : null)
    currentBuildiumCreds = {
      baseUrl: (credsRaw?.baseUrl || Deno.env.get('BUILDIUM_BASE_URL') || 'https://apisandbox.buildium.com/v1').replace(/\/$/, ''),
      clientId: (credsRaw?.clientId || Deno.env.get('BUILDIUM_CLIENT_ID') || '').trim(),
      clientSecret: (credsRaw?.clientSecret || Deno.env.get('BUILDIUM_CLIENT_SECRET') || '').trim(),
    }

    if (!orgId) {
      return new Response(JSON.stringify({ success: false, error: 'orgId required for Buildium lease transaction API' }), { headers, status: 400 })
    }
    if (!currentBuildiumCreds.clientId || !currentBuildiumCreds.clientSecret) {
      return new Response(JSON.stringify({ success: false, error: 'Missing Buildium credentials' }), { headers, status: 400 })
    }

    let data: any

    switch (action) {
      case 'list': {
        const qp = new URLSearchParams()
        for (const k of ['orderby','offset','limit','dateFrom','dateTo']) {
          if (body?.[k] != null) qp.set(k, String(body[k]))
        }
        data = await buildium<any[]>(supabase, orgId, 'GET', `/leases/${leaseId}/transactions?${qp.toString()}`)
        break
      }
      case 'get': {
        data = await buildium<any>(supabase, orgId, 'GET', `/leases/${leaseId}/transactions/${transactionId}`)
        if (persist) await upsertWithLines(supabase, data, body?.AccountId ?? null)
        break
      }
      case 'create': {
        data = await buildium<any>(supabase, orgId, 'POST', `/leases/${leaseId}/transactions`, payload)
        if (persist) await upsertWithLines(supabase, data, body?.AccountId ?? null)
        break
      }
      case 'update': {
        data = await buildium<any>(supabase, orgId, 'PUT', `/leases/${leaseId}/transactions/${transactionId}`, payload)
        if (persist) await upsertWithLines(supabase, data, body?.AccountId ?? null)
        break
      }
      case 'listRecurring': {
        data = await buildium<any[]>(supabase, orgId, 'GET', `/leases/${leaseId}/recurringtransactions`)
        break
      }
      case 'getRecurring': {
        data = await buildium<any>(supabase, orgId, 'GET', `/leases/${leaseId}/recurringtransactions/${recurringId}`)
        break
      }
      case 'createRecurring': {
        data = await buildium<any>(supabase, orgId, 'POST', `/leases/${leaseId}/recurringtransactions`, payload)
        break
      }
      case 'updateRecurring': {
        data = await buildium<any>(supabase, orgId, 'PUT', `/leases/${leaseId}/recurringtransactions/${recurringId}`, payload)
        break
      }
      case 'deleteRecurring': {
        await buildium<void>(supabase, orgId, 'DELETE', `/leases/${leaseId}/recurringtransactions/${recurringId}`)
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
