import { createBuildiumClient, defaultBuildiumConfig } from './buildium-client'
import { supabase } from './db'
import { logger } from './logger'
import type { Database } from '@/types/database'
import type { BuildiumWorkOrder, BuildiumWorkOrderCreate, BuildiumWorkOrderUpdate } from '@/types/buildium'
import { mapWorkOrderFromBuildiumWithRelations } from './buildium-mappers'
import { buildiumSync } from './buildium-sync'

export type WorkOrderRow = Database['public']['Tables']['work_orders']['Row']
export type WorkOrderInsert = Database['public']['Tables']['work_orders']['Insert']
export type WorkOrderUpdate = Database['public']['Tables']['work_orders']['Update']

function ensureClient() {
  return createBuildiumClient({
    ...defaultBuildiumConfig,
    clientId: process.env.BUILDIUM_CLIENT_ID || '',
    clientSecret: process.env.BUILDIUM_CLIENT_SECRET || ''
  })
}

export class WorkOrderService {
  // List Work Orders from Buildium (optionally persist to DB)
  static async listFromBuildium(params?: {
    propertyId?: number
    unitId?: number
    status?: string
    categoryId?: number
    limit?: number
    offset?: number
    persist?: boolean
  }): Promise<BuildiumWorkOrder[]> {
    const client = ensureClient()
    const items = await client.getWorkOrders(params)

    if (params?.persist) {
      for (const wo of items) {
        try {
          const local = await mapWorkOrderFromBuildiumWithRelations(wo, supabase)
          const { data: existing } = await supabase
            .from('work_orders')
            .select('id')
            .eq('buildium_work_order_id', wo.Id)
            .single()

          if (existing) {
            await supabase.from('work_orders').update(local).eq('id', existing.id)
          } else {
            await supabase.from('work_orders').insert(local)
          }
        } catch (e) {
          logger.error({ workOrderId: wo.Id, error: (e as Error).message }, 'Failed to persist work order')
        }
      }
    }

    return items
  }

  // Get one Work Order from Buildium (optionally persist to DB)
  static async getFromBuildium(id: number, persist = false): Promise<BuildiumWorkOrder | null> {
    const client = ensureClient()
    const wo = await client.getWorkOrder(id).catch(() => null)
    if (!wo) return null

    if (persist) {
      try {
        const local = await mapWorkOrderFromBuildiumWithRelations(wo, supabase)
        const { data: existing } = await supabase
          .from('work_orders')
          .select('id')
          .eq('buildium_work_order_id', wo.Id)
          .single()

        if (existing) {
          await supabase.from('work_orders').update(local).eq('id', existing.id)
        } else {
          await supabase.from('work_orders').insert(local)
        }
      } catch (e) {
        logger.error({ workOrderId: id, error: (e as Error).message }, 'Failed to persist work order')
      }
    }

    return wo
  }

  // Create in Buildium, then map and insert in DB
  static async createInBuildiumAndDB(payload: BuildiumWorkOrderCreate): Promise<{ buildium: BuildiumWorkOrder; localId?: string }> {
    const client = ensureClient()
    const created = await client.createWorkOrder(payload)
    const local = await mapWorkOrderFromBuildiumWithRelations(created, supabase)
    const { data, error } = await supabase.from('work_orders').insert(local).select('id').single()
    if (error) throw error
    return { buildium: created, localId: data.id }
  }

  // Update in Buildium and update local DB row by buildium id
  static async updateInBuildiumAndDB(id: number, payload: BuildiumWorkOrderUpdate): Promise<{ buildium: BuildiumWorkOrder; localId?: string | null }> {
    const client = ensureClient()
    const updated = await client.updateWorkOrder(id, payload)
    const local = await mapWorkOrderFromBuildiumWithRelations(updated, supabase)

    const { data: existing } = await supabase
      .from('work_orders')
      .select('id')
      .eq('buildium_work_order_id', id)
      .single()

    if (existing) {
      await supabase.from('work_orders').update(local).eq('id', existing.id)
      return { buildium: updated, localId: existing.id }
    } else {
      const { data, error } = await supabase.from('work_orders').insert(local).select('id').single()
      if (error) throw error
      return { buildium: updated, localId: data.id }
    }
  }

  // Create locally then sync to Buildium (alternative flow)
  static async createLocalAndSync(localInsert: WorkOrderInsert): Promise<{ localId: string; buildiumId?: number }> {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('work_orders')
      .insert({ ...localInsert, created_at: localInsert.created_at || now, updated_at: localInsert.updated_at || now })
      .select('*')
      .single()
    if (error) throw error

    // Sync to Buildium using the sync service so property/unit IDs are resolved
    await buildiumSync.syncWorkOrderToBuildium({ ...data })

    return { localId: data.id }
  }
}

export default WorkOrderService
