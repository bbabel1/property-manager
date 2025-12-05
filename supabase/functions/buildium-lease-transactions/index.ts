import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Types for webhook events
interface BuildiumWebhookEvent {
  Id: string
  EventType: string
  EventName?: string
  EntityId: number
  TransactionId?: number
  LeaseId?: number
  EntityType: string
  EventDate: string
  Data: any
}

interface BuildiumWebhookPayload {
  Events: BuildiumWebhookEvent[]
  credentials?: {
    baseUrl?: string
    clientId?: string
    clientSecret?: string
  }
}

// Buildium API Client for lease transactions
class BuildiumClient {
  private baseUrl: string
  private clientId: string
  private clientSecret: string

  constructor(opts?: { baseUrl?: string; clientId?: string; clientSecret?: string }) {
    this.baseUrl = opts?.baseUrl || Deno.env.get('BUILDIUM_BASE_URL') || 'https://apisandbox.buildium.com/v1'
    this.clientId = opts?.clientId || Deno.env.get('BUILDIUM_CLIENT_ID') || ''
    this.clientSecret = opts?.clientSecret || Deno.env.get('BUILDIUM_CLIENT_SECRET') || ''
  }

  private async makeRequest<T>(method: string, endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-buildium-client-id': this.clientId,
      'x-buildium-client-secret': this.clientSecret
    }

    const response = await fetch(url, { method, headers })
    
    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async getLeaseTransaction(leaseId: number, id: number): Promise<any> {
    return this.makeRequest('GET', `/leases/${leaseId}/transactions/${id}`)
  }

  async getGLAccount(id: number): Promise<any> {
    return this.makeRequest('GET', `/glaccounts/${id}`)
  }
}

// Data mapping function for lease transactions -> transactions table
function mapLeaseTransactionFromBuildium(buildiumTransaction: any): any {
  const txType = buildiumTransaction?.TransactionTypeEnum || buildiumTransaction?.TransactionType
  const amount = typeof buildiumTransaction?.TotalAmount === 'number' ? buildiumTransaction.TotalAmount : (buildiumTransaction?.Amount ?? 0)
  const date = buildiumTransaction?.Date || buildiumTransaction?.TransactionDate || buildiumTransaction?.PostDate

  return {
    buildium_transaction_id: buildiumTransaction?.Id,
    date: (date || new Date().toISOString()).slice(0, 10),
    transaction_type: txType,
    total_amount: Number(amount || 0),
    check_number: buildiumTransaction?.CheckNumber ?? null,
    memo: buildiumTransaction?.Memo || buildiumTransaction?.Journal?.Memo || null,
    buildium_lease_id: buildiumTransaction?.LeaseId ?? null,
    payee_tenant_id: buildiumTransaction?.PayeeTenantId ?? null,
    // payment_method is an enum locally; leave null here to avoid mismatch
    payment_method: null,
    updated_at: new Date().toISOString(),
  }
}

function normalizeDate(d?: string | null): string | null {
  if (!d) return null
  // Avoid timezone shifts: prefer direct string slicing
  const s = String(d)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  if (s.includes('T')) return s.slice(0, 10)
  return null
}

async function resolveLocalPropertyId(
  supabase: any,
  buildiumPropertyId: number | null | undefined
): Promise<string | null> {
  if (!buildiumPropertyId) return null
  const { data, error } = await supabase
    .from('properties')
    .select('id')
    .eq('buildium_property_id', buildiumPropertyId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data?.id ?? null
}

async function resolveLocalUnitId(
  supabase: any,
  buildiumUnitId: number | null | undefined
): Promise<string | null> {
  if (!buildiumUnitId) return null
  const { data, error } = await supabase
    .from('units')
    .select('id')
    .eq('buildium_unit_id', buildiumUnitId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data?.id ?? null
}

async function resolveLocalLeaseId(
  supabase: any,
  buildiumLeaseId: number | null | undefined
): Promise<number | null> {
  if (!buildiumLeaseId) return null
  const { data, error } = await supabase
    .from('lease')
    .select('id')
    .eq('buildium_lease_id', buildiumLeaseId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data?.id ?? null
}

async function resolveGLAccountId(
  supabase: any,
  buildiumClient: BuildiumClient,
  buildiumGLAccountId: number | null | undefined
): Promise<string | null> {
  if (!buildiumGLAccountId) return null

  const { data: existing, error: findErr } = await supabase
    .from('gl_accounts')
    .select('id')
    .eq('buildium_gl_account_id', buildiumGLAccountId)
    .single()
  if (findErr && findErr.code !== 'PGRST116') throw findErr
  if (existing) return existing.id

  // Fetch from Buildium and insert minimal row
  const remote = await buildiumClient.getGLAccount(buildiumGLAccountId)
  const now = new Date().toISOString()
  const row = {
    buildium_gl_account_id: remote.Id,
    account_number: remote.AccountNumber ?? null,
    name: remote.Name,
    description: remote.Description ?? null,
    type: remote.Type,
    sub_type: remote.SubType ?? null,
    is_default_gl_account: !!remote.IsDefaultGLAccount,
    default_account_name: remote.DefaultAccountName ?? null,
    is_contra_account: !!remote.IsContraAccount,
    is_bank_account: !!remote.IsBankAccount,
    cash_flow_classification: remote.CashFlowClassification ?? null,
    exclude_from_cash_balances: !!remote.ExcludeFromCashBalances,
    is_active: remote.IsActive ?? true,
    buildium_parent_gl_account_id: remote.ParentGLAccountId ?? null,
    is_credit_card_account: !!remote.IsCreditCardAccount,
    sub_accounts: null,
    created_at: now,
    updated_at: now
  }
  const { data: inserted, error: insErr } = await supabase
    .from('gl_accounts')
    .insert(row)
    .select('id')
    .single()
  if (insErr) throw insErr
  return inserted.id
}

async function upsertLeaseTransactionWithLines(
  supabase: any,
  buildiumClient: BuildiumClient,
  leaseTx: any
): Promise<string> {
  const now = new Date().toISOString()
  const transactionHeader = {
    buildium_transaction_id: leaseTx.Id,
    date: normalizeDate(leaseTx.Date),
    transaction_type: leaseTx.TransactionType || leaseTx.TransactionTypeEnum || 'Lease',
    total_amount: typeof leaseTx.TotalAmount === 'number' ? leaseTx.TotalAmount : Number(leaseTx.Amount ?? 0),
    check_number: leaseTx.CheckNumber ?? null,
    buildium_lease_id: leaseTx.LeaseId ?? null,
    memo: leaseTx?.Journal?.Memo ?? leaseTx?.Memo ?? null,
    payment_method: leaseTx.PaymentMethod ?? null,
    updated_at: now
  }

  // Upsert transaction header
  const { data: existing, error: findErr } = await supabase
    .from('transactions')
    .select('id')
    .eq('buildium_transaction_id', leaseTx.Id)
    .single()
  if (findErr && findErr.code !== 'PGRST116') throw findErr

  const leaseIdLocal = await resolveLocalLeaseId(supabase, leaseTx.LeaseId ?? null)
  let transactionId: string
  if (existing?.id) {
    const { data, error } = await supabase
      .from('transactions')
      .update({ ...transactionHeader, lease_id: leaseIdLocal })
      .eq('id', existing.id)
      .select('id')
      .single()
    if (error) throw error
    transactionId = data.id
  } else {
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...transactionHeader, lease_id: leaseIdLocal, created_at: now })
      .select('id')
      .single()
    if (error) throw error
    transactionId = data.id
  }

  // Replace lines
  await supabase.from('transaction_lines').delete().eq('transaction_id', transactionId)

  const lines = Array.isArray(leaseTx?.Journal?.Lines) ? leaseTx.Journal.Lines : Array.isArray(leaseTx?.Lines) ? leaseTx.Lines : []
  let debit = 0, credit = 0

  for (const line of lines) {
    const amount = Number(line?.Amount ?? 0)
    const posting = amount >= 0 ? 'Credit' : 'Debit'
    const glBuildiumId = typeof line?.GLAccount === 'number'
      ? line?.GLAccount
      : (line?.GLAccount?.Id ?? line?.GLAccountId ?? null)
    const glId = await resolveGLAccountId(supabase, buildiumClient, glBuildiumId)
    if (!glId) throw new Error(`GL account not found for line. BuildiumId=${glBuildiumId}`)

    const buildiumPropertyId = line?.PropertyId ?? null
    const buildiumUnitId = line?.Unit?.Id ?? line?.UnitId ?? null
    const propertyIdLocal = await resolveLocalPropertyId(supabase, buildiumPropertyId)
    const unitIdLocal = await resolveLocalUnitId(supabase, buildiumUnitId)

    await supabase.from('transaction_lines').insert({
      transaction_id: transactionId,
      gl_account_id: glId,
      amount: Math.abs(amount),
      posting_type: posting,
      memo: line?.Memo ?? null,
      account_entity_type: 'Rental',
      account_entity_id: buildiumPropertyId,
      date: normalizeDate(leaseTx.Date),
      created_at: now,
      updated_at: now,
      buildium_property_id: buildiumPropertyId,
      buildium_unit_id: buildiumUnitId,
      buildium_lease_id: leaseTx.LeaseId ?? null,
      property_id: propertyIdLocal,
      unit_id: unitIdLocal
    })

    if (posting === 'Debit') debit += Math.abs(amount)
    else credit += Math.abs(amount)
  }

  if (debit > 0 && credit > 0 && Math.abs(debit - credit) > 0.0001) {
    throw new Error(`Double-entry integrity violation: debits (${debit}) != credits (${credit})`)
  }

  return transactionId
}

// Main handler
serve(async (req) => {
  try {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 405,
        }
      )
    }

    // Verify webhook signature (if provided)
    const signature = req.headers.get('x-buildium-signature')
    const webhookSecret = Deno.env.get('BUILDIUM_WEBHOOK_SECRET')
    
    if (webhookSecret && signature) {
      // TODO: Implement signature verification
      console.log('Webhook signature received:', signature)
    }

    // Parse webhook payload
    let payload: BuildiumWebhookPayload
    try {
      payload = await req.json()
    } catch (parseError) {
      console.error('Failed to parse webhook payload:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Initialize Buildium client (allow per-request override for testing/local)
    const buildiumClient = new BuildiumClient(payload.credentials)

    // Log webhook event
    console.log('Received lease transaction webhook with', payload.Events.length, 'events')

    // Store webhook event in database
    for (const event of payload.Events) {
      try {
        await supabase
          .from('buildium_webhook_events')
          .insert({
            event_id: event.Id,
            event_type: event.EventType,
            event_data: event,
            processed: false,
            webhook_type: 'lease-transactions'
          })
      } catch (error) {
        console.error('Failed to store webhook event:', error)
      }
    }

    // Process webhook events (only lease transaction events)
    const results = []
    for (const event of payload.Events) {
      try {
        // Only process lease transaction events
        const eventType = event.EventType || (event as any)?.EventName || ''
        if (eventType.includes('LeaseTransaction')) {
          const result = await processLeaseTransactionEvent(event, buildiumClient, supabase)
          results.push({ eventId: event.Id, success: result.success, error: result.error })
        } else {
          console.log('Skipping non-lease-transaction event:', event.EventType)
          results.push({ eventId: event.Id, success: true, skipped: true })
        }
      } catch (error) {
        const errorMessage = error.message || 'Unknown error'
        console.error('Failed to process webhook event:', errorMessage)
        results.push({ eventId: event.Id, success: false, error: errorMessage })
      }
    }

    // Mark events as processed
    for (const event of payload.Events) {
      try {
        await supabase
          .from('buildium_webhook_events')
          .update({ 
            processed: true, 
            processed_at: new Date().toISOString() 
          })
          .eq('event_id', event.Id)
      } catch (error) {
        console.error('Failed to mark webhook event as processed:', error)
      }
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.length - successCount

    console.log('Lease transaction webhook processing completed:', {
      totalEvents: results.length,
      successCount,
      failureCount
    })

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successful: successCount,
        failed: failureCount,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in buildium-lease-transactions webhook function:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      {
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          'Content-Type': 'application/json' 
        },
        status: 500,
      }
    )
  }
})

async function processLeaseTransactionEvent(
  event: BuildiumWebhookEvent, 
  buildiumClient: BuildiumClient, 
  supabase: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const eventType = event.EventType || (event as any)?.EventName || ''
    console.log('Processing lease transaction event:', eventType, 'for entity:', event.EntityId)
    
    if (eventType === 'LeaseTransactionDeleted' || eventType === 'LeaseTransaction.Deleted') {
      const transactionId = (event as any)?.Data?.TransactionId ?? (event as any)?.TransactionId ?? event.EntityId
      const { data: existingTransaction } = await supabase
        .from('transactions')
        .select('id')
        .eq('buildium_transaction_id', transactionId)
        .single()

      if (existingTransaction?.id) {
        await supabase.from('transaction_lines').delete().eq('transaction_id', existingTransaction.id)
        await supabase.from('transactions').delete().eq('id', existingTransaction.id)
        console.log('Lease transaction deleted locally:', existingTransaction.id)
      } else {
        console.log('Lease transaction delete received but not found locally:', transactionId)
      }
      return { success: true }
    }

    // Use provided transaction (if forwarded) or fetch from Buildium
    const leaseId = (event as any)?.Data?.LeaseId ?? (event as any)?.LeaseId ?? null
    const transactionId = (event as any)?.Data?.TransactionId ?? (event as any)?.TransactionId ?? event.EntityId
    const forwardedTx = (event as any)?.Data?.FullTransaction || (event as any)?.Data?.Transaction
    let transaction = forwardedTx
    if (!transaction) {
      if (!leaseId) {
        console.warn('LeaseId missing on webhook event; cannot fetch transaction', event)
        return { success: false, error: 'LeaseId missing on webhook event' }
      }
      transaction = await buildiumClient.getLeaseTransaction(leaseId, transactionId)
    }
    
    // Map + upsert transaction header and lines
    await upsertLeaseTransactionWithLines(supabase, buildiumClient, transaction)
    console.log('Lease transaction synced from Buildium with lines:', transaction.Id)
    return { success: true }
  } catch (error) {
    const errorMessage = error.message || 'Unknown error'
    console.error('Error processing lease transaction event:', errorMessage)
    return { success: false, error: errorMessage }
  }
}
