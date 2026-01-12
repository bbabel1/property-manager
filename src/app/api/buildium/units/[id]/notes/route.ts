import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumUnitNoteCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http';
import UnitService from '@/lib/unit-service';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard';

type BuildiumUnitNote = Parameters<typeof UnitService.persistNotes>[1][number];

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

    // Require platform admin
    const { supabase, user } = await requireRole('platform_admin');
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    const { id } = await params;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');

    // Build query parameters for Buildium API
    const queryParams: Record<string, string> = {};
    if (limit) queryParams.limit = limit;
    if (offset) queryParams.offset = offset;
    if (orderby) queryParams.orderby = orderby;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', `/rentals/units/${id}/notes`, queryParams, undefined, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium unit notes fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch unit notes from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const rawNotes = (response.json ?? null) as any;
    const notesPayload = Array.isArray(rawNotes?.data) ? rawNotes.data : rawNotes;
    const notes: BuildiumUnitNote[] = Array.isArray(notesPayload) ? notesPayload : [];
    const persist = ['1','true','yes'].includes((searchParams.get('persist')||'').toLowerCase());
    if (persist) {
      let orgId: string | null = null;
      try {
        orgId = await resolveOrgIdFromRequest(request, user.id, supabase);
      } catch (error) {
        logger.error({ error });
        return NextResponse.json({ error: 'Organization context required for persist' }, { status: 400 });
      }
      try { await UnitService.persistNotes(Number(id), notes, orgId) } catch {}
    }

    logger.info(`Buildium unit notes fetched successfully`);

    return NextResponse.json({
      success: true,
      data: notes,
      count: notes.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium unit notes`);

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

    // Require platform admin
    const { supabase, user } = await requireRole('platform_admin');
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId: guardOrgId } = guard;

    const { id } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumUnitNoteCreateSchema) as any;

    // Make request to Buildium API
    const response = await buildiumFetch('POST', `/rentals/units/${id}/notes`, undefined, validatedData, guardOrgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium unit note creation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to create unit note in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const rawNote = (response.json ?? null) as any;
    const notePayload = rawNote && typeof rawNote === 'object' && 'data' in rawNote ? (rawNote as any).data : rawNote;
    const note = (notePayload as BuildiumUnitNote | null | undefined) ?? null;
    let orgId: string | null = null;
    try {
      orgId = await resolveOrgIdFromRequest(request, user.id, supabase);
    } catch (error) {
      logger.error({ error });
      return NextResponse.json({ error: 'Organization context required for persist' }, { status: 400 });
    }
    if (note) {
      try { await UnitService.persistNotes(Number(id), [note], orgId) } catch {}
    }

    logger.info(`Buildium unit note created successfully`);

    return NextResponse.json({
      success: true,
      data: note,
    }, { status: 201 });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error creating Buildium unit note`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
