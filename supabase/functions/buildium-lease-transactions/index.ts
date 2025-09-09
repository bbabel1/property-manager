import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Types for webhook events
interface BuildiumWebhookEvent {
  Id: string
  EventType: string
  EntityId: number
  EntityType: string
  EventDate: string
  Data: any
}

interface BuildiumWebhookPayload {
  Events: BuildiumWebhookEvent[]
}

// Buildium API Client for lease transactions
class BuildiumClient {
  private baseUrl: string
  private clientId: string
  private clientSecret: string

  constructor() {
    this.baseUrl = Deno.env.get('BUILDIUM_BASE_URL') || 'https://apisandbox.buildium.com/v1'
    this.clientId = Deno.env.get('BUILDIUM_CLIENT_ID') || ''
    this.clientSecret = Deno.env.get('BUILDIUM_CLIENT_SECRET') || ''
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

    // Initialize Buildium client
    const buildiumClient = new BuildiumClient()

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
        if (event.EventType.includes('LeaseTransaction')) {
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
    console.log('Processing lease transaction event:', event.EventType, 'for entity:', event.EntityId)
    
    if (event.EventType === 'LeaseTransactionDeleted') {
      // Handle deletion - no hard delete; cannot reliably map without more info
      // Leave a breadcrumb in transactions (optional: set memo)
      const { data: existingTransaction } = await supabase
        .from('transactions')
        .select('id')
        .eq('buildium_transaction_id', event.EntityId)
        .single()

      if (existingTransaction) {
        await supabase
          .from('transactions')
          .update({ memo: 'Buildium LeaseTransactionDeleted', updated_at: new Date().toISOString() })
          .eq('id', existingTransaction.id)

        console.log('Lease transaction flagged as deleted:', existingTransaction.id)
        return { success: true }
      }
      
      return { success: true } // Transaction not found locally, nothing to do
    }

    // Fetch the full transaction data from Buildium
    const leaseId = (event as any)?.Data?.LeaseId
    if (!leaseId) {
      console.warn('LeaseId missing on webhook event; cannot fetch transaction', event)
      return { success: false, error: 'LeaseId missing on webhook event' }
    }
    const transaction = await buildiumClient.getLeaseTransaction(leaseId, event.EntityId)
    
    // Map to local format
    const localData = mapLeaseTransactionFromBuildium(transaction)

    // Check if transaction already exists locally
    const { data: existingTransaction } = await supabase
      .from('transactions')
      .select('id')
      .eq('buildium_transaction_id', transaction.Id)
      .single()

    if (existingTransaction) {
      // Update existing transaction
      await supabase
        .from('transactions')
        .update(localData)
        .eq('id', existingTransaction.id)

      console.log('Lease transaction updated from Buildium:', existingTransaction.id)
      return { success: true }
    } else {
      // Create new transaction
      const { data: newTransaction, error } = await supabase
        .from('transactions')
        .insert({ ...localData, created_at: new Date().toISOString() })
        .select()
        .single()

      if (error) throw error

      console.log('Lease transaction created from Buildium:', newTransaction.id)
      return { success: true }
    }
  } catch (error) {
    const errorMessage = error.message || 'Unknown error'
    console.error('Error processing lease transaction event:', errorMessage)
    return { success: false, error: errorMessage }
  }
}
