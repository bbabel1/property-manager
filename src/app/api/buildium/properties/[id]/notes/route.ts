import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumPropertyNoteCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { supabaseAdmin } from '@/lib/db';

const TABLE = 'property_notes'

function mapRowToBuildiumNote(row: any) {
  return {
    Id: row?.id ?? null,
    Subject: row?.subject ?? null,
    Body: row?.body ?? null,
    CreatedDate: row?.created_at ?? null,
    CreatedByName: row?.created_by_name ?? null,
    IsPrivate: Boolean(row?.is_private ?? false),
  }
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

async function resolveLocalPropertyId(propertyRef: string) {
  const client = supabaseAdmin as any
  if (!propertyRef) return null

  if (looksLikeUuid(propertyRef)) {
    const { data } = await client
      .from('properties')
      .select('id')
      .eq('id', propertyRef)
      .maybeSingle()
    if (data?.id) return data.id
  }

  const numericId = Number(propertyRef)
  if (!Number.isNaN(numericId)) {
    const { data } = await client
      .from('properties')
      .select('id')
      .eq('buildium_property_id', numericId)
      .maybeSingle()
    if (data?.id) return data.id
  }

  return null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Require authentication
    await requireUser(request);

    const { id } = await params;

    const propertyId = await resolveLocalPropertyId(id)
    if (!propertyId) {
      logger.warn({ buildiumPropertyId: id }, 'No local property found for property notes request')
      return NextResponse.json({ success: true, data: [], count: 0 })
    }

    const { searchParams } = new URL(request.url)
    const limitRaw = Number(searchParams.get('limit') ?? '50')
    const offsetRaw = Number(searchParams.get('offset') ?? '0')
    const orderbyRaw = (searchParams.get('orderby') || '').toLowerCase()
    const limit = Number.isNaN(limitRaw) ? 50 : Math.min(Math.max(limitRaw, 1), 100)
    const offset = Number.isNaN(offsetRaw) ? 0 : Math.max(offsetRaw, 0)
    const ascending = orderbyRaw.includes('asc') && !orderbyRaw.includes('desc')
    const start = offset
    const end = offset + (limit > 0 ? limit - 1 : 0)

    const client = supabaseAdmin as any
    const { data, error } = await client
      .from(TABLE)
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending })
      .range(start, end)
    if (error) {
      logger.error({ error, propertyId }, 'Failed to load property notes from database')
      return NextResponse.json({ error: 'Failed to load property notes' }, { status: 500 })
    }

    const list = Array.isArray(data) ? data.map(mapRowToBuildiumNote) : []

    logger.info({ propertyId, source: 'database', count: list.length }, 'Property notes fetched successfully')

    return NextResponse.json({ success: true, data: list, count: list.length })

  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    logger.error({ error }, 'Error fetching Buildium property notes');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Require authentication
    await requireUser(request);

    const { id } = await params;

    const propertyId = await resolveLocalPropertyId(id)
    if (!propertyId) {
      logger.warn({ buildiumPropertyId: id }, 'Cannot create property note; property not found locally')
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumPropertyNoteCreateSchema);

    const client = supabaseAdmin as any
    const { data, error } = await client
      .from(TABLE)
      .insert({
        property_id: propertyId,
        subject: validatedData.Subject,
        body: validatedData.Body,
        is_private: validatedData.IsPrivate ?? false,
        created_by: user.id,
        created_by_name: user.email ?? user.user_metadata?.full_name ?? 'Unknown',
      })
      .select()
      .single()

    if (error) {
      logger.error({ error, propertyId, userId: user.id }, 'Failed to create property note in database')
      return NextResponse.json({ error: 'Failed to create property note' }, { status: 500 })
    }

    logger.info({ propertyId, userId: user.id }, 'Property note created successfully')

    return NextResponse.json({ success: true, data: mapRowToBuildiumNote(data) }, { status: 201 })

  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    logger.error({ error }, 'Error creating Buildium property note');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
