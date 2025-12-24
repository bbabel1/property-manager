/**
 * Compliance Item API Route
 * 
 * GET /api/compliance/items/[itemId] - Get item details
 * PATCH /api/compliance/items/[itemId] - Update item
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { ComplianceService } from '@/lib/compliance-service'
import { supabaseAdmin } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
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

    const { itemId } = await params

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

    // Fetch item with relations
    const item = await ComplianceService.getItemById(itemId, orgId)

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    return NextResponse.json(item)
  } catch (error) {
    logger.error({ error }, 'Error in compliance item API')
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
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

    const { itemId } = await params
    const body = await request.json()

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

    // Update item
    if (body.status) {
      await ComplianceService.updateItemStatus(itemId, body.status, orgId, {
        notes: body.notes,
        next_action: body.next_action,
        primary_work_order_id: body.primary_work_order_id,
      })
    } else {
      // Update other fields
      const { error: updateError } = await supabaseAdmin
        .from('compliance_items')
        .update({
          notes: body.notes,
          next_action: body.next_action,
          primary_work_order_id: body.primary_work_order_id,
        })
        .eq('id', itemId)
        .eq('org_id', orgId)

      if (updateError) {
        throw updateError
      }
    }

    // Return updated item
    const item = await ComplianceService.getItemById(itemId, orgId)

    return NextResponse.json(item)
  } catch (error) {
    logger.error({ error }, 'Error updating compliance item')
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
