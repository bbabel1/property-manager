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
      // Get all enabled compliance programs for this org
      const { data: programs, error: programsError } = await supabaseAdmin
        .from('compliance_programs')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_enabled', true)

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

      // Generate items for each program
      for (const program of programs) {
        try {
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
        .select('id, property_id, asset_type')
        .eq('id', assetId)
        .eq('org_id', orgId)
        .single()

      if (assetError || !asset) {
        throw new Error(`Asset not found: ${assetId}`)
      }

      // Get programs that apply to this asset type
      const { data: programs, error: programsError } = await supabaseAdmin
        .from('compliance_programs')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_enabled', true)
        .in('applies_to', ['asset', 'both'])

      if (programsError) {
        logger.error({ error: programsError, assetId, orgId }, 'Failed to fetch compliance programs')
        throw programsError
      }

      if (!programs || programs.length === 0) {
        return { success: true, items_created: 0, items_skipped: 0 }
      }

      let itemsCreated = 0
      let itemsSkipped = 0
      const errors: string[] = []

      for (const program of programs) {
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
        .select('org_id')
        .eq('id', propertyId)
        .single()

      if (propertyError || !property) {
        throw new Error(`Property not found: ${propertyId}`)
      }

      if (property.org_id !== orgId) {
        throw new Error(`Property org_id mismatch: ${property.org_id} !== ${orgId}`)
      }

      // Calculate periods (timezone-aware)
      const now = new Date()
      const timezone = 'America/New_York' // NYC timezone
      const periods = this.calculatePeriods(
        program.frequency_months,
        program.lead_time_days,
        periodsAhead,
        timezone
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
    timezone: string
  ): Array<{ period_start: string; period_end: string; due_date: string }> {
    const periods: Array<{ period_start: string; period_end: string; due_date: string }> = []

    // Get current date in NYC timezone
    const now = new Date()
    const nycDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }))

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
        periods.push({
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          due_date: dueDate.toISOString().split('T')[0],
        })
      }
    }

    return periods
  }
}

