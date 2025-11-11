import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumLeaseNoteCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumEdgeClient } from '@/lib/buildium-edge-client'

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
    const user = await requireUser();

    const { id } = await params;

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

    const persist = ['1','true','yes'].includes((searchParams.get('persist')||'').toLowerCase())
    const payload: any = { leaseId: Number(id), limit, offset, orderby }
    const res = await buildiumEdgeClient.listLeaseNotes(Number(id), { limit: Number(limit), offset: Number(offset), orderby: orderby || undefined })
    if (!res.success) return NextResponse.json({ error: res.error || 'Failed to fetch lease notes from Buildium' }, { status: 502 })
    const notes = res.data || []

    logger.info(`Buildium lease notes fetched successfully`);

    return NextResponse.json({
      success: true,
      data: notes,
      count: notes.length,
    });

  } catch (error) {
    logger.error(`Error fetching Buildium lease notes`);

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
    const user = await requireUser();

    const { id } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumLeaseNoteCreateSchema);

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/leases/${id}/notes`;
    
    const response = await fetch(buildiumUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
      body: JSON.stringify(validatedData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(`Buildium lease note creation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to create lease note in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const note = await response.json();

    logger.info(`Buildium lease note created successfully`);

    return NextResponse.json({
      success: true,
      data: note,
    }, { status: 201 });

  } catch (error) {
    logger.error(`Error creating Buildium lease note`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
