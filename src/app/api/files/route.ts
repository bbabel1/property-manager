import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import {
  getFilesByEntity,
  FILE_ENTITY_TYPES,
  normalizeEntityType,
  type EntityTypeEnum,
} from '@/lib/files';
import { requireUser } from '@/lib/auth';
import type { AuthenticatedUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = (await requireUser(request)) as AuthenticatedUser;
    const supabase = (await getSupabaseServerClient()) as any;
    const url = new URL(request.url);

    const entityTypeParam = url.searchParams.get('entityType');
    const entityIdParam = url.searchParams.get('entityId');
    const orgIdHeader = request.headers.get('x-org-id');
    const orgId = url.searchParams.get('orgId') || orgIdHeader || user?.app_metadata?.org_id;

    if (!entityTypeParam || !entityIdParam) {
      return NextResponse.json({ error: 'Missing entityType or entityId' }, { status: 400 });
    }

    // Validate entity type matches enum
    const validEntityTypes: EntityTypeEnum[] = [
      FILE_ENTITY_TYPES.PROPERTIES,
      FILE_ENTITY_TYPES.UNITS,
      FILE_ENTITY_TYPES.LEASES,
      FILE_ENTITY_TYPES.TENANTS,
      FILE_ENTITY_TYPES.RENTAL_OWNERS,
      FILE_ENTITY_TYPES.ASSOCIATIONS,
      FILE_ENTITY_TYPES.ASSOCIATION_OWNERS,
      FILE_ENTITY_TYPES.ASSOCIATION_UNITS,
      FILE_ENTITY_TYPES.OWNERSHIP_ACCOUNTS,
      FILE_ENTITY_TYPES.ACCOUNTS,
      FILE_ENTITY_TYPES.VENDORS,
    ];

    const normalizedEntityType = normalizeEntityType(entityTypeParam);

    if (!normalizedEntityType || !validEntityTypes.includes(normalizedEntityType)) {
      return NextResponse.json(
        { error: `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}` },
        { status: 400 },
      );
    }

    const entityId = Number(entityIdParam);
    if (isNaN(entityId)) {
      return NextResponse.json({ error: 'entityId must be a valid number' }, { status: 400 });
    }

    // Get org_id - either from query param or user's org
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
    }

    const files = await getFilesByEntity(supabase, orgId, normalizedEntityType, entityId);

    return NextResponse.json({
      success: true,
      data: files,
      count: files.length,
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
