/**
 * Property Compliance API Route
 * 
 * GET /api/compliance/properties/[propertyId]
 * 
 * Returns compliance data for a specific property
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { ComplianceService } from '@/lib/compliance-service'
import { supabaseAdmin } from '@/lib/db'
import { ComplianceItemGenerator } from '@/lib/compliance-item-generator'

type StatusChip = 'on_track' | 'at_risk' | 'non_compliant'

function computeStatusChip(openViolations: number, overdueItems: number): StatusChip {
  if (openViolations > 0 || overdueItems > 0) {
    if (openViolations >= 3 || overdueItems >= 2) return 'non_compliant'
    return 'at_risk'
  }
  return 'on_track'
}

function normalizeEventResult(status?: string | null): string | null {
  if (!status) return null
  const s = status.toLowerCase()
  if (s.includes('defect') || s.includes('reject') || s.includes('fail')) return 'fail'
  if (s.includes('pass') || s.includes('accept')) return 'pass'
  return status
}

const ELEVATOR_PROGRAM_CODES = ['NYC_ELV_PERIODIC', 'NYC_ELV_CAT1', 'NYC_ELV_CAT5']

function parseDate(value?: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function dateFromYear(value?: string | number | null): Date | null {
  if (value === null || value === undefined) return null
  const year = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value)
  if (!Number.isFinite(year)) return null
  return new Date(Date.UTC(year, 11, 31))
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function advanceToFuture(date: Date, frequencyMonths: number): Date {
  if (frequencyMonths <= 0) return date
  const now = new Date()
  let cursor = addMonths(date, frequencyMonths)
  // keep advancing to the next cycle if the calculated due is already in the past
  while (cursor < now) {
    cursor = addMonths(cursor, frequencyMonths)
  }
  return cursor
}

function categorizeElevatorEvent(inspectionType?: string | null): typeof ELEVATOR_PROGRAM_CODES[number] | null {
  if (!inspectionType) return null
  const normalized = inspectionType.toLowerCase()
  if (normalized.includes('cat 5') || normalized.includes('cat5') || normalized.includes('category 5')) return 'NYC_ELV_CAT5'
  if (normalized.includes('cat 1') || normalized.includes('cat1') || normalized.includes('category 1')) return 'NYC_ELV_CAT1'
  if (normalized.includes('periodic') || normalized.includes('visual')) return 'NYC_ELV_PERIODIC'
  return null
}

function computeElevatorSchedule(
  asset: any,
  events: Array<{ asset_id?: string | null; inspection_type?: string | null; inspection_date?: string | null; filed_date?: string | null; created_at?: string | null }>,
  programs: Array<{ code: string; frequency_months: number; effective_is_enabled?: boolean; is_enabled?: boolean }>
): { lastInspection: Date | null; nextDue: Date | null } {
  const relevantEvents = events.filter((event) => event.asset_id === asset.id)
  const lastByCode: Record<string, Date | null> = {
    NYC_ELV_PERIODIC: null,
    NYC_ELV_CAT1: null,
    NYC_ELV_CAT5: null,
  }
  let lastInspection: Date | null = null

  const updateLast = (code: string, candidate: Date | null) => {
    if (!candidate || !ELEVATOR_PROGRAM_CODES.includes(code)) return
    const current = lastByCode[code] || null
    if (!current || candidate > current) {
      lastByCode[code] = candidate
    }
  }

  const updateOverall = (candidate: Date | null) => {
    if (!candidate) return
    if (!lastInspection || candidate > lastInspection) {
      lastInspection = candidate
    }
  }

  for (const event of relevantEvents) {
    const eventDate = parseDate(event.filed_date) || parseDate(event.inspection_date) || parseDate(event.created_at)
    updateOverall(eventDate)
    const bucket = categorizeElevatorEvent(event.inspection_type)
    if (bucket) {
      updateLast(bucket, eventDate)
    }
  }

  const meta = ((asset as any)?.metadata || {}) as Record<string, any>
  updateLast('NYC_ELV_PERIODIC', parseDate(meta.periodic_latest_inspection) || dateFromYear(meta.periodic_report_year))
  updateLast('NYC_ELV_CAT1', parseDate(meta.cat1_latest_report_filed) || dateFromYear(meta.cat1_report_year))
  updateLast('NYC_ELV_CAT5', parseDate(meta.cat5_latest_report_filed))

  const dueCandidates: Date[] = []
  for (const program of programs) {
    const enabled = typeof program.effective_is_enabled === 'boolean' ? program.effective_is_enabled : program.is_enabled
    if (!enabled) continue
    if (!program.frequency_months || program.frequency_months <= 0) continue
    const baseline = lastByCode[program.code as typeof ELEVATOR_PROGRAM_CODES[number]]
    if (!baseline) continue
    const next = advanceToFuture(addMonths(baseline, program.frequency_months), program.frequency_months)
    dueCandidates.push(next)
  }

  const nextDue = dueCandidates.length ? new Date(Math.min(...dueCandidates.map((d) => d.getTime()))) : null
  return { lastInspection, nextDue }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const user = await requireUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { propertyId } = await params

    // Get org_id from user's org memberships
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('org_memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (membershipError || !membership?.org_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
    }

    const orgId = membership.org_id

    // Verify property belongs to org
    const { data: property, error: propertyError } = await supabaseAdmin
      .from('properties')
      .select('id, name, address_line1, borough, bin, org_id, building_id, total_units')
      .eq('id', propertyId)
      .eq('org_id', orgId)
      .single()

    if (propertyError || !property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    // Fetch compliance data
    const [itemsResult, violations, assetsResult, eventsResp, programsResp, overridesResp] = await Promise.all([
      ComplianceService.getItemsByProperty(propertyId, orgId),
      ComplianceService.getViolationsByProperty(propertyId, orgId),
      ComplianceService.getAssetsByProperty(propertyId, orgId),
      supabaseAdmin
        .from('compliance_events')
        .select('id, asset_id, inspection_date, filed_date, event_type, inspection_type, compliance_status, external_tracking_number, created_at')
        .eq('property_id', propertyId)
        .eq('org_id', orgId)
        .order('inspection_date', { ascending: false, nullsFirst: false })
        .limit(100),
      supabaseAdmin
        .from('compliance_programs')
        .select('*, template:compliance_program_templates(id, code, jurisdiction, frequency_months, lead_time_days, applies_to, severity_score)')
        .eq('org_id', orgId),
      supabaseAdmin
        .from('compliance_property_program_overrides')
        .select('*')
        .eq('org_id', orgId)
        .eq('property_id', propertyId),
    ])
    let items = itemsResult
    let assets = assetsResult

    if (programsResp.error) {
      logger.error({ error: programsResp.error, propertyId, orgId }, 'Failed to load compliance programs for property')
      return NextResponse.json({ error: 'Failed to load compliance programs' }, { status: 500 })
    }

    if (overridesResp.error) {
      logger.error({ error: overridesResp.error, propertyId, orgId }, 'Failed to load compliance program overrides')
    }

    const programs = programsResp.data || []
    const programOverrideRows = overridesResp.data || []

    // Auto-generate compliance items if none exist yet, but only when assets exist (so programs have targets)
    if (!items || items.length === 0) {
      try {
        const generator = new ComplianceItemGenerator()

        // Generate for each asset (asset-scoped programs)
        if (assets && assets.length > 0) {
          for (const asset of assets) {
            await generator.generateItemsForAsset(asset.id, orgId, 12)
          }
        }

        // Also generate property-scoped programs
        await generator.generateItemsForProperty(propertyId, orgId, 12)

        items = await ComplianceService.getItemsByProperty(propertyId, orgId)
      } catch (genErr) {
        logger.error({ error: genErr, propertyId, orgId }, 'Failed to auto-generate compliance items')
      }
    }

    const eventsData = eventsResp.data || []

    const overridesMap = new Map(
      (programOverrideRows || []).map((row: any) => [row.program_id as string, row])
    )

    const programsWithOverrides = (programs || []).map((program: any) => {
      const override = overridesMap.get(program.id) || null
      const effective_is_enabled =
        typeof override?.is_enabled === 'boolean' ? override.is_enabled : program.is_enabled
      return { ...program, override, effective_is_enabled }
    })

    const enabledProgramIds = new Set(
      programsWithOverrides
        .filter((p: any) =>
          typeof p.effective_is_enabled === 'boolean' ? p.effective_is_enabled : p.is_enabled
        )
        .map((p: any) => p.id as string)
    )

    // Drop items for programs that are disabled at the property level
    items = (items || []).filter((item) => enabledProgramIds.has(item.program_id))

    const elevatorPrograms = programsWithOverrides.filter(
      (p: any) => ELEVATOR_PROGRAM_CODES.includes(p.code)
    )

    const assetsWithSchedule = (assets || []).map((asset: any) => {
      if ((asset as any).asset_type !== 'elevator') return asset
      const { lastInspection, nextDue } = computeElevatorSchedule(asset, eventsData, elevatorPrograms)
      return {
        ...asset,
        last_inspection_at: lastInspection ? lastInspection.toISOString() : null,
        next_due: nextDue ? nextDue.toISOString().split('T')[0] : null,
      }
    })

    assets = assetsWithSchedule

    // Enforce 5-year horizon on returned items
    const horizon = new Date()
    horizon.setFullYear(horizon.getFullYear() + 5)
    items = items.filter((item) => {
      const due = new Date(item.due_date)
      return due <= horizon
    })

    // Calculate summary
    const overdueItems = items.filter((item) => item.status === 'overdue').length
    const itemsDueNext30Days = items.filter((item) => {
      if (item.status !== 'not_started' && item.status !== 'scheduled') return false
      const dueDate = new Date(item.due_date)
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
      return dueDate <= thirtyDaysFromNow && dueDate >= new Date()
    }).length

    const openViolationsCount = violations.filter((v) => v.status === 'open' || v.status === 'in_progress').length

    const earliestDueItem = items
      .filter((item) => item.status === 'not_started' || item.status === 'scheduled' || item.status === 'overdue')
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0]
    const elevatorNextDue = assetsWithSchedule
      .map((asset: any) => asset.next_due)
      .filter(Boolean)
      .sort((a: string, b: string) => new Date(a).getTime() - new Date(b).getTime())[0]
    const nextDue = earliestDueItem?.due_date || elevatorNextDue || null

    const lastSync = eventsData[0]?.created_at || null

    // Agency summaries
    const byAgency = violations.reduce<Record<string, { count: number; lastDate: string | null }>>((acc, v) => {
      const agency = v.agency || 'OTHER'
      if (!acc[agency]) acc[agency] = { count: 0, lastDate: null }
      acc[agency].count += 1
      const date = v.issue_date ? new Date(v.issue_date).toISOString() : null
      if (date && (!acc[agency].lastDate || date > acc[agency].lastDate)) {
        acc[agency].lastDate = date
      }
      return acc
    }, {})

    const hpd = {
      registration_id: (property as any)?.hpd_registration_id || null,
      building_id: (property as any)?.hpd_building_id || null,
      violations: byAgency.HPD?.count || 0,
      complaints: 0,
      last_event_date: byAgency.HPD?.lastDate || null,
    }

    const fdny = {
      open_violations: byAgency.FDNY?.count || 0,
      last_event_date: byAgency.FDNY?.lastDate || null,
    }

    const dep = {
      open_violations: byAgency.DEP?.count || 0,
      last_event_date: byAgency.DEP?.lastDate || null,
    }

    // Determine how many devices have a usable status (aligns with UI filtering)
    const devicesWithStatus = assets.filter((asset) => {
      const meta = (asset as any)?.metadata as Record<string, any> | null | undefined
      const status = meta?.device_status || meta?.status
      return Boolean(status)
    }).length

    // Activity timeline: combine latest violations + events (limit 50)
    const timeline = [
      ...violations.map((v) => ({
        type: 'violation',
        date: v.issue_date,
        title: v.violation_number,
        status: v.status,
        agency: v.agency,
      })),
      ...eventsData.map((e) => ({
        type: 'event',
        date: e.inspection_date || e.filed_date || e.created_at,
        title: e.inspection_type || e.event_type,
        status: normalizeEventResult(e.compliance_status),
        agency: e.inspection_type ? 'DOB' : null,
      })),
    ]
      .filter((t) => t.date)
      .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime())
      .slice(0, 50)

    // Load building metadata if present
    let building: any = null
    if ((property as any).building_id) {
      const { data: buildingRow } = await supabaseAdmin
        .from('buildings')
        .select('id, occupancy_group, occupancy_description, is_one_two_family, is_private_residence_building, dwelling_unit_count')
        .eq('id', (property as any).building_id)
        .maybeSingle()
      building = buildingRow || null
    }

    return NextResponse.json({
      property: {
        id: property.id,
        name: property.name,
        address_line1: property.address_line1,
        borough: property.borough,
        bin: property.bin,
        building_id: (property as any).building_id || null,
        total_units: (property as any).total_units || null,
      },
      building,
      items,
      violations,
      assets,
      programs: programsWithOverrides,
      events: eventsData,
      kpis: {
        devices: devicesWithStatus,
        open_violations: openViolationsCount,
        next_due: nextDue,
        last_sync: lastSync,
        status_chip: computeStatusChip(openViolationsCount, overdueItems),
      },
      agencies: {
        hpd,
        fdny,
        dep,
      },
      timeline,
      summary: {
        open_violations: openViolationsCount,
        overdue_items: overdueItems,
        items_due_next_30_days: itemsDueNext30Days,
      },
    })
  } catch (error) {
    logger.error({ error }, 'Error in property compliance API')
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
