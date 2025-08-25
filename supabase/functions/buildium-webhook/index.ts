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
}

// Data mapping functions
function mapPropertyFromBuildium(buildiumProperty: any): any {
  return {
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
}

function mapOwnerFromBuildium(buildiumOwner: any): any {
  return {
    name: `${buildiumOwner.FirstName} ${buildiumOwner.LastName}`.trim(),
    email: buildiumOwner.Email,
    phone_number: buildiumOwner.PhoneNumber,
    address_line1: buildiumOwner.Address.AddressLine1,
    address_line2: buildiumOwner.Address.AddressLine2,
    city: buildiumOwner.Address.City,
    state: buildiumOwner.Address.State,
    postal_code: buildiumOwner.Address.PostalCode,
    country: buildiumOwner.Address.Country,
    tax_id: buildiumOwner.TaxId,
    is_active: buildiumOwner.IsActive,
    buildium_owner_id: buildiumOwner.Id,
    buildium_created_at: buildiumOwner.CreatedDate,
    buildium_updated_at: buildiumOwner.ModifiedDate
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
    
    // Map to local format
    const localData = mapPropertyFromBuildium(property)

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
    
    // Map to local format
    const localData = mapOwnerFromBuildium(owner)

    // Check if owner already exists locally
    const { data: existingOwner } = await supabase
      .from('owners')
      .select('id')
      .eq('buildium_owner_id', owner.Id)
      .single()

    if (existingOwner) {
      // Update existing owner
      await supabase
        .from('owners')
        .update(localData)
        .eq('id', existingOwner.id)

      console.log('Owner updated from Buildium:', existingOwner.id)
      return { success: true }
    } else {
      // Create new owner
      const { data: newOwner, error } = await supabase
        .from('owners')
        .insert(localData)
        .select()
        .single()

      if (error) throw error

      console.log('Owner created from Buildium:', newOwner.id)
      return { success: true }
    }
  } catch (error) {
    const errorMessage = error.message || 'Unknown error'
    return { success: false, error: errorMessage }
  }
}
