import { createBuildiumClient, defaultBuildiumConfig, type BuildiumClient } from './buildium-client'
import { supabase } from './db'
import type { BuildiumTenant, BuildiumTenantCreate, BuildiumTenantUpdate } from '@/types/buildium'
import { findOrCreateContact, findOrCreateTenant } from './buildium-mappers'

function client(): BuildiumClient {
  return createBuildiumClient({
    ...defaultBuildiumConfig,
    clientId: process.env.BUILDIUM_CLIENT_ID || '',
    clientSecret: process.env.BUILDIUM_CLIENT_SECRET || ''
  })
}

export class TenantService {
  // List Tenants from Buildium (optionally persist to DB)
  static async listFromBuildium(params?: {
    lastupdatedfrom?: string
    lastupdatedto?: string
    orderby?: string
    offset?: number
    limit?: number
    persist?: boolean
  }): Promise<BuildiumTenant[]> {
    const c = client()
    const qs = new URLSearchParams()
    if (params?.lastupdatedfrom) qs.append('lastupdatedfrom', params.lastupdatedfrom)
    if (params?.lastupdatedto) qs.append('lastupdatedto', params.lastupdatedto)
    if (params?.orderby) qs.append('orderby', params.orderby)
    if (typeof params?.offset === 'number') qs.append('offset', String(params.offset))
    if (typeof params?.limit === 'number') qs.append('limit', String(params.limit))
    const url = `/rentals/tenants${qs.toString() ? `?${qs}` : ''}`
    const items = await c.makeRequest<BuildiumTenant[]>('GET', url)

    if (params?.persist) {
      for (const t of items) {
        try {
          const contactId = await findOrCreateContact(t, supabase)
          await findOrCreateTenant(contactId, t, supabase)
        } catch {
          // Continue; log handled inside helpers
        }
      }
    }
    return items
  }

  // Get one Tenant from Buildium (optionally persist to DB)
  static async getFromBuildium(id: number, persist = false): Promise<BuildiumTenant | null> {
    const c = client()
    const url = `/rentals/tenants/${id}`
    const tenant = await c
      .makeRequest<BuildiumTenant>('GET', url)
      .catch(() => null)
    if (tenant && persist) {
      try {
        const contactId = await findOrCreateContact(tenant, supabase)
        await findOrCreateTenant(contactId, tenant, supabase)
      } catch {
        // ignore
      }
    }
    return tenant
  }

  // Create in Buildium, then map and insert/update in DB
  static async createInBuildiumAndDB(payload: BuildiumTenantCreate): Promise<{ buildium: BuildiumTenant; localId?: string }> {
    const c = client()
    const buildium = await c.makeRequest<BuildiumTenant>('POST', `/rentals/tenants`, payload)
    const contactId = await findOrCreateContact(buildium, supabase)
    const localId = await findOrCreateTenant(contactId, buildium, supabase)
    return { buildium, localId }
  }

  // Update in Buildium and update local DB row by buildium id
  static async updateInBuildiumAndDB(id: number, payload: BuildiumTenantUpdate): Promise<{ buildium: BuildiumTenant; localId?: string | null }> {
    const c = client()
    const buildium = await c.makeRequest<BuildiumTenant>('PUT', `/rentals/tenants/${id}`, payload)
    let localId: string | null = null
    try {
      const contactId = await findOrCreateContact(buildium, supabase)
      localId = await findOrCreateTenant(contactId, buildium, supabase)
    } catch {}
    return { buildium, localId }
  }
}
