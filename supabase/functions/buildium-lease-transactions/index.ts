import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyBuildiumSignature } from '../_shared/buildiumSignature.ts'
import { insertBuildiumWebhookEventRecord } from '../_shared/webhookEvents.ts'
import { validateBuildiumEvent } from '../_shared/eventValidation.ts'
import {
  LeaseTransactionsWebhookPayloadSchema,
  deriveEventType,
  type BuildiumWebhookEvent,
  type LeaseTransactionsWebhookPayload,
  validateWebhookPayload,
} from '../_shared/webhookSchemas.ts'
import { routeLeaseTransactionWebhookEvent } from '../_shared/eventRouting.ts'
import { emitRoutingTelemetry } from '../_shared/telemetry.ts'
import { sendPagerDutyEvent } from '../_shared/pagerDuty.ts'

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
    const amountAbs = Math.abs(Number(line?.Amount ?? 0))
    const posting = resolvePostingType(line)
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
      amount: amountAbs,
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

    if (posting === 'Debit') debit += amountAbs
    else credit += amountAbs
  }

  if (debit > 0 && credit > 0 && Math.abs(debit - credit) > 0.0001) {
    throw new Error(`Double-entry integrity violation: debits (${debit}) != credits (${credit})`)
  }

  return transactionId
}

const leaseTransactionsSignatureCache = new Map<string, number>()
const MAX_RETRIES = 3
const BACKOFF_BASE_MS = 200

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeLeaseTransactionsPayload(
  body: unknown
): { Events: BuildiumWebhookEvent[]; credentials?: LeaseTransactionsWebhookPayload['credentials'] } | null {
  const raw = body as any
  if (!raw || typeof raw !== 'object') return null

  if (Array.isArray(raw.Events)) {
    return { Events: raw.Events as BuildiumWebhookEvent[], credentials: raw.credentials }
  }

  if (raw.Event && typeof raw.Event === 'object') {
    return { Events: [raw.Event as BuildiumWebhookEvent], credentials: raw.credentials }
  }

  const looksLikeSingleEvent =
    typeof raw.EventType === 'string' ||
    typeof raw.EventName === 'string' ||
    raw.Id != null ||
    raw.EventId != null ||
    raw.TransactionId != null ||
    raw.LeaseId != null ||
    raw.EntityId != null

  if (looksLikeSingleEvent) {
    return { Events: [raw as BuildiumWebhookEvent], credentials: raw.credentials }
  }

  return null
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

    const rawBody = await req.text()

    const verification = await verifyBuildiumSignature(req.headers, rawBody, {
      replayCache: leaseTransactionsSignatureCache,
    })
    if (!verification.ok) {
      console.warn('buildium-lease-transactions signature rejected', {
        reason: verification.reason,
        status: verification.status,
        timestamp: verification.timestamp ?? null,
        signaturePreview: verification.signature ? verification.signature.slice(0, 12) : null,
        metric: 'buildium_lease_transactions.signature_failure',
      })
      return new Response(
        JSON.stringify({ error: 'Invalid signature', reason: verification.reason }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: verification.status,
        }
      )
    }

    // Parse webhook payload
    let parsedBody: unknown
    try {
      parsedBody = JSON.parse(rawBody || '')
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

    const normalizedPayload = normalizeLeaseTransactionsPayload(parsedBody)
    if (!normalizedPayload) {
      console.warn('buildium-lease-transactions payload missing events', {
        hasEventsArray: Array.isArray((parsedBody as any)?.Events),
        keys: parsedBody && typeof parsedBody === 'object' ? Object.keys(parsedBody as any) : [],
      })
      return new Response(
        JSON.stringify({ error: 'No webhook events found in payload' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    const payloadResult = validateWebhookPayload(normalizedPayload, LeaseTransactionsWebhookPayloadSchema)
    if (!payloadResult.ok) {
      console.warn('buildium-lease-transactions schema validation failed', {
        errors: payloadResult.errors,
        eventTypes: normalizedPayload.Events.map((evt: any) => deriveEventType(evt)),
      })
      await sendPagerDutyEvent({
        summary: 'Buildium lease-transactions webhook schema validation failed',
        severity: 'warning',
        custom_details: { errors: payloadResult.errors, eventTypes: normalizedPayload.Events.map((evt: any) => deriveEventType(evt)) },
      })
      return new Response(
        JSON.stringify({ error: 'Invalid payload', details: payloadResult.errors }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    const payload: LeaseTransactionsWebhookPayload = payloadResult.data

    const validationFailures = payload.Events.map((event, idx) => {
      const validation = validateBuildiumEvent(event)
      if (validation.ok) return null
      return {
        index: idx,
        eventType: deriveEventType(event as Record<string, unknown>),
        eventId: event.Id ?? event.EventId ?? null,
        errors: validation.errors,
      }
    }).filter(Boolean) as Array<{ index: number; eventType: string; eventId: unknown; errors: string[] }>

    if (validationFailures.length) {
      console.warn('buildium-lease-transactions payload validation failed', { failures: validationFailures })
      await sendPagerDutyEvent({
        summary: 'Buildium lease-transactions webhook payload validation failed',
        severity: 'warning',
        custom_details: { failures: validationFailures },
      })
      return new Response(
        JSON.stringify({ error: 'Invalid payload', details: validationFailures }),
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

    // Process webhook events (only lease transaction events) with idempotent insert
    const results = []
    for (const event of payload.Events) {
      const eventType = deriveEventType(event as Record<string, unknown>)

      const storeResult = await insertBuildiumWebhookEventRecord(supabase, event, {
        webhookType: 'lease-transactions',
        signature: verification.signature ?? null,
      })

      if (storeResult.status === 'invalid') {
        console.warn('buildium-lease-transactions normalization failed', {
          errors: storeResult.errors,
          eventType: event?.EventType,
        })
        results.push({ eventId: null, success: false, error: 'invalid-normalization', details: storeResult.errors, eventType })
        continue
      }

      if (storeResult.status === 'duplicate') {
        console.warn('buildium-lease-transactions duplicate delivery', {
          webhookId: storeResult.normalized.buildiumWebhookId,
          eventName: storeResult.normalized.eventName,
          eventCreatedAt: storeResult.normalized.eventCreatedAt,
        })
        results.push({ eventId: storeResult.normalized.buildiumWebhookId, success: true, duplicate: true, eventType })
        continue
      }

      const routingDecision = routeLeaseTransactionWebhookEvent(eventType)
      if (routingDecision !== 'process') {
        const status = routingDecision === 'dead-letter' ? 'dead-letter' : 'skipped'
        await emitRoutingTelemetry('buildium-lease-transactions', routingDecision, storeResult.normalized, eventType)
        await supabase
          .from('buildium_webhook_events')
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
            status,
            retry_count: 0,
            error_message: routingDecision === 'dead-letter' ? 'unsupported_event_type' : null,
          })
          .eq('buildium_webhook_id', storeResult.normalized.buildiumWebhookId)
          .eq('event_name', storeResult.normalized.eventName)
          .eq('event_created_at', storeResult.normalized.eventCreatedAt)

        console.warn('buildium-lease-transactions routing skipped event', {
          eventType,
          routingDecision,
          webhookId: storeResult.normalized.buildiumWebhookId,
        })
        results.push({
          eventId: storeResult.normalized.buildiumWebhookId,
          success: routingDecision === 'skip',
          skipped: routingDecision === 'skip',
          deadLetter: routingDecision === 'dead-letter',
          eventType,
        })
        continue
      }

      let attempt = 0
      let processed = false
      let lastError: any = null
      while (attempt < MAX_RETRIES && !processed) {
        attempt++
        try {
          const result = await processLeaseTransactionEvent(event, eventType, buildiumClient, supabase)
          results.push({ eventId: storeResult.normalized.buildiumWebhookId, success: result.success, error: result.error, eventType })

          if (result.success) {
            await supabase
              .from('buildium_webhook_events')
              .update({
                processed: true,
                processed_at: new Date().toISOString(),
                status: 'processed',
                retry_count: attempt - 1,
                error_message: null,
              })
              .eq('buildium_webhook_id', storeResult.normalized.buildiumWebhookId)
              .eq('event_name', storeResult.normalized.eventName)
              .eq('event_created_at', storeResult.normalized.eventCreatedAt)
            processed = true
          } else {
            throw new Error(result.error || 'Unknown processing failure')
          }
        } catch (error) {
          lastError = error
          const errorMessage = error.message || 'Unknown error'
          console.error('buildium-lease-transactions processing failed', {
            eventId: storeResult.normalized.buildiumWebhookId,
            eventName: storeResult.normalized.eventName,
            attempt,
            error: errorMessage,
          })
          const isLastAttempt = attempt >= MAX_RETRIES
          await supabase
            .from('buildium_webhook_events')
            .update({
              retry_count: attempt,
              error_message: errorMessage,
              status: isLastAttempt ? 'dead-letter' : 'retrying',
              processed: isLastAttempt ? false : false,
            })
            .eq('buildium_webhook_id', storeResult.normalized.buildiumWebhookId)
            .eq('event_name', storeResult.normalized.eventName)
            .eq('event_created_at', storeResult.normalized.eventCreatedAt)

          if (!isLastAttempt) {
            const backoffMs = BACKOFF_BASE_MS * Math.pow(2, attempt - 1)
            await sleep(backoffMs)
          }
        }
      }

      if (!processed) {
        results.push({
          eventId: storeResult.normalized.buildiumWebhookId,
          success: false,
          error: (lastError as any)?.message || 'failed after retries',
          deadLetter: true,
        })
      }
    }

    // Emit backlog metric
    try {
      const { count: backlogCount } = await supabase
        .from('buildium_webhook_events')
        .select('id', { count: 'exact', head: true })
        .eq('processed', false)
      console.log('buildium-lease-transactions backlog depth', { backlogCount })
    } catch (e) {
      console.warn('buildium-lease-transactions backlog metric failed', { error: (e as any)?.message })
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
  eventType: string,
  buildiumClient: BuildiumClient, 
  supabase: any
): Promise<{ success: boolean; error?: string }> {
  try {
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
