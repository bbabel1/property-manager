import { supabase, supabaseAdmin } from './db'
import type { Database } from '@/types/database'

export interface Property {
  id: string
  name: string
  address_line1: string
  address_line2?: string
  address_line3?: string
  city: string
  state: string
  postal_code: string
  country: Database['public']['Enums']['countries']
  borough?: string | null
  neighborhood?: string | null
  longitude?: number | null
  latitude?: number | null
  location_verified?: boolean
  property_type?: string | null
  // primary_owner removed - now determined from ownerships table where primary = true
  status: string
  reserve: number
  year_built?: number
  total_units: number
  // Aggregated unit counts maintained by DB triggers
  total_active_units?: number
  total_occupied_units?: number
  total_vacant_units?: number
  total_inactive_units?: number
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
  country: Database['public']['Enums']['countries']
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
  primary_owner_name?: string
  // Banking + manager enrichments
  operating_account?: { id: string; name: string; last4?: string | null }
  deposit_trust_account?: { id: string; name: string; last4?: string | null }
  property_manager_name?: string

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

      // If running on the client (no admin key), use server API to bypass RLS and get enriched data
      const isBrowser = typeof window !== 'undefined'
      if (isBrowser && !supabaseAdmin) {
        const res = await fetch(`/api/properties/${id}/details`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          // Coerce occupancy_rate to number if needed
          const occ = typeof data.occupancy_rate === 'number' ? data.occupancy_rate : Number(data.occupancy_rate || 0)
          return { ...data, occupancy_rate: occ }
        }
        console.warn('Fallback to client Supabase due to API error')
      }

      console.log('✅ Supabase client available, fetching from database...')

      // Test the Supabase connection first; if it fails, fall back to API
      try {
        const { error: testError } = await supabase
          .from('properties')
          .select('count', { count: 'exact', head: true })
        if (testError) throw testError
      } catch (e) {
        console.error('❌ Supabase connection test failed:', e || {})
        // Fallback to API route even on the server (RSC). Next.js allows internal fetch.
        try {
          const res = await fetch(`/api/properties/${id}/details`, { cache: 'no-store' })
          if (res.ok) {
            const data = await res.json()
            const occ = typeof data.occupancy_rate === 'number' ? data.occupancy_rate : Number(data.occupancy_rate || 0)
            return { ...data, occupancy_rate: occ }
          }
        } catch {}
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

      // Calculate summary data preferring DB-maintained aggregates, then fallback to units list
      const aggTotal = (property.total_active_units ?? property.total_units) || 0
      const aggOccupied = property.total_occupied_units ?? undefined
      const aggVacant = property.total_vacant_units ?? undefined

      // Fallbacks using units table if aggregates not present
      const occupiedFromUnits = (units || []).filter(u => (u as any).status === 'Occupied').length
      const vacantFromUnits = (units || []).filter(u => (u as any).status === 'Vacant').length
      const activeFromUnits = (units || []).filter(u => (u as any).status !== 'Inactive').length

      const units_summary = {
        total: property.total_active_units ?? aggTotal || activeFromUnits,
        occupied: (aggOccupied ?? occupiedFromUnits) || 0,
        available: (aggVacant ?? vacantFromUnits) || Math.max((aggTotal || activeFromUnits) - (aggOccupied ?? occupiedFromUnits), 0)
      }

      console.log('📊 Units summary calculated:', {
        total: units_summary.total,
        occupied: units_summary.occupied,
        available: units_summary.available,
        actualUnitsCount: units?.length || 0
      })

      // Use DB computed occupancy_rate when available; otherwise derive from summary
      const occRaw = (property as any).occupancy_rate
      const occupancy_rate = (typeof occRaw === 'number' ? occRaw : (occRaw != null ? Number(occRaw) : undefined)) ?? (
        units_summary.total > 0
          ? Math.round((units_summary.occupied / units_summary.total) * 100)
          : 0
      )

      const total_owners = ownership?.length || 0

      // Extract owners with ownership details from ownership data
      const owners = ownership?.map(o => ({
        ...o.owners,
        ...o.owners.contacts, // Include contact information
        ownership_percentage: o.ownership_percentage,
        disbursement_percentage: o.disbursement_percentage,
        primary: o.primary
      })).filter(Boolean)
        // Primary owner first for display purposes
        .sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0)) || []

      // Enrich: banking accounts (names + masked last4)
      let operating_account: PropertyWithDetails['operating_account'] | undefined
      let deposit_trust_account: PropertyWithDetails['deposit_trust_account'] | undefined
      if (property.operating_bank_account_id) {
        const { data: op } = await supabase
          .from('bank_accounts')
          .select('id, name, account_number')
          .eq('id', property.operating_bank_account_id)
          .maybeSingle()
        if (op) operating_account = { id: op.id, name: op.name, last4: op.account_number ? String(op.account_number).slice(-4) : null }
      }
      if (property.deposit_trust_account_id) {
        const { data: tr } = await supabase
          .from('bank_accounts')
          .select('id, name, account_number')
          .eq('id', property.deposit_trust_account_id)
          .maybeSingle()
        if (tr) deposit_trust_account = { id: tr.id, name: tr.name, last4: tr.account_number ? String(tr.account_number).slice(-4) : null }
      }

      // Enrich: property manager name (if any)
      let property_manager_name: string | undefined
      const { data: staffLink } = await adminClient
        .from('property_staff')
        .select('staff_id, role')
        .eq('property_id', id)
        .eq('role', 'PROPERTY_MANAGER')
        .maybeSingle()
      if (staffLink?.staff_id) {
        const { data: staff } = await adminClient
          .from('staff')
          .select('first_name, last_name')
          .eq('id', staffLink.staff_id)
          .maybeSingle()
        if (staff) {
          property_manager_name = [staff.first_name, staff.last_name].filter(Boolean).join(' ').trim() || undefined
        }
      }

      // Compute primary owner name for display
      let primary_owner_name: string | undefined
      if (owners.length) {
        const po = owners.find(o => (o as any).primary) || owners[0]
        primary_owner_name = (po as any).company_name || [
          (po as any).first_name,
          (po as any).last_name
        ].filter(Boolean).join(' ').trim() || undefined
      }

      const result: PropertyWithDetails = {
        ...property,
        units: units || [],
        owners: owners,
        units_summary,
        occupancy_rate,
        total_owners,
        primary_owner_name,
        isMockData: false,
        operating_account,
        deposit_trust_account,
        property_manager_name,
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
