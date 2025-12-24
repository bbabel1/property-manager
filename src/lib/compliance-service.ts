/**
 * Compliance Service
 * 
 * Service layer for compliance management operations including CRUD operations
 * and portfolio-level aggregations.
 */

import { supabaseAdmin } from './db'
import type {
  ComplianceAsset,
  ComplianceAssetInsert,
  ComplianceAssetUpdate,
  ComplianceAssetFilters,
  ComplianceAssetWithRelations,
  ComplianceEvent,
  ComplianceItem,
  ComplianceItemFilters,
  ComplianceItemUpdate,
  ComplianceItemWithRelations,
  ComplianceItemWorkOrder,
  CompliancePortfolioSummary,
  ComplianceProgram,
  CompliancePropertySummary,
  ComplianceViolation,
  ComplianceViolationFilters,
  ComplianceViolationWithRelations,
} from '@/types/compliance'
import { logger } from './logger'

export class ComplianceService {
  /**
   * Get compliance assets by property
   */
  static async getAssetsByProperty(
    propertyId: string,
    orgId: string,
    filters?: ComplianceAssetFilters
  ): Promise<ComplianceAsset[]> {
    try {
      let query = supabaseAdmin
        .from('compliance_assets')
        .select('*')
        .eq('property_id', propertyId)
        .eq('org_id', orgId)

      if (filters?.asset_type) {
        query = query.in('asset_type', filters.asset_type)
      }

      if (filters?.active_only) {
        query = query.eq('active', true)
      }

      const { data, error } = await query.order('name')

      if (error) {
        logger.error({ error, propertyId, orgId }, 'Failed to fetch compliance assets')
        throw error
      }

      return (data || []) as ComplianceAsset[]
    } catch (error) {
      logger.error({ error, propertyId, orgId }, 'Error in getAssetsByProperty')
      throw error
    }
  }

  /**
   * Get compliance asset by ID with relations
   */
  static async getAssetById(
    assetId: string,
    orgId: string
  ): Promise<ComplianceAssetWithRelations | null> {
    try {
      const { data: asset, error: assetError } = await supabaseAdmin
        .from('compliance_assets')
        .select('*')
        .eq('id', assetId)
        .eq('org_id', orgId)
        .single()

      if (assetError || !asset) {
        logger.error({ error: assetError, assetId, orgId }, 'Failed to fetch compliance asset')
        return null
      }

      // Fetch related data
      const [property, items, events, violations] = await Promise.all([
        supabaseAdmin
          .from('properties')
          .select('id, name, address_line1, borough, bin')
          .eq('id', (asset as ComplianceAsset).property_id)
          .single(),
        supabaseAdmin
          .from('compliance_items')
          .select('*')
          .eq('asset_id', assetId)
          .eq('org_id', orgId)
          .order('due_date', { ascending: false }),
        supabaseAdmin
          .from('compliance_events')
          .select('*')
          .eq('asset_id', assetId)
          .eq('org_id', orgId)
          .order('inspection_date', { ascending: false }),
        supabaseAdmin
          .from('compliance_violations')
          .select('*')
          .eq('asset_id', assetId)
          .eq('org_id', orgId)
          .order('issue_date', { ascending: false }),
      ])

      return {
        ...(asset as ComplianceAsset),
        property: property.data || undefined,
        items: (items.data || []) as ComplianceItem[],
        events: (events.data || []) as ComplianceEvent[],
        violations: (violations.data || []) as ComplianceViolation[],
      }
    } catch (error) {
      logger.error({ error, assetId, orgId }, 'Error in getAssetById')
      return null
    }
  }

  /**
   * Create a compliance asset
   */
  static async createAsset(
    data: ComplianceAssetInsert,
    orgId: string
  ): Promise<ComplianceAsset> {
    try {
      const insertData = {
        ...data,
        org_id: orgId,
      }

      const { data: asset, error } = await supabaseAdmin
        .from('compliance_assets')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        logger.error({ error, data, orgId }, 'Failed to create compliance asset')
        throw error
      }

      return asset as ComplianceAsset
    } catch (error) {
      logger.error({ error, data, orgId }, 'Error in createAsset')
      throw error
    }
  }

  /**
   * Update a compliance asset
   */
  static async updateAsset(
    assetId: string,
    updates: ComplianceAssetUpdate,
    orgId: string
  ): Promise<ComplianceAsset> {
    try {
      const { data: asset, error } = await supabaseAdmin
        .from('compliance_assets')
        .update(updates)
        .eq('id', assetId)
        .eq('org_id', orgId)
        .select()
        .single()

      if (error) {
        logger.error({ error, assetId, updates, orgId }, 'Failed to update compliance asset')
        throw error
      }

      return asset as ComplianceAsset
    } catch (error) {
      logger.error({ error, assetId, updates, orgId }, 'Error in updateAsset')
      throw error
    }
  }

  /**
   * Get compliance items by property
   */
  static async getItemsByProperty(
    propertyId: string,
    orgId: string,
    filters?: ComplianceItemFilters
  ): Promise<ComplianceItemWithRelations[]> {
    try {
      let query = supabaseAdmin
        .from('compliance_items')
        .select(`
          *,
          program:compliance_programs(*),
          asset:compliance_assets(*),
          property:properties(id, name, address_line1, borough, bin)
        `)
        .eq('property_id', propertyId)
        .eq('org_id', orgId)

      if (filters?.asset_id) {
        query = query.eq('asset_id', filters.asset_id)
      }

      if (filters?.program_id) {
        query = query.eq('program_id', filters.program_id)
      }

      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status)
      }

      if (filters?.due_before) {
        query = query.lte('due_date', filters.due_before)
      }

      if (filters?.due_after) {
        query = query.gte('due_date', filters.due_after)
      }

      if (filters?.overdue_only) {
        query = query.eq('status', 'overdue')
      }

      const { data, error } = await query.order('due_date', { ascending: true })

      if (error) {
        logger.error({ error, propertyId, orgId }, 'Failed to fetch compliance items')
        throw error
      }

      return (data || []) as ComplianceItemWithRelations[]
    } catch (error) {
      logger.error({ error, propertyId, orgId }, 'Error in getItemsByProperty')
      throw error
    }
  }

  /**
   * Get compliance item by ID with relations
   */
  static async getItemById(
    itemId: string,
    orgId: string
  ): Promise<ComplianceItemWithRelations | null> {
    try {
      const { data: item, error: itemError } = await supabaseAdmin
        .from('compliance_items')
        .select(`
          *,
          program:compliance_programs(*),
          asset:compliance_assets(*),
          property:properties(id, name, address_line1, borough, bin)
        `)
        .eq('id', itemId)
        .eq('org_id', orgId)
        .single()

      if (itemError || !item) {
        logger.error({ error: itemError, itemId, orgId }, 'Failed to fetch compliance item')
        return null
      }

      // Fetch related work orders, events, and violations
      const [workOrders, events, violations] = await Promise.all([
        supabaseAdmin
          .from('compliance_item_work_orders')
          .select('*')
          .eq('item_id', itemId)
          .eq('org_id', orgId),
        supabaseAdmin
          .from('compliance_events')
          .select('*')
          .eq('item_id', itemId)
          .eq('org_id', orgId)
          .order('inspection_date', { ascending: false }),
        supabaseAdmin
          .from('compliance_violations')
          .select('*')
          .eq('linked_item_id', itemId)
          .eq('org_id', orgId)
          .order('issue_date', { ascending: false }),
      ])

      const typedItem = item as (ComplianceItem & {
        program?: ComplianceProgram | null
        asset?: ComplianceAsset | null
        property?: ComplianceItemWithRelations['property']
      })

      return {
        ...typedItem,
        program: typedItem.program ?? undefined,
        asset: typedItem.asset ?? undefined,
        property: typedItem.property,
        work_orders: (workOrders.data || []) as ComplianceItemWorkOrder[],
        events: (events.data || []) as ComplianceEvent[],
        violations: (violations.data || []) as ComplianceViolation[],
      }
    } catch (error) {
      logger.error({ error, itemId, orgId }, 'Error in getItemById')
      return null
    }
  }

  /**
   * Update compliance item status
   */
  static async updateItemStatus(
    itemId: string,
    status: ComplianceItem['status'],
    orgId: string,
    updates?: Partial<ComplianceItemUpdate>
  ): Promise<ComplianceItem> {
    try {
      const updateData: ComplianceItemUpdate = {
        status,
        ...updates,
      }

      const { data: item, error } = await supabaseAdmin
        .from('compliance_items')
        .update(updateData)
        .eq('id', itemId)
        .eq('org_id', orgId)
        .select()
        .single()

      if (error) {
        logger.error({ error, itemId, status, orgId }, 'Failed to update compliance item status')
        throw error
      }

      return item as ComplianceItem
    } catch (error) {
      logger.error({ error, itemId, status, orgId }, 'Error in updateItemStatus')
      throw error
    }
  }

  /**
   * Link compliance item to work order
   */
  static async linkItemToWorkOrder(
    itemId: string,
    workOrderId: string,
    orgId: string,
    role: 'primary' | 'related' = 'related'
  ): Promise<void> {
    try {
      // First, check if link already exists
      const { data: existing } = await supabaseAdmin
        .from('compliance_item_work_orders')
        .select('id')
        .eq('item_id', itemId)
        .eq('work_order_id', workOrderId)
        .maybeSingle()

      if (existing) {
        // Update existing link
        await supabaseAdmin
          .from('compliance_item_work_orders')
          .update({ role })
          .eq('id', existing.id)
      } else {
        // Create new link
        await supabaseAdmin
          .from('compliance_item_work_orders')
          .insert({
            item_id: itemId,
            work_order_id: workOrderId,
            org_id: orgId,
            role,
          })
      }

      // If this is the primary work order, update the item
      if (role === 'primary') {
        await supabaseAdmin
          .from('compliance_items')
          .update({ primary_work_order_id: workOrderId })
          .eq('id', itemId)
          .eq('org_id', orgId)
      }
    } catch (error) {
      logger.error({ error, itemId, workOrderId, orgId }, 'Error in linkItemToWorkOrder')
      throw error
    }
  }

  /**
   * Get violations by property
   */
  static async getViolationsByProperty(
    propertyId: string,
    orgId: string,
    filters?: ComplianceViolationFilters
  ): Promise<ComplianceViolationWithRelations[]> {
    try {
      let query = supabaseAdmin
        .from('compliance_violations')
        .select(`
          *,
          property:properties(id, name, address_line1, borough),
          asset:compliance_assets(*)
        `)
        .eq('property_id', propertyId)
        .eq('org_id', orgId)

      if (filters?.asset_id) {
        query = query.eq('asset_id', filters.asset_id)
      }

      if (filters?.agency && filters.agency.length > 0) {
        query = query.in('agency', filters.agency)
      }

      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status)
      }

      if (filters?.open_only) {
        query = query.eq('status', 'open')
      }

      const { data, error } = await query.order('issue_date', { ascending: false })

      if (error) {
        logger.error({ error, propertyId, orgId }, 'Failed to fetch compliance violations')
        throw error
      }

      return (data || []) as ComplianceViolationWithRelations[]
    } catch (error) {
      logger.error({ error, propertyId, orgId }, 'Error in getViolationsByProperty')
      throw error
    }
  }

  /**
   * Get portfolio compliance summary
   */
  static async getPortfolioSummary(
    orgId: string,
    filters?: {
      jurisdiction?: string[]
      program?: string[]
      status?: string[]
      borough?: string[]
      owner?: string
    }
  ): Promise<CompliancePortfolioSummary> {
    try {
      // Build property query with filters
      let propertyQuery = supabaseAdmin
        .from('properties')
        .select('id, name, address_line1, borough, bin')
        .eq('org_id', orgId)

      if (filters?.borough && filters.borough.length > 0) {
        propertyQuery = propertyQuery.in('borough', filters.borough)
      }

      const { data: properties, error: propertiesError } = await propertyQuery

      if (propertiesError) {
        logger.error({ error: propertiesError, orgId }, 'Failed to fetch properties for portfolio summary')
        throw propertiesError
      }

      const propertyIds = (properties || []).map((p) => p.id)

      if (propertyIds.length === 0) {
        return {
          total_properties: 0,
          properties_with_assets: 0,
          total_assets: 0,
          open_violations: 0,
          overdue_items: 0,
          items_due_next_30_days: 0,
          average_risk_score: null,
          properties: [],
        }
      }

      // Fetch aggregated data
      const [
        assetsResult,
        violationsResult,
        itemsResult,
        itemsDueResult,
      ] = await Promise.all([
        supabaseAdmin
          .from('compliance_assets')
          .select('property_id, id')
          .eq('org_id', orgId)
          .in('property_id', propertyIds),
        supabaseAdmin
          .from('compliance_violations')
          .select('property_id, id')
          .eq('org_id', orgId)
          .eq('status', 'open')
          .in('property_id', propertyIds),
        supabaseAdmin
          .from('compliance_items')
          .select('property_id, id')
          .eq('org_id', orgId)
          .eq('status', 'overdue')
          .in('property_id', propertyIds),
        supabaseAdmin
          .from('compliance_items')
          .select('property_id, id')
          .eq('org_id', orgId)
          .in('status', ['not_started', 'scheduled', 'in_progress'])
          .gte('due_date', new Date().toISOString().split('T')[0])
          .lte('due_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .in('property_id', propertyIds),
      ])

      const assets = (assetsResult.data || []) as Array<{ property_id: string; id: string }>
      const violations = (violationsResult.data || []) as Array<{ property_id: string; id: string }>
      const overdueItems = (itemsResult.data || []) as Array<{ property_id: string; id: string }>
      const itemsDue = (itemsDueResult.data || []) as Array<{ property_id: string; id: string }>

      // Group by property
      const propertyMap = new Map<string, CompliancePropertySummary>()

      for (const property of properties || []) {
        const propertyAssets = assets.filter((a) => a.property_id === property.id)
        const propertyViolations = violations.filter((v) => v.property_id === property.id)
        const propertyOverdue = overdueItems.filter((i) => i.property_id === property.id)
        const propertyDue = itemsDue.filter((i) => i.property_id === property.id)

        // Get last elevator inspection
        const { data: lastElevatorInspection } = await supabaseAdmin
          .from('compliance_events')
          .select('inspection_date')
          .eq('org_id', orgId)
          .eq('property_id', property.id)
          .in('event_type', ['inspection', 'filing'])
          .order('inspection_date', { ascending: false })
          .limit(1)
          .maybeSingle()

        // Calculate risk score (simplified: based on violations and overdue items)
        const riskScore = Math.min(
          100,
          propertyViolations.length * 20 + propertyOverdue.length * 10
        )

        const statusIndicator: 'critical' | 'warning' | 'ok' =
          propertyViolations.length > 0 || propertyOverdue.length > 0
            ? 'critical'
            : propertyDue.length > 0
            ? 'warning'
            : 'ok'

        propertyMap.set(property.id, {
          property_id: property.id,
          property_name: property.name,
          address_line1: property.address_line1,
          borough: property.borough,
          bin: property.bin || null,
          asset_count: propertyAssets.length,
          open_violations: propertyViolations.length,
          overdue_items: propertyOverdue.length,
          items_due_next_30_days: propertyDue.length,
          last_elevator_inspection: lastElevatorInspection?.inspection_date || null,
          risk_score: riskScore > 0 ? riskScore : null,
          status_indicator: statusIndicator,
        })
      }

      const propertySummaries = Array.from(propertyMap.values())

      // Calculate averages
      const totalRiskScores = propertySummaries
        .map((p) => p.risk_score)
        .filter((s): s is number => s !== null)
      const averageRiskScore =
        totalRiskScores.length > 0
          ? totalRiskScores.reduce((a, b) => a + b, 0) / totalRiskScores.length
          : null

      return {
        total_properties: properties.length,
        properties_with_assets: new Set(assets.map((a) => a.property_id)).size,
        total_assets: assets.length,
        open_violations: violations.length,
        overdue_items: overdueItems.length,
        items_due_next_30_days: itemsDue.length,
        average_risk_score: averageRiskScore,
        properties: propertySummaries,
      }
    } catch (error) {
      logger.error({ error, orgId }, 'Error in getPortfolioSummary')
      throw error
    }
  }
}
