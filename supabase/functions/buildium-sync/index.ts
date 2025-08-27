import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Types for Buildium API
interface BuildiumApiConfig {
  baseUrl: string
  apiKey: string
  clientId?: string
  timeout?: number
  retryAttempts?: number
  retryDelay?: number
}

interface BuildiumProperty {
  Id: number
  Name: string
  PropertyType: 'Rental' | 'Association' | 'Commercial'
  Address: {
    AddressLine1: string
    AddressLine2?: string
    City: string
    State: string
    PostalCode: string
    Country: string
  }
  YearBuilt?: number
  SquareFootage?: number
  Bedrooms?: number
  Bathrooms?: number
  IsActive: boolean
  CreatedDate: string
  ModifiedDate: string
}

interface BuildiumOwner {
  Id: number
  FirstName: string
  LastName: string
  Email?: string
  PhoneNumber?: string
  Address: {
    AddressLine1: string
    AddressLine2?: string
    City: string
    State: string
    PostalCode: string
    Country: string
  }
  TaxId?: string
  IsActive: boolean
  CreatedDate: string
  ModifiedDate: string
}

interface BuildiumUnit {
  Id: number
  UnitNumber: string
  UnitType: string
  SquareFootage?: number
  MarketRent?: number
  Bedrooms?: number
  Bathrooms?: number
  IsActive: boolean
  CreatedDate: string
  ModifiedDate: string
  Address?: {
    AddressLine1: string
    AddressLine2?: string
    City: string
    State: string
    PostalCode: string
    Country: string
  }
}

// Buildium API Client - Direct API calls with client credentials
class BuildiumClient {
  private baseUrl: string
  private clientId: string
  private clientSecret: string
  private timeout: number
  private retryAttempts: number
  private retryDelay: number

  constructor(config: { baseUrl?: string; clientId?: string; clientSecret?: string; timeout?: number; retryAttempts?: number; retryDelay?: number }) {
    this.baseUrl = config.baseUrl || 'https://apisandbox.buildium.com/v1'
    this.clientId = config.clientId || ''
    this.clientSecret = config.clientSecret || ''
    this.timeout = config.timeout || 30000
    this.retryAttempts = config.retryAttempts || 3
    this.retryDelay = config.retryDelay || 1000
  }

  private async makeRequest<T>(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const config: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-buildium-client-id': this.clientId,
        'x-buildium-client-secret': this.clientSecret
      },
      signal: AbortSignal.timeout(this.timeout)
    }

    if (data && method !== 'GET') {
      config.body = JSON.stringify(data)
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, config)
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(`Buildium API error: ${response.status} ${response.statusText} - ${errorData.message || 'Unknown error'}`)
        }

        const result = await response.json()
        return result as T
      } catch (error) {
        lastError = error as Error
        
        if (attempt < this.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)))
          continue
        }
        
        throw lastError
      }
    }

    throw lastError || new Error('Request failed after all retry attempts')
  }

  async createProperty(data: any): Promise<BuildiumProperty> {
    return this.makeRequest<BuildiumProperty>('POST', '/rentals', data)
  }

  async updateProperty(id: number, data: any): Promise<BuildiumProperty> {
    return this.makeRequest<BuildiumProperty>('PUT', `/rentals/${id}`, data)
  }

  async createOwner(data: any): Promise<BuildiumOwner> {
    return this.makeRequest<BuildiumOwner>('POST', '/rentals/owners', data)
  }

  async updateOwner(id: number, data: any): Promise<BuildiumOwner> {
    return this.makeRequest<BuildiumOwner>('PUT', `/rentals/owners/${id}`, data)
  }

  async getProperty(id: number): Promise<BuildiumProperty> {
    return this.makeRequest<BuildiumProperty>('GET', `/rentals/${id}`)
  }

  async getUnits(propertyId: number): Promise<BuildiumUnit[]> {
    return this.makeRequest<BuildiumUnit[]>('GET', `/rentals/${propertyId}/units`)
  }

  async getOwner(id: number): Promise<BuildiumOwner> {
    return this.makeRequest<BuildiumOwner>('GET', `/rentals/owners/${id}`)
  }
}

// Data mapping functions
function mapPropertyToBuildium(localProperty: any): any {
  return {
    Name: localProperty.Name,
    PropertyType: mapPropertyTypeToBuildium(localProperty.rental_sub_type),
    Address: {
      AddressLine1: localProperty.address_line1,
      AddressLine2: localProperty.address_line2 || undefined,
      City: localProperty.city || '',
      State: localProperty.state || '',
      PostalCode: localProperty.postal_code,
      Country: localProperty.country
    },
    YearBuilt: localProperty.year_built || undefined,
    SquareFootage: localProperty.square_footage || undefined,
    Bedrooms: localProperty.bedrooms || undefined,
    Bathrooms: localProperty.bathrooms || undefined,
    IsActive: localProperty.is_active !== false
  }
}

function mapOwnerToBuildium(localOwner: any): any {
  const [firstName, ...lastNameParts] = (localOwner.name || '').split(' ')
  const lastName = lastNameParts.join(' ') || ''

  return {
    FirstName: firstName || '',
    LastName: lastName,
    Email: localOwner.email || undefined,
    PhoneNumber: localOwner.phone_number || undefined,
    Address: {
      AddressLine1: localOwner.address_line1 || '',
      AddressLine2: localOwner.address_line2 || undefined,
      City: localOwner.city || '',
      State: localOwner.state || '',
      PostalCode: localOwner.postal_code || '',
      Country: localOwner.country || 'US'
    },
    TaxId: localOwner.tax_id || undefined,
    IsActive: localOwner.is_active !== false
  }
}

function mapPropertyTypeToBuildium(localType: string): 'Rental' | 'Association' | 'Commercial' {
  switch (localType) {
    case 'Office':
    case 'Retail':
    case 'ShoppingCenter':
    case 'Storage':
    case 'ParkingSpace':
      return 'Commercial'
    default:
      return 'Rental'
  }
}

function sanitizeForBuildium(data: any): any {
  const sanitized = { ...data }
  
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === undefined || sanitized[key] === null) {
      delete sanitized[key]
    }
  })
  
  return sanitized
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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Initialize Buildium client
    const buildiumClient = new BuildiumClient({
      baseUrl: Deno.env.get('BUILDIUM_BASE_URL') || 'https://apisandbox.buildium.com/v1',
      clientId: Deno.env.get('BUILDIUM_CLIENT_ID') || '',
      clientSecret: Deno.env.get('BUILDIUM_CLIENT_SECRET') || '',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000
    })

    const { method } = req
    const url = new URL(req.url)
    const path = url.pathname.split('/').pop()

    if (method === 'POST') {
      const body = await req.json()
      const { entityType, entityData, operation } = body

      let result: any

      switch (entityType) {
        case 'property':
          if (operation === 'create') {
            const buildiumData = mapPropertyToBuildium(entityData)
            const sanitizedData = sanitizeForBuildium(buildiumData)
            result = await buildiumClient.createProperty(sanitizedData)
          } else if (operation === 'update') {
            const buildiumData = mapPropertyToBuildium(entityData)
            const sanitizedData = sanitizeForBuildium(buildiumData)
            result = await buildiumClient.updateProperty(entityData.buildium_property_id, sanitizedData)
          }
          break

        case 'owner':
          if (operation === 'create') {
            const buildiumData = mapOwnerToBuildium(entityData)
            const sanitizedData = sanitizeForBuildium(buildiumData)
            result = await buildiumClient.createOwner(sanitizedData)
          } else if (operation === 'update') {
            const buildiumData = mapOwnerToBuildium(entityData)
            const sanitizedData = sanitizeForBuildium(buildiumData)
            result = await buildiumClient.updateOwner(entityData.buildium_owner_id, sanitizedData)
          }
          break

        default:
          throw new Error(`Unsupported entity type: ${entityType}`)
      }

      // Update sync status in database
      await supabase.rpc('update_buildium_sync_status', {
        p_entity_type: entityType,
        p_entity_id: entityData.id,
        p_buildium_id: result.Id,
        p_status: 'synced'
      })

      return new Response(
        JSON.stringify({
          success: true,
          data: result,
          message: `${entityType} synced successfully`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    if (method === 'GET') {
      const { searchParams } = url
      const entityType = searchParams.get('entityType')
      const entityId = searchParams.get('entityId')

      if (entityType && entityId) {
        let result: any

        if (entityType === 'property') {
          result = await buildiumClient.getProperty(parseInt(entityId))
        } else if (entityType === 'owner') {
          result = await buildiumClient.getOwner(parseInt(entityId))
        } else if (entityType === 'units') {
          result = await buildiumClient.getUnits(parseInt(entityId))
        } else {
          throw new Error(`Unsupported entity type: ${entityType}`)
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: result
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }
    }

    return new Response(
      JSON.stringify({ error: 'Method not supported' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      }
    )

  } catch (error) {
    console.error('Error in buildium-sync function:', error)
    
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
