import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumPropertyNoteCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http'
import { env } from '@/env/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const user = await requireUser();

    const { id } = params;

    if (!env.BUILDIUM_BASE_URL || !env.BUILDIUM_CLIENT_ID || !env.BUILDIUM_CLIENT_SECRET) {
      logger.warn('Buildium credentials missing; returning empty property notes list.');
      return NextResponse.json({ success: true, data: [], count: 0 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');

    // Build query parameters for Buildium API
    const queryParams = new URLSearchParams();
    if (limit) queryParams.append('limit', limit);
    if (offset) queryParams.append('offset', offset);
    if (orderby) queryParams.append('orderby', orderby);

    const prox = await buildiumFetch('GET', `/rentals/${id}/notes`, Object.fromEntries(queryParams.entries()))
    if (!prox.ok) {
      logger.error({ status: prox.status, error: prox.errorText || prox.json }, 'Buildium property notes fetch failed');

      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        warning: 'Buildium notes unavailable at the moment.'
      })
    }
    const raw = prox.json
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw?.results)
          ? raw.results
          : []

    logger.info({ propertyId: id, count: list.length }, 'Buildium property notes fetched successfully');

    return NextResponse.json({
      success: true,
      data: list,
      count: list.length,
    });

  } catch (error) {
    logger.error({ error }, 'Error fetching Buildium property notes');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const user = await requireUser();

    const { id } = params;

    if (!env.BUILDIUM_BASE_URL || !env.BUILDIUM_CLIENT_ID || !env.BUILDIUM_CLIENT_SECRET) {
      logger.warn('Buildium credentials missing; cannot create property note.');
      return NextResponse.json({ error: 'Buildium integration not configured' }, { status: 503 });
    }

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumPropertyNoteCreateSchema);

    const prox = await buildiumFetch('POST', `/rentals/${id}/notes`, undefined, validatedData)
    if (!prox.ok) {
      logger.error({ status: prox.status, error: prox.errorText || prox.json }, 'Buildium property note creation failed');

      return NextResponse.json(
        { error: 'Failed to create property note in Buildium', details: prox.errorText || prox.json },
        { status: prox.status || 502 }
      );
    }
    const note = prox.json;

    logger.info(`Buildium property note created successfully`);

    return NextResponse.json({
      success: true,
      data: note,
    }, { status: 201 });

  } catch (error) {
    logger.error({ error }, 'Error creating Buildium property note');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
