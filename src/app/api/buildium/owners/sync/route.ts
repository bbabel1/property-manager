/* eslint-disable @typescript-eslint/ban-ts-comment */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/db'
import { upsertOwnerFromBuildium } from '@/lib/buildium-mappers'

// Bulk sync Buildium owners into the local database.
// Body supports either { ids: number[] } or a filter window:
// { lastupdatedfrom?: string, lastupdatedto?: string, limit?: number, offset?: number }
export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

  const auth = await requireRole('platform_admin')
  const userId = auth.user.id

    const body = await request.json().catch(() => ({}))
    const ids: number[] | undefined = Array.isArray(body?.ids) ? body.ids : undefined
    const lastupdatedfrom: string | undefined = body?.lastupdatedfrom
    const lastupdatedto: string | undefined = body?.lastupdatedto
    const limit: number = Math.max(1, Math.min(1000, Number(body?.limit ?? 100)))
    const offset: number = Math.max(0, Number(body?.offset ?? 0))

    let owners: any[] = []

    if (ids && ids.length > 0) {
      // Fetch each owner by id from Buildium
      const unique = [...new Set(ids.filter(n => Number.isFinite(n) && n > 0))]
      for (const id of unique) {
        const res = await fetch(`${process.env.BUILDIUM_BASE_URL}/rentals/owners/${id}` , {
          headers: {
            'Accept': 'application/json',
            'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
            'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
          }
        })
        if (res.ok) {
          const data = await res.json()
          owners.push(data)
        } else {
          logger.warn({ id, status: res.status }, 'Failed to fetch owner by id from Buildium')
        }
      }
    } else {
      // List owners from Buildium with optional lastupdated window
      const qs = new URLSearchParams()
      qs.set('limit', String(limit))
      qs.set('offset', String(offset))
      if (lastupdatedfrom) qs.set('lastupdatedfrom', lastupdatedfrom)
      if (lastupdatedto) qs.set('lastupdatedto', lastupdatedto)

      const res = await fetch(`${process.env.BUILDIUM_BASE_URL}/rentals/owners?${qs.toString()}` , {
        headers: {
          'Accept': 'application/json',
          'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
          'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
        }
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        return NextResponse.json({ error: 'Failed to list Buildium owners', details: txt }, { status: res.status })
      }
      owners = await res.json()
      if (!Array.isArray(owners)) owners = []
    }

    // Upsert owners to local DB
    let created = 0
    let updated = 0
    const results: Array<{ buildiumId: number, ownerId: string, created: boolean }> = []
    for (const o of owners) {
      try {
        const { ownerId, created: wasCreated } = await upsertOwnerFromBuildium(o, supabaseAdmin)
        if (wasCreated) created++
        else updated++
        results.push({ buildiumId: o?.Id, ownerId, created: !!wasCreated })
      } catch (e) {
        logger.error({ buildiumId: o?.Id, error: e instanceof Error ? e.message : String(e) }, 'Failed to upsert owner from Buildium')
      }
    }

    logger.info({ created, updated, count: owners.length, userId }, 'Bulk owner sync completed')
    return NextResponse.json({ success: true, inputCount: owners.length, created, updated, results })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    logger.error({ error: err instanceof Error ? err.message : String(err) }, 'Error in bulk Buildium owner sync')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
