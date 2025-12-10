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
      .select('id, name, address_line1, borough, bin, org_id')
      .eq('id', propertyId)
      .eq('org_id', orgId)
      .single()

    if (propertyError || !property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    // Fetch compliance data
    const [items, violations, assets, events] = await Promise.all([
      ComplianceService.getItemsByProperty(propertyId, orgId),
      ComplianceService.getViolationsByProperty(propertyId, orgId),
      ComplianceService.getAssetsByProperty(propertyId, orgId),
      supabaseAdmin
        .from('compliance_events')
        .select('id, inspection_date, filed_date, event_type, inspection_type, compliance_status, created_at')
        .eq('property_id', propertyId)
        .eq('org_id', orgId)
        .order('inspection_date', { ascending: false, nullsFirst: false })
        .limit(50),
    ])

    // Calculate summary
    const overdueItems = items.filter((item) => item.status === 'overdue').length
    const itemsDueNext30Days = items.filter((item) => {
      if (item.status !== 'not_started' && item.status !== 'scheduled') return false
      const dueDate = new Date(item.due_date)
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
      return dueDate <= thirtyDaysFromNow && dueDate >= new Date()
    }).length

    return NextResponse.json({
      property: {
        id: property.id,
        name: property.name,
        address_line1: property.address_line1,
        borough: property.borough,
        bin: property.bin,
      },
      items,
      violations,
      assets,
      events: events.data || [],
      summary: {
        open_violations: violations.filter((v) => v.status === 'open').length,
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
