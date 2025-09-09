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

// Buildium API Client (simplified for webhook processing)
class BuildiumClient {
  private baseUrl: string
  private apiKey: string

  constructor() {
    this.baseUrl = Deno.env.get('BUILDIUM_BASE_URL') || 'https://apisandbox.buildium.com/v1'
    this.apiKey = Deno.env.get('BUILDIUM_CLIENT_SECRET') || Deno.env.get('BUILDIUM_API_KEY') || ''
  }

  private async makeRequest<T>(method: string, endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'Accept': 'application/json'
    }

    const response = await fetch(url, { method, headers })
    
    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async getProperty(id: number): Promise<any> {
    return this.makeRequest('GET', `/properties/${id}`)
  }

  async getOwner(id: number): Promise<any> {
    return this.makeRequest('GET', `/owners/${id}`)
  }

  async getLease(id: number): Promise<any> {
    return this.makeRequest('GET', `/leases/${id}`)
  }
}

// Data mapping functions
async function mapPropertyFromBuildiumWithBankAccount(
  buildiumProperty: any, 
  supabase: any,
  buildiumClient: BuildiumClient
): Promise<any> {
  const baseProperty = {
    name: buildiumProperty.Name,
    rental_sub_type: mapPropertyTypeFromBuildium(buildiumProperty.PropertyType),
    address_line1: buildiumProperty.Address.AddressLine1,
    address_line2: buildiumProperty.Address.AddressLine2,
    city: buildiumProperty.Address.City,
    state: buildiumProperty.Address.State,
    postal_code: buildiumProperty.Address.PostalCode,
    country: buildiumProperty.Address.Country,
    year_built: buildiumProperty.YearBuilt,
    square_footage: buildiumProperty.SquareFootage,
    bedrooms: buildiumProperty.Bedrooms,
    bathrooms: buildiumProperty.Bathrooms,
    is_active: buildiumProperty.IsActive,
    buildium_property_id: buildiumProperty.Id,
    buildium_created_at: buildiumProperty.CreatedDate,
    buildium_updated_at: buildiumProperty.ModifiedDate
  }

  // Resolve bank account ID if OperatingBankAccountId exists
  let operatingBankAccountId = null
  if (buildiumProperty.OperatingBankAccountId) {
    try {
      // Check if bank account exists locally
      const { data: existingBankAccount } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('buildium_bank_id', buildiumProperty.OperatingBankAccountId)
        .single()
      
      if (existingBankAccount) {
        operatingBankAccountId = existingBankAccount.id
      } else {
        console.log(`Bank account ${buildiumProperty.OperatingBankAccountId} not found locally - skipping relationship`)
        // Note: In webhook context, we don't fetch missing bank accounts to avoid complexity
        // The full sync process should handle creating missing bank accounts
      }
    } catch (error) {
      console.warn('Error resolving bank account:', error)
    }
  }

  return {
    ...baseProperty,
    operating_bank_account_id: operatingBankAccountId
  }
}

function mapCountryFromBuildium(country?: string | null): string | null {
  if (!country) return null
  return country.replace(/([a-z])([A-Z])/g, '$1 $2')
}

function mapOwnerToContactFromBuildium(o: any) {
  return {
    is_company: !!o.IsCompany,
    first_name: o.IsCompany ? null : (o.FirstName || null),
    last_name: o.IsCompany ? null : (o.LastName || null),
    company_name: o.IsCompany ? (o.CompanyName || null) : null,
    primary_email: o.Email || null,
    alt_email: o.AlternateEmail || null,
    primary_phone: (o.PhoneNumbers?.Mobile || o.PhoneNumbers?.Home || o.PhoneNumbers?.Work || null),
    alt_phone: (o.PhoneNumbers?.Work || o.PhoneNumbers?.Home || null),
    date_of_birth: o.DateOfBirth || null,
    primary_address_line_1: o.Address?.AddressLine1 || null,
    primary_address_line_2: o.Address?.AddressLine2 || null,
    primary_address_line_3: o.Address?.AddressLine3 || null,
    primary_city: o.Address?.City || null,
    primary_state: o.Address?.State || null,
    primary_postal_code: o.Address?.PostalCode || null,
    primary_country: mapCountryFromBuildium(o.Address?.Country),
    alt_address_line_1: null,
    alt_address_line_2: null,
    alt_address_line_3: null,
    alt_city: null,
    alt_state: null,
    alt_postal_code: null,
    alt_country: null,
    mailing_preference: 'primary'
  }
}

async function findOrCreateOwnerContactEdge(o: any, supabase: any): Promise<number> {
  const email = o.Email || null
  if (email) {
    const { data: existing, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('primary_email', email)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    if (existing) {
      const mapped = mapOwnerToContactFromBuildium(o)
      const patch: Record<string, any> = {}
      for (const [k, v] of Object.entries(mapped)) {
        if (v !== null && v !== '' && (existing as any)[k] == null) patch[k] = v
      }
      if (Object.keys(patch).length) {
        const { error: updErr } = await supabase.from('contacts').update(patch).eq('id', existing.id)
        if (updErr) throw updErr
      }
      return existing.id
    }
  }
  const now = new Date().toISOString()
  const payload = mapOwnerToContactFromBuildium(o)
  const { data: created, error: insErr } = await supabase
    .from('contacts')
    .insert({ ...payload, created_at: now, updated_at: now })
    .select('id')
    .single()
  if (insErr) throw insErr
  return created.id
}

async function upsertOwnerFromBuildiumEdge(o: any, supabase: any): Promise<{ ownerId: string; created: boolean }>{
  const contactId = await findOrCreateOwnerContactEdge(o, supabase)
  const now = new Date().toISOString()
  const base: any = {
    contact_id: contactId,
    is_active: true,
    management_agreement_start_date: o.ManagementAgreementStartDate || null,
    management_agreement_end_date: o.ManagementAgreementEndDate || null,
    tax_address_line1: o.TaxInformation?.Address?.AddressLine1 || null,
    tax_address_line2: o.TaxInformation?.Address?.AddressLine2 || null,
    tax_address_line3: o.TaxInformation?.Address?.AddressLine3 || null,
    tax_city: o.TaxInformation?.Address?.City || null,
    tax_state: o.TaxInformation?.Address?.State || null,
    tax_postal_code: o.TaxInformation?.Address?.PostalCode || null,
    tax_country: mapCountryFromBuildium(o.TaxInformation?.Address?.Country),
    tax_payer_id: o.TaxInformation?.TaxPayerId || o.TaxId || null,
    tax_payer_name1: o.TaxInformation?.TaxPayerName1 || null,
    tax_payer_name2: o.TaxInformation?.TaxPayerName2 || null,
    tax_include1099: typeof o.TaxInformation?.IncludeIn1099 === 'boolean' ? o.TaxInformation.IncludeIn1099 : null,
    buildium_owner_id: o.Id,
    buildium_created_at: o.CreatedDate || null,
    buildium_updated_at: o.ModifiedDate || null,
    updated_at: now
  }

  const { data: existing, error } = await supabase
    .from('owners')
    .select('id')
    .eq('buildium_owner_id', o.Id)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  if (existing) {
    const { error: updErr } = await supabase.from('owners').update(base).eq('id', existing.id)
    if (updErr) throw updErr
    return { ownerId: existing.id, created: false }
  } else {
    const insertPayload = { ...base, created_at: now }
    const { data: created, error: insErr2 } = await supabase
      .from('owners')
      .insert(insertPayload)
      .select('id')
      .single()
    if (insErr2) throw insErr2
    return { ownerId: created.id, created: true }
  }
}

function mapPropertyTypeFromBuildium(buildiumType: string): string {
  switch (buildiumType) {
    case 'Commercial':
      return 'Office'
    case 'Association':
      return 'Rental'
    default:
      return 'Rental'
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
      // For now, we'll log the signature for debugging
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
    console.log('Received webhook with', payload.Events.length, 'events')

    // Store webhook event in database
    for (const event of payload.Events) {
      try {
        await supabase
          .from('buildium_webhook_events')
          .insert({
            event_id: event.Id,
            event_type: event.EventType,
            event_data: event,
            processed: false
          })
      } catch (error) {
        console.error('Failed to store webhook event:', error)
      }
    }

    // Process webhook events
    const results = []
    for (const event of payload.Events) {
      try {
        const result = await processWebhookEvent(event, buildiumClient, supabase)
        results.push({ eventId: event.Id, success: result.success, error: result.error })
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

    console.log('Webhook processing completed:', {
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
    console.error('Error in buildium-webhook function:', error)
    
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

async function processWebhookEvent(
  event: BuildiumWebhookEvent, 
  buildiumClient: BuildiumClient, 
  supabase: any
): Promise<{ success: boolean; error?: string }> {
  try {
    switch (event.EventType) {
      case 'PropertyCreated':
      case 'PropertyUpdated':
        return await processPropertyEvent(event, buildiumClient, supabase)
      
      case 'OwnerCreated':
      case 'OwnerUpdated':
        return await processOwnerEvent(event, buildiumClient, supabase)

      case 'LeaseCreated':
      case 'LeaseUpdated':
        return await processLeaseEvent(event, buildiumClient, supabase)
      
      default:
        console.log('Unhandled webhook event type:', event.EventType)
        return { success: true } // Don't fail for unhandled events
    }
  } catch (error) {
    const errorMessage = error.message || 'Unknown error'
    console.error('Error processing webhook event:', errorMessage)
    return { success: false, error: errorMessage }
  }
}

async function processPropertyEvent(
  event: BuildiumWebhookEvent, 
  buildiumClient: BuildiumClient, 
  supabase: any
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch the full property data from Buildium
    const property = await buildiumClient.getProperty(event.EntityId)
    
    // Map to local format with bank account resolution
    const localData = await mapPropertyFromBuildiumWithBankAccount(property, supabase, buildiumClient)

    // Check if property already exists locally
    const { data: existingProperty } = await supabase
      .from('properties')
      .select('id')
      .eq('buildium_property_id', property.Id)
      .single()

    if (existingProperty) {
      // Update existing property
      await supabase
        .from('properties')
        .update(localData)
        .eq('id', existingProperty.id)

      console.log('Property updated from Buildium:', existingProperty.id)
      return { success: true }
    } else {
      // Create new property
      const { data: newProperty, error } = await supabase
        .from('properties')
        .insert(localData)
        .select()
        .single()

      if (error) throw error

      console.log('Property created from Buildium:', newProperty.id)
      return { success: true }
    }
  } catch (error) {
    const errorMessage = error.message || 'Unknown error'
    return { success: false, error: errorMessage }
  }
}

async function processOwnerEvent(
  event: BuildiumWebhookEvent, 
  buildiumClient: BuildiumClient, 
  supabase: any
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch the full owner data from Buildium
    const owner = await buildiumClient.getOwner(event.EntityId)
    const res = await upsertOwnerFromBuildiumEdge(owner, supabase)
    console.log(res.created ? 'Owner created from webhook' : 'Owner updated from webhook', res.ownerId)
    return { success: true }
  } catch (error) {
    const errorMessage = error.message || 'Unknown error'
    return { success: false, error: errorMessage }
  }
}

async function processLeaseEvent(
  event: BuildiumWebhookEvent,
  buildiumClient: BuildiumClient,
  supabase: any
): Promise<{ success: boolean; error?: string }> {
  try {
    // Delegate to buildium-sync edge function to ensure consistent mapping/upsert
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/buildium-sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ entityType: 'lease', operation: 'syncOneFromBuildium', entityData: { Id: event.EntityId } })
    })
    if (!res.ok) {
      const details = await res.json().catch(() => ({}))
      console.error('Edge lease sync failed', details)
      return { success: false, error: 'Edge lease sync failed' }
    }
    return { success: true }
  } catch (error) {
    const errorMessage = (error as any)?.message || 'Unknown error'
    return { success: false, error: errorMessage }
  }
}
