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
  // Lightweight shell: just enough for header/tabs without heavy joins
  static async getPropertyShell(id: string): Promise<Pick<Property, 'id'|'name'|'status'|'property_type'> | null> {
    try {
      const hasEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      if (!hasEnv) {
        // Fallback to API details; extract minimal fields
        try {
          const res = await fetch(`/api/properties/${id}/details`, { cache: 'no-store' })
          if (res.ok) {
            const data = await res.json()
            return { id: data.id, name: data.name, status: data.status, property_type: (data as any)?.property_type }
          }
        } catch {}
        return null
      }
      const { data, error } = await supabase
        .from('properties')
        .select('id,name,status,property_type')
        .eq('id', id)
        .maybeSingle()
      if (error || !data) return null
      return data as any
    } catch {
      return null
    }
  }
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

      // If env missing, or connection errors occur, fall back to API quickly
      const hasEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      if (!hasEnv) {
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

      // Prefer admin client on the server to bypass RLS
      const dbClient = supabaseAdmin || supabase

      // Fetch property details first
      const { data: property, error: propertyError } = await dbClient
        .from('properties')
        .select('*')
        .eq('id', id)
        .single()

      if (propertyError || !property) {
        // Fall back to internal API which uses service role or cookie-bound server client to bypass RLS issues
        try {
          const res = await fetch(`/api/properties/${id}/details`, { cache: 'no-store' })
          if (res.ok) {
            const data = await res.json()
            const occ = typeof data.occupancy_rate === 'number' ? data.occupancy_rate : Number(data.occupancy_rate || 0)
            return { ...data, occupancy_rate: occ }
          }
        } catch {}
        console.error('❌ Error fetching property:', propertyError || 'not found')
        return null
      }

      console.log('✅ Property found:', {
        id: property.id,
        name: property.name,
        address: property.address_line1
      })

      // Fetch units and ownerships in parallel for speed
      console.log('🔍 Fetching units and ownerships for property ID:', id)
      const [unitsRes, ownershipRes] = await Promise.all([
        dbClient.from('units').select('*').eq('property_id', id).order('unit_number'),
        dbClient
          .from('ownerships')
          .select(`
            *,
            owners!inner (
              *,
              contacts (*)
            )
          `)
          .eq('property_id', id)
      ])

      const units = (unitsRes as any).data as Unit[] | null
      const unitsError = (unitsRes as any).error
      const ownership = (ownershipRes as any).data as any[] | null
      const ownershipError = (ownershipRes as any).error

      if (unitsError) console.error('❌ Error fetching units:', unitsError)
      if (ownershipError) console.error('❌ Error fetching ownership:', ownershipError)
      if (units?.length) console.log('✅ Units found:', units.length, 'units')

      // Calculate summary data preferring DB-maintained aggregates, then fallback to units list
      const aggTotal = (property.total_active_units ?? property.total_units) || 0
      const aggOccupied = property.total_occupied_units ?? undefined
      const aggVacant = property.total_vacant_units ?? undefined

      // Fallbacks using units table if aggregates not present
      const occupiedFromUnits = (units || []).filter(u => (u as any).status === 'Occupied').length
      const vacantFromUnits = (units || []).filter(u => (u as any).status === 'Vacant').length
      const activeFromUnits = (units || []).filter(u => (u as any).status !== 'Inactive').length

      const units_summary = {
        total: property.total_active_units ?? (aggTotal || activeFromUnits),
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
        const { data: op } = await dbClient
          .from('bank_accounts')
          .select('id, name, account_number')
          .eq('id', property.operating_bank_account_id)
          .maybeSingle()
        if (op) operating_account = { id: op.id, name: op.name, last4: op.account_number ? String(op.account_number).slice(-4) : null }
      }
      if (property.deposit_trust_account_id) {
        const { data: tr } = await dbClient
          .from('bank_accounts')
          .select('id, name, account_number')
          .eq('id', property.deposit_trust_account_id)
          .maybeSingle()
        if (tr) deposit_trust_account = { id: tr.id, name: tr.name, last4: tr.account_number ? String(tr.account_number).slice(-4) : null }
      }

      // Enrich: property manager name (if any)
      let property_manager_name: string | undefined
      let property_manager_email: string | undefined
      let property_manager_phone: string | undefined
      const { data: staffLink } = await dbClient
        .from('property_staff')
        .select('staff_id, role')
        .eq('property_id', id)
        .eq('role', 'PROPERTY_MANAGER')
        .maybeSingle()
      if (staffLink?.staff_id) {
        try {
          const { data: st } = await dbClient
            .from('staff')
            .select('id, first_name, last_name, email, phone, user_id')
            .eq('id', staffLink.staff_id)
            .maybeSingle()
          if (st) {
            const full = [ (st as any).first_name, (st as any).last_name ].filter(Boolean).join(' ').trim()
            property_manager_name = full || `Staff ${st.id}`
            property_manager_email = (st as any).email || undefined
            property_manager_phone = (st as any).phone || undefined
          } else {
            property_manager_name = `Staff ${staffLink.staff_id}`
          }
        } catch {
          property_manager_name = `Staff ${staffLink.staff_id}`
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
        property_manager_email,
        property_manager_phone,
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
        .select('id,name,status,property_type,created_at')
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
          owners!inner (
            id, contact_id, management_agreement_start_date, management_agreement_end_date, comment,
            etf_account_type, etf_account_number, etf_routing_number, created_at, updated_at,
            contacts (
              first_name, last_name, is_company, company_name, primary_email, primary_phone
            )
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

// Server-side cache helpers (noop on client). Use in RSC layouts to avoid refetch on tab switches.
export const getPropertyShellCached = ((): ((id: string) => Promise<Pick<Property, 'id'|'name'|'status'|'property_type'> | null>) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { cache } = require('react') as { cache: <T extends (...args: any[]) => any>(fn: T) => T }
    return cache((id: string) => PropertyService.getPropertyShell(id))
  } catch {
    // Fallback (client): just call through
    return (id: string) => PropertyService.getPropertyShell(id)
  }
})()
