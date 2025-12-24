import { createBuildiumClient, defaultBuildiumConfig } from './buildium-client'
import { supabase } from './db'
import { logger } from './logger'
import type { Database } from '@/types/database'
import type { BuildiumAppliance, BuildiumApplianceCreate, BuildiumApplianceUpdate } from '@/types/buildium'
import { mapApplianceFromBuildium, mapApplianceToBuildium } from './buildium-mappers'

export type ApplianceRow = Database['public']['Tables']['appliances']['Row']
export type ApplianceInsert = Database['public']['Tables']['appliances']['Insert']
export type ApplianceUpdate = Database['public']['Tables']['appliances']['Update']
type AppliancePayload = Awaited<ReturnType<typeof mapApplianceFromBuildium>>

const toUpdatePayload = (local: AppliancePayload) =>
  ({ ...local, updated_at: new Date().toISOString() } as unknown as ApplianceUpdate)

const toInsertPayload = (local: AppliancePayload) =>
  local as unknown as ApplianceInsert

function ensureClient() {
  return createBuildiumClient({
    ...defaultBuildiumConfig,
    clientId: process.env.BUILDIUM_CLIENT_ID || '',
    clientSecret: process.env.BUILDIUM_CLIENT_SECRET || ''
  })
}

export class ApplianceService {
  // List Appliances from Buildium (optionally persist to DB)
  static async listFromBuildium(params?: {
    propertyId?: number
    unitId?: number
    applianceType?: string
    limit?: number
    offset?: number
    persist?: boolean
  }): Promise<BuildiumAppliance[]> {
    const client = ensureClient()
    // No dedicated wrapper yet, call through generic client
    const items = await client.getAppliances({
      propertyId: params?.propertyId,
      unitId: params?.unitId,
      applianceType: params?.applianceType,
      limit: params?.limit,
      offset: params?.offset
    })

    if (params?.persist) {
      for (const a of items) {
        try {
          const local = await mapApplianceFromBuildium(a, supabase)
          const { data: existing } = await supabase
            .from('appliances')
            .select('id')
            .eq('buildium_appliance_id', a.Id)
            .single()

          if (existing) {
            await supabase.from('appliances').update(toUpdatePayload(local)).eq('id', existing.id)
          } else {
            await supabase.from('appliances').insert(toInsertPayload(local))
          }
        } catch (e) {
          logger.error({ applianceId: a.Id, error: (e as Error).message }, 'Failed to persist appliance')
        }
      }
    }

    return items
  }

  // Get one Appliance from Buildium (optionally persist to DB)
  static async getFromBuildium(id: number, persist = false): Promise<BuildiumAppliance | null> {
    const client = ensureClient()
    const appliance = await client.getAppliance(id).catch(() => null)
    if (!appliance) return null

    if (persist) {
      try {
        const local = await mapApplianceFromBuildium(appliance, supabase)
        const { data: existing } = await supabase
          .from('appliances')
          .select('id')
          .eq('buildium_appliance_id', appliance.Id)
          .single()

        if (existing) {
          await supabase.from('appliances').update(toUpdatePayload(local)).eq('id', existing.id)
        } else {
          await supabase.from('appliances').insert(toInsertPayload(local))
        }
      } catch (e) {
        logger.error({ applianceId: id, error: (e as Error).message }, 'Failed to persist appliance')
      }
    }

    return appliance
  }

  // Create in Buildium, then map and insert in DB
  static async createInBuildiumAndDB(payload: BuildiumApplianceCreate | ApplianceInsert): Promise<{ buildium: BuildiumAppliance; localId?: string }> {
    const client = ensureClient()
    const toBuildium = await mapApplianceToBuildium(
      payload as Parameters<typeof mapApplianceToBuildium>[0],
      supabase,
    )
    const buildium = await client.createAppliance(toBuildium as BuildiumApplianceCreate)
    const local = await mapApplianceFromBuildium(buildium, supabase)
    const { data, error } = await supabase.from('appliances').insert(toInsertPayload(local)).select('id').single()
    if (error) throw error
    return { buildium, localId: data.id }
  }

  // Update in Buildium and update local DB row by buildium id
  static async updateInBuildiumAndDB(id: number, payload: BuildiumApplianceUpdate | ApplianceUpdate): Promise<{ buildium: BuildiumAppliance; localId?: string | null }> {
    const client = ensureClient()
    const toBuildium = await mapApplianceToBuildium(
      payload as Parameters<typeof mapApplianceToBuildium>[0],
      supabase,
    )
    const buildium = await client.updateAppliance(id, toBuildium as BuildiumApplianceUpdate)
    const local = await mapApplianceFromBuildium(buildium, supabase)

    const { data: existing } = await supabase
      .from('appliances')
      .select('id')
      .eq('buildium_appliance_id', id)
      .single()

    if (existing) {
      await supabase.from('appliances').update(toUpdatePayload(local)).eq('id', existing.id)
      return { buildium, localId: existing.id }
    } else {
      const { data, error } = await supabase.from('appliances').insert(toInsertPayload(local)).select('id').single()
      if (error) throw error
      return { buildium, localId: data.id }
    }
  }
}

export default ApplianceService
