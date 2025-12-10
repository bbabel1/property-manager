/**
 * Portfolio Compliance API Route
 * 
 * GET /api/compliance/portfolio
 * 
 * Returns aggregated compliance data for portfolio dashboard
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { ComplianceService } from '@/lib/compliance-service'
import { supabaseAdmin } from '@/lib/db'

const MAX_PAGE_SIZE = 100
const DEFAULT_PAGE_SIZE = 20

export async function GET(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const user = await requireUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(MAX_PAGE_SIZE, parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10))

    const filters = {
      jurisdiction: searchParams.get('jurisdiction')?.split(',').filter(Boolean),
      program: searchParams.get('program')?.split(',').filter(Boolean),
      status: searchParams.get('status')?.split(',').filter(Boolean),
      borough: searchParams.get('borough')?.split(',').filter(Boolean),
      owner: searchParams.get('owner') || undefined,
    }

    // Get portfolio summary
    const summary = await ComplianceService.getPortfolioSummary(orgId, filters)

    // Apply pagination to properties
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedProperties = summary.properties.slice(startIndex, endIndex)

    return NextResponse.json({
      ...summary,
      properties: paginatedProperties,
      pagination: {
        page,
        pageSize,
        total: summary.properties.length,
        totalPages: Math.ceil(summary.properties.length / pageSize),
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorDetails = error instanceof Error ? { message: error.message, stack: error.stack } : error
    logger.error({ error: errorDetails, errorMessage }, 'Error in portfolio compliance API')
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    )
  }
}
