/**
 * Compliance Item Generator
 * 
 * Service to generate compliance_items based on compliance_programs and frequency.
 * Uses timezone-aware period calculations, respects lead_time_days, and uses
 * unique index to guard against race conditions.
 */

import { supabaseAdmin } from './db'
import { logger } from './logger'
import type {
  ComplianceItemInsert,
  ComplianceItemGenerationRequest,
  ComplianceItemGenerationResponse,
  ComplianceProgram,
} from '@/types/compliance'
import {
  canonicalAssetType,
  programTargetsAsset,
  programTargetsProperty,
  resolveProgramScope,
} from './compliance-programs'

export class ComplianceItemGenerator {
  /**
   * Generate compliance items for a property
   */
  async generateItemsForProperty(
    propertyId: string,
    orgId: string,
    periodsAhead = 12
  ): Promise<ComplianceItemGenerationResponse> {
    try {
      const overrides = await this.getPropertyProgramOverrides(propertyId, orgId)

      // Get all enabled compliance programs for this org
      const { data: programs, error: programsError } = await supabaseAdmin
        .from('compliance_programs')
        .select('*')
        .eq('org_id', orgId)

      if (programsError) {
        logger.error({ error: programsError, propertyId, orgId }, 'Failed to fetch compliance programs')
        throw programsError
      }

      if (!programs || programs.length === 0) {
        logger.info({ propertyId, orgId }, 'No enabled compliance programs found')
        return { success: true, items_created: 0, items_skipped: 0 }
      }

      let itemsCreated = 0
      let itemsSkipped = 0
      const errors: string[] = []

      // Property metadata for criteria evaluation
      const { data: propertyRow } = await supabaseAdmin
        .from('properties')
        .select('id, borough, bin, building_id, total_units')
        .eq('id', propertyId)
        .maybeSingle()

      let propertyMeta: { id: string; borough: string | null; bin: string | null; occupancy_group?: string | null; occupancy_description?: string | null; is_one_two_family?: boolean | null; is_private_residence_building?: boolean | null; dwelling_unit_count?: number | null; property_total_units?: number | null } | null =
        null

      if (propertyRow) {
        propertyMeta = {
          id: propertyRow.id as string,
          borough: (propertyRow as any).borough as string | null,
          bin: (propertyRow as any).bin as string | null,
          property_total_units: (propertyRow as any).total_units as number | null,
        }

        const buildingId = (propertyRow as any).building_id as string | null
        if (buildingId) {
          const { data: buildingRow } = await supabaseAdmin
            .from('buildings')
            .select('id, occupancy_group, occupancy_description, is_one_two_family, is_private_residence_building, dwelling_unit_count')
            .eq('id', buildingId)
            .maybeSingle()
          if (buildingRow) {
            propertyMeta.occupancy_group = (buildingRow as any).occupancy_group as string | null
            propertyMeta.occupancy_description = (buildingRow as any).occupancy_description as string | null
            propertyMeta.is_one_two_family = (buildingRow as any).is_one_two_family as boolean | null
            propertyMeta.is_private_residence_building = (buildingRow as any).is_private_residence_building as boolean | null
            propertyMeta.dwelling_unit_count = (buildingRow as any).dwelling_unit_count as number | null
          }
        }
      }

      // Generate items for each program
      for (const program of programs) {
        try {
          const override = overrides.get(program.id)
          const effectiveEnabled = typeof override === 'boolean' ? override : program.is_enabled
          if (!effectiveEnabled) continue

          const scope = resolveProgramScope(program)
          if ((scope === 'property' || scope === 'both') && !programTargetsProperty(program as ComplianceProgram, propertyMeta)) {
            continue
          }

          const result = await this.generateItemsForProgram(
            program.id,
            propertyId,
            undefined, // asset_id - will be determined by program.applies_to
            orgId,
            periodsAhead
          )
          itemsCreated += result.items_created
          itemsSkipped += result.items_skipped
          if (result.errors) {
            errors.push(...result.errors)
          }
        } catch (error) {
          logger.error({ error, programId: program.id, propertyId, orgId }, 'Error generating items for program')
          errors.push(`Program ${program.code}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      return {
        success: errors.length === 0,
        items_created: itemsCreated,
        items_skipped: itemsSkipped,
        errors: errors.length > 0 ? errors : undefined,
      }
    } catch (error) {
      logger.error({ error, propertyId, orgId }, 'Error in generateItemsForProperty')
      throw error
    }
  }

  /**
   * Generate compliance items for a specific asset
   */
  async generateItemsForAsset(
    assetId: string,
    orgId: string,
    periodsAhead = 12
  ): Promise<ComplianceItemGenerationResponse> {
    try {
      // Get asset details
      const { data: asset, error: assetError } = await supabaseAdmin
        .from('compliance_assets')
        .select('id, property_id, asset_type, external_source, active, metadata, device_category, device_technology, device_subtype, is_private_residence')
        .eq('id', assetId)
        .eq('org_id', orgId)
        .single()

      if (assetError || !asset) {
        throw new Error(`Asset not found: ${assetId}`)
      }

      const assetType = (asset as any).asset_type as string | null

      const overrides = await this.getPropertyProgramOverrides(asset.property_id, orgId)

      // Get programs that apply to this asset type
      const { data: programs, error: programsError } = await supabaseAdmin
        .from('compliance_programs')
        .select('*')
        .eq('org_id', orgId)
        .in('applies_to', ['asset', 'both'])

      if (programsError) {
        logger.error({ error: programsError, assetId, orgId }, 'Failed to fetch compliance programs')
        throw programsError
      }

      if (!programs || programs.length === 0) {
        return { success: true, items_created: 0, items_skipped: 0 }
      }

      // Fetch property meta for criteria checks
      const { data: propertyRow } = await supabaseAdmin
        .from('properties')
        .select('id, borough, bin, building_id, total_units')
        .eq('id', (asset as any).property_id)
        .maybeSingle()
      let propertyMeta: { id: string; borough: string | null; bin: string | null; occupancy_group?: string | null; occupancy_description?: string | null; is_one_two_family?: boolean | null; is_private_residence_building?: boolean | null; dwelling_unit_count?: number | null; property_total_units?: number | null } | null =
        null
      if (propertyRow) {
        propertyMeta = {
          id: propertyRow.id as string,
          borough: (propertyRow as any).borough as string | null,
          bin: (propertyRow as any).bin as string | null,
          property_total_units: (propertyRow as any).total_units as number | null,
        }
        const buildingId = (propertyRow as any).building_id as string | null
        if (buildingId) {
          const { data: buildingRow } = await supabaseAdmin
            .from('buildings')
            .select('id, occupancy_group, occupancy_description, is_one_two_family, is_private_residence_building, dwelling_unit_count')
            .eq('id', buildingId)
            .maybeSingle()
          if (buildingRow) {
            propertyMeta.occupancy_group = (buildingRow as any).occupancy_group as string | null
            propertyMeta.occupancy_description = (buildingRow as any).occupancy_description as string | null
            propertyMeta.is_one_two_family = (buildingRow as any).is_one_two_family as boolean | null
            propertyMeta.is_private_residence_building = (buildingRow as any).is_private_residence_building as boolean | null
            propertyMeta.dwelling_unit_count = (buildingRow as any).dwelling_unit_count as number | null
          }
        }
      }

      // Filter out programs that do not match this asset type (prevent boilers/facades/etc. from being assigned to elevators)
      const typeGuards: Record<string, (code: string) => boolean> = {
        elevator: (code) => code.startsWith('NYC_ELV'),
        boiler: (code) => code.startsWith('NYC_BOILER'),
        sprinkler: (code) => code.startsWith('NYC_SPRINKLER'),
        gas_piping: (code) => code.startsWith('NYC_GAS'),
        facade: (code) => code.startsWith('NYC_FACADE'),
      }
      const normalizedType = canonicalAssetType(asset as any) || (assetType || '').toLowerCase()
      const guard = typeGuards[normalizedType]
      const filteredPrograms = (guard ? programs.filter((p) => guard(p.code || '')) : programs).filter((p) => {
        const override = overrides.get(p.id)
        const effectiveEnabled = typeof override === 'boolean' ? override : p.is_enabled
        if (!effectiveEnabled) return false
        const scope = resolveProgramScope(p as ComplianceProgram)
        if (scope === 'property') return false
        return programTargetsAsset(p as ComplianceProgram, asset as any, propertyMeta)
      })

      let itemsCreated = 0
      let itemsSkipped = 0
      const errors: string[] = []

      for (const program of filteredPrograms) {
        try {
          const result = await this.generateItemsForProgram(
            program.id,
            asset.property_id,
            assetId,
            orgId,
            periodsAhead
          )
          itemsCreated += result.items_created
          itemsSkipped += result.items_skipped
          if (result.errors) {
            errors.push(...result.errors)
          }
        } catch (error) {
          logger.error({ error, programId: program.id, assetId, orgId }, 'Error generating items for program')
          errors.push(`Program ${program.code}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      return {
        success: errors.length === 0,
        items_created: itemsCreated,
        items_skipped: itemsSkipped,
        errors: errors.length > 0 ? errors : undefined,
      }
    } catch (error) {
      logger.error({ error, assetId, orgId }, 'Error in generateItemsForAsset')
      throw error
    }
  }

  /**
   * Generate compliance items for a specific program
   */
  async generateItemsForProgram(
    programId: string,
    propertyId: string,
    assetId: string | undefined,
    orgId: string,
    periodsAhead = 12
  ): Promise<{ items_created: number; items_skipped: number; errors?: string[] }> {
    try {
      // Get program details
      const { data: program, error: programError } = await supabaseAdmin
        .from('compliance_programs')
        .select('*')
        .eq('id', programId)
        .eq('org_id', orgId)
        .single()

      if (programError || !program) {
        throw new Error(`Program not found: ${programId}`)
      }

      // Verify applies_to matches
      if (assetId && program.applies_to === 'property') {
        // Skip - this program doesn't apply to assets
        return { items_created: 0, items_skipped: 0 }
      }

      if (!assetId && program.applies_to === 'asset') {
        // Skip - this program requires an asset
        return { items_created: 0, items_skipped: 0 }
      }

      // Get property org_id to ensure consistency
      const { data: property, error: propertyError } = await supabaseAdmin
        .from('properties')
        .select('org_id, borough, bin, building_id, total_units')
        .eq('id', propertyId)
        .single()

      if (propertyError || !property) {
        throw new Error(`Property not found: ${propertyId}`)
      }

      if (property.org_id !== orgId) {
        throw new Error(`Property org_id mismatch: ${property.org_id} !== ${orgId}`)
      }

      const propertyMeta: {
        id: string
        borough: string | null
        bin: string | null
        occupancy_group?: string | null
        occupancy_description?: string | null
        is_one_two_family?: boolean | null
        is_private_residence_building?: boolean | null
        dwelling_unit_count?: number | null
        property_total_units?: number | null
      } = {
        id: propertyId,
        borough: (property as any).borough as string | null,
        bin: (property as any).bin as string | null,
        property_total_units: (property as any).total_units as number | null,
      }

      const buildingId = (property as any).building_id as string | null
      if (buildingId) {
        const { data: buildingRow } = await supabaseAdmin
          .from('buildings')
          .select('id, occupancy_group, occupancy_description, is_one_two_family, is_private_residence_building, dwelling_unit_count')
          .eq('id', buildingId)
          .maybeSingle()
        if (buildingRow) {
          propertyMeta.occupancy_group = (buildingRow as any).occupancy_group as string | null
          propertyMeta.occupancy_description = (buildingRow as any).occupancy_description as string | null
          propertyMeta.is_one_two_family = (buildingRow as any).is_one_two_family as boolean | null
          propertyMeta.is_private_residence_building = (buildingRow as any).is_private_residence_building as boolean | null
          propertyMeta.dwelling_unit_count = (buildingRow as any).dwelling_unit_count as number | null
        }
      }

      let assetMeta: { id: string; property_id: string; asset_type: string | null; external_source: string | null; active: boolean; metadata: Record<string, unknown> } | null = null
      if (assetId) {
        const { data: assetRow, error: assetRowError } = await supabaseAdmin
        .from('compliance_assets')
        .select('id, property_id, asset_type, external_source, active, metadata, device_category, device_technology, device_subtype, is_private_residence')
        .eq('id', assetId)
        .eq('org_id', orgId)
        .single()

        if (assetRowError || !assetRow) {
          throw new Error(`Asset not found for criteria evaluation: ${assetId}`)
        }
        assetMeta = {
          id: assetRow.id as string,
          property_id: assetRow.property_id as string,
          asset_type: (assetRow as any).asset_type as string | null,
          external_source: (assetRow as any).external_source as string | null,
          active: (assetRow as any).active !== false,
          device_category: (assetRow as any).device_category as string | null,
          device_technology: (assetRow as any).device_technology as string | null,
          device_subtype: (assetRow as any).device_subtype as string | null,
          is_private_residence: (assetRow as any).is_private_residence as boolean | null,
          metadata: ((assetRow as any).metadata || {}) as Record<string, unknown>,
        }
      }

      const scope = resolveProgramScope(program as ComplianceProgram)

      if ((scope === 'property' || scope === 'both') && !programTargetsProperty(program as ComplianceProgram, propertyMeta)) {
        return { items_created: 0, items_skipped: 0 }
      }

      if (assetId && !programTargetsAsset(program as ComplianceProgram, assetMeta, propertyMeta)) {
        return { items_created: 0, items_skipped: 0 }
      }

      // Calculate periods (timezone-aware)
      const now = new Date()
      const timezone = 'America/New_York' // NYC timezone
      const horizon = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
      horizon.setFullYear(horizon.getFullYear() + 5)

      // Clean up any items beyond horizon for this target before creating new ones
      const horizonStr = horizon.toISOString().split('T')[0]
      const deleteQuery = supabaseAdmin
        .from('compliance_items')
        .delete()
        .eq('program_id', programId)
        .eq('property_id', propertyId)
        .gt('due_date', horizonStr)
      if (assetId) {
        deleteQuery.eq('asset_id', assetId)
      } else {
        deleteQuery.is('asset_id', null)
      }
      await deleteQuery

      const periods = this.calculatePeriods(
        program.frequency_months,
        program.lead_time_days,
        periodsAhead,
        timezone,
        horizon,
      )

      let itemsCreated = 0
      let itemsSkipped = 0
      const errors: string[] = []

      for (const period of periods) {
        try {
          // Check if item already exists (unique index will prevent duplicates)
          const { data: existing, error: checkError } = await supabaseAdmin
            .from('compliance_items')
            .select('id')
            .eq('program_id', programId)
            .eq('property_id', propertyId)
            .eq('asset_id', assetId || null)
            .eq('period_start', period.period_start)
            .eq('period_end', period.period_end)
            .maybeSingle()

          if (checkError && checkError.code !== 'PGRST116') {
            throw checkError
          }

          if (existing) {
            itemsSkipped++
            continue
          }

          // Create new item
          const itemData: ComplianceItemInsert = {
            property_id: propertyId,
            asset_id: assetId || null,
            program_id: programId,
            org_id: orgId,
            period_start: period.period_start,
            period_end: period.period_end,
            due_date: period.due_date,
            status: 'not_started',
            source: 'manual',
            defect_flag: false,
          }

          const { error: insertError } = await supabaseAdmin
            .from('compliance_items')
            .insert(itemData)

          if (insertError) {
            // Check if it's a unique constraint violation (race condition)
            if (insertError.code === '23505') {
              itemsSkipped++
              continue
            }
            throw insertError
          }

          itemsCreated++
        } catch (error) {
          logger.error({ error, period, programId, propertyId, assetId }, 'Error creating compliance item')
          errors.push(`Period ${period.period_start} to ${period.period_end}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      return {
        items_created: itemsCreated,
        items_skipped: itemsSkipped,
        errors: errors.length > 0 ? errors : undefined,
      }
    } catch (error) {
      logger.error({ error, programId, propertyId, assetId, orgId }, 'Error in generateItemsForProgram')
      throw error
    }
  }

  /**
   * Calculate compliance periods based on frequency and lead time
   * Timezone-aware to ensure consistent date calculations
   */
  private calculatePeriods(
    frequencyMonths: number,
    leadTimeDays: number,
    periodsAhead: number,
    timezone: string,
    horizonOverride?: Date
  ): Array<{ period_start: string; period_end: string; due_date: string }> {
    if (frequencyMonths <= 0) return []
    const periods: Array<{ period_start: string; period_end: string; due_date: string }> = []

    // Get current date in NYC timezone
    const now = new Date()
    const nycDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
    const maxLookaheadYears = 5
    const horizon = horizonOverride
      ? new Date(horizonOverride)
      : (() => {
          const h = new Date(nycDate)
          h.setFullYear(h.getFullYear() + maxLookaheadYears)
          return h
        })()

    // Start from the beginning of the current month
    const startDate = new Date(nycDate.getFullYear(), nycDate.getMonth(), 1)

    for (let i = 0; i < periodsAhead; i++) {
      const periodStart = new Date(startDate)
      periodStart.setMonth(periodStart.getMonth() + i * frequencyMonths)

      const periodEnd = new Date(periodStart)
      periodEnd.setMonth(periodEnd.getMonth() + frequencyMonths)
      periodEnd.setDate(periodEnd.getDate() - 1) // Last day of period

      // Due date is period_end minus lead_time_days
      const dueDate = new Date(periodEnd)
      dueDate.setDate(dueDate.getDate() - leadTimeDays)

      // Only include periods where due_date is in the future or recent past (last 30 days)
      const thirtyDaysAgo = new Date(nycDate)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      if (dueDate >= thirtyDaysAgo) {
        if (dueDate > horizon) {
          break
        }
        periods.push({
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          due_date: dueDate.toISOString().split('T')[0],
        })
      }
    }

    return periods
  }

  private async getPropertyProgramOverrides(
    propertyId: string,
    orgId: string
  ): Promise<Map<string, boolean | null>> {
    try {
      const { data, error } = await supabaseAdmin
        .from('compliance_property_program_overrides')
        .select('program_id, is_enabled')
        .eq('property_id', propertyId)
        .eq('org_id', orgId)

      if (error) {
        logger.error({ error, propertyId, orgId }, 'Failed to load program overrides for property')
        return new Map()
      }

      const map = new Map<string, boolean | null>()
      ;(data || []).forEach((row) => {
        map.set(row.program_id, typeof row.is_enabled === 'boolean' ? row.is_enabled : null)
      })
      return map
    } catch (error) {
      logger.error({ error, propertyId, orgId }, 'Error loading program overrides for property')
      return new Map()
    }
  }
}
