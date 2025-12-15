/* eslint-disable @typescript-eslint/ban-ts-comment */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { BuildiumTenantUpdateSchema } from '@/schemas/buildium'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { buildiumEdgeClient } from '@/lib/buildium-edge-client'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    await requireRole('platform_admin')

    const { id } = await params
    const proxy = await buildiumEdgeClient.proxyRaw('GET', `/rentals/tenants/${id}`)
    if (!proxy.success) return NextResponse.json({ error: proxy.error || 'Failed to fetch tenant from Buildium' }, { status: 502 })
    const tenant = proxy.data
    logger.info('Buildium tenant fetched successfully')
    return NextResponse.json({ success: true, data: tenant })
  } catch (e) {
    logger.error('Error fetching Buildium tenant')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    await requireRole('platform_admin')

    const { id } = await params
    const body = await request.json()
    const validated = sanitizeAndValidate(body, BuildiumTenantUpdateSchema)

    const prox = await buildiumEdgeClient.proxyRaw('PUT', `/rentals/tenants/${id}`, undefined, validated)
    if (!prox.success) return NextResponse.json({ error: prox.error || 'Failed to update tenant in Buildium' }, { status: 502 })
    const tenant = prox.data
    logger.info('Buildium tenant updated successfully')
    return NextResponse.json({ success: true, data: tenant })
  } catch (e) {
    logger.error('Error updating Buildium tenant')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
