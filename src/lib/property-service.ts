import { supabase, supabaseAdmin } from './db'

export interface Property {
  id: string
  name: string
  address_line1: string
  address_line2?: string
  address_line3?: string
  city: string
  state: string
  postal_code: string
  country: string
  rental_sub_type: string
  // primary_owner removed - now determined from ownerships table where primary = true
  status: string
  reserve: number
  year_built?: number
  total_units: number
  operating_bank_account_id?: string
  deposit_trust_account_id?: string
  created_at: string
  updated_at: string
}

export interface Unit {
  id: string
  property_id: string
  unit_number: string
  unit_size?: number
  market_rent?: number
  address_line1: string
  address_line2?: string
  address_line3?: string
  city: string
  state: string
  postal_code: string
  country: string
  unit_bedrooms?: string
  unit_bathrooms?: string
  description?: string
  created_at: string
  updated_at: string
}

export interface Owner {
  id: string
  contact_id: string
  // Contact information (from contacts table)
  first_name?: string
  last_name?: string
  is_company?: boolean
  company_name?: string
  primary_email?: string
  primary_phone?: string
  // Owner-specific fields
  management_agreement_start_date?: string
  management_agreement_end_date?: string
  comment?: string
  etf_account_type?: string
  etf_account_number?: string
  etf_routing_number?: string
  created_at: string
  updated_at: string
  // Ownership details (when fetched with property)
  ownership_percentage?: number
  disbursement_percentage?: number
  primary?: boolean
}

export interface PropertyWithDetails extends Property {
  units: Unit[]
  owners: Owner[]
  units_summary: {
    total: number
    occupied: number
    available: number
  }
  occupancy_rate: number
  total_owners: number

}

export class PropertyService {
  static async getPropertyById(id: string): Promise<PropertyWithDetails | null> {
    try {
      console.log('🔍 Fetching property with ID:', id)
      
      // Check if Supabase is available
      if (!supabase) {
        console.warn('❌ Supabase client not available')
        return null
      }

      console.log('✅ Supabase client available, fetching from database...')

      // Test the Supabase connection first
      const { data: testData, error: testError } = await supabase
        .from('properties')
        .select('count')
        .limit(1)

      if (testError) {
        console.error('❌ Supabase connection test failed:', testError)
        return null
      }

      console.log('✅ Supabase connection test successful')

      // Fetch property details
      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single()

      if (propertyError) {
        console.error('❌ Error fetching property:', propertyError)
        return null
      }

      if (!property) {
        console.warn('⚠️ Property not found in database')
        return null
      }

      console.log('✅ Property found:', {
        id: property.id,
        name: property.name,
        address: property.address_line1
      })

      // Fetch units for this property
      console.log('🔍 Fetching units for property ID:', id)
      const { data: units, error: unitsError } = await supabase
        .from('units')
        .select('*')
        .eq('property_id', id)
        .order('unit_number')

      if (unitsError) {
        console.error('❌ Error fetching units:', unitsError)
      } else {
        console.log('✅ Units found:', units?.length || 0, 'units')
        if (units && units.length > 0) {
          console.log('📋 Units details:', units.map(u => ({ id: u.id, unit_number: u.unit_number })))
        }
      }

      // Fetch owners for this property using admin client to bypass RLS
      const adminClient = supabaseAdmin || supabase
      const { data: ownership, error: ownershipError } = await adminClient
        .from('ownerships')
        .select(`
          *,
          owners!inner (
            *,
            contacts (*)
          )
        `)
        .eq('property_id', id)

      if (ownershipError) {
        console.error('❌ Error fetching ownership:', ownershipError)
      } else {
        console.log('✅ Ownership found:', ownership?.length || 0, 'ownership records')
      }

      // Calculate summary data using total_units from database for active units
      const units_summary = {
        total: property.total_units || 0,
        occupied: 0, // This would need to be calculated based on lease data
        available: property.total_units || 0 // This would need to be calculated based on lease data
      }

      console.log('📊 Units summary calculated:', {
        total: units_summary.total,
        occupied: units_summary.occupied,
        available: units_summary.available,
        actualUnitsCount: units?.length || 0
      })

      const occupancy_rate = units_summary.total > 0 
        ? Math.round((units_summary.occupied / units_summary.total) * 100) 
        : 0

      const total_owners = ownership?.length || 0

      // Extract owners with ownership details from ownership data
      const owners = ownership?.map(o => ({
        ...o.owners,
        ...o.owners.contacts, // Include contact information
        ownership_percentage: o.ownership_percentage,
        disbursement_percentage: o.disbursement_percentage,
        primary: o.primary
      })).filter(Boolean) || []

      const result = {
        ...property,
        units: units || [],
        owners: owners,
        units_summary,
        occupancy_rate,
        total_owners,
        isMockData: false
      }

      console.log('✅ Returning property with real data:', {
        name: result.name,
        address: result.address_line1,
        unitsCount: result.units.length,
        ownersCount: result.owners.length
      })

      return result
    } catch (error) {
      console.error('❌ Error in getPropertyById:', error)
      return null
    }
  }

  static async getAllProperties(): Promise<Property[]> {
    try {
      if (!supabase) {
        console.warn('Supabase client not available, returning empty array')
        return []
      }

      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching properties:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getAllProperties:', error)
      return []
    }
  }

  static async getPropertyUnits(propertyId: string): Promise<Unit[]> {
    try {
      if (!supabase) {
        console.warn('Supabase client not available, returning empty array')
        return []
      }

      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('property_id', propertyId)
        .order('unit_number')

      if (error) {
        console.error('Error fetching units:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getPropertyUnits:', error)
      return []
    }
  }

  static async getPropertyOwners(propertyId: string): Promise<Owner[]> {
    try {
      if (!supabase) {
        console.warn('Supabase client not available, returning empty array')
        return []
      }

      // Use admin client to bypass RLS
      const adminClient = supabaseAdmin || supabase
      const { data, error } = await adminClient
        .from('ownerships')
        .select(`
          *,
          owners!inner (
            *,
            contacts (*)
          )
        `)
        .eq('property_id', propertyId)

      if (error) {
        console.error('Error fetching owners:', error)
        return []
      }

      return data?.map(o => ({
        ...o.owners,
        ...o.owners.contacts // Include contact information
      })).filter(Boolean) || []
    } catch (error) {
      console.error('Error in getPropertyOwners:', error)
      return []
    }
  }
}
