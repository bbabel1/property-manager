import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/db'
import { buildiumEdgeClient } from '@/lib/buildium-edge-client'
import { upsertOwnerFromBuildium } from '@/lib/buildium-mappers'

// Sync a single Buildium owner into the local database (contacts + owners)
// POST /api/buildium/owners/:id/sync
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    await requireRole('platform_admin')
    const { id } = await params
    const buildiumId = Number(id)
    if (!Number.isFinite(buildiumId) || buildiumId <= 0) {
      return NextResponse.json({ error: 'Invalid Buildium owner id' }, { status: 400 })
    }

    // Fetch Owner from Buildium via Edge Function (keeps secrets at the edge)
    const fetchResult = await buildiumEdgeClient.getOwnerFromBuildium(buildiumId)
    if (!fetchResult.success || !fetchResult.data) {
      return NextResponse.json(
        { error: fetchResult.error || 'Failed to fetch owner from Buildium' },
        { status: 502 }
      )
    }

    // Upsert into local DB (creates/updates contact and owner rows)
    const { ownerId, created } = await upsertOwnerFromBuildium(fetchResult.data, supabaseAdmin)

    logger.info({ buildiumId, ownerId, created }, 'Owner synced from Buildium into DB')

    return NextResponse.json({ success: true, ownerId, buildiumId, created: !!created })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    logger.error({ error: err instanceof Error ? err.message : String(err) }, 'Error syncing Buildium owner')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
