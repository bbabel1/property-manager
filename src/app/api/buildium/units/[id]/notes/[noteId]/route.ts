import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumUnitNoteUpdateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http';
import UnitService from '@/lib/unit-service';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';

type BuildiumUnitNotePayload = Parameters<typeof UnitService.persistNotes>[1][number];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; noteId: string }> }) {
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

    const { id, noteId } = await params;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', `/rentals/units/${id}/notes/${noteId}`, undefined, undefined, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium unit note fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch unit note from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const note = (response.json ?? {}) as BuildiumUnitNotePayload;
    let orgId: string | null = null;
    try {
      orgId = await resolveOrgIdFromRequest(request, user.id, supabase);
    } catch {
      return NextResponse.json({ error: 'Organization context required for persist' }, { status: 400 });
    }
    try { await UnitService.persistNotes(Number(id), [note], orgId) } catch {}

    logger.info(`Buildium unit note fetched successfully`);

    return NextResponse.json({
      success: true,
      data: note,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium unit note`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; noteId: string }> }) {
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

    const { id, noteId } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumUnitNoteUpdateSchema);

    // Make request to Buildium API
    const response = await buildiumFetch('PUT', `/rentals/units/${id}/notes/${noteId}`, undefined, validatedData, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium unit note update failed`);

      return NextResponse.json(
        { 
          error: 'Failed to update unit note in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const note = (response.json ?? {}) as BuildiumUnitNotePayload;
    let orgId: string | null = null;
    try {
      orgId = await resolveOrgIdFromRequest(request, user.id, supabase);
    } catch {
      return NextResponse.json({ error: 'Organization context required for persist' }, { status: 400 });
    }
    try { await UnitService.persistNotes(Number(id), [note], orgId) } catch {}

    logger.info(`Buildium unit note updated successfully`);

    return NextResponse.json({
      success: true,
      data: note,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error updating Buildium unit note`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
