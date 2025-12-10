import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { FILE_ENTITY_TYPES, normalizeEntityType, type EntityTypeEnum } from '@/lib/files';

/**
 * POST /api/files/attach
 *
 * Updates a file's entity association.
 * Note: In the new schema, files are directly associated with entities via entity_type/entity_id.
 * This endpoint updates those fields on an existing file.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const supabase = await getSupabaseServerClient();

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { fileId, entityType, entityId } = body as {
      fileId: string;
      entityType: string;
      entityId: number;
    };

    if (!fileId || !entityType || entityId === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: fileId, entityType, entityId' },
        { status: 400 },
      );
    }

    // Validate entity type
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

    const normalizedEntityType = normalizeEntityType(entityType);

    if (!normalizedEntityType || !validEntityTypes.includes(normalizedEntityType)) {
      return NextResponse.json(
        { error: `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}` },
        { status: 400 },
      );
    }

    // Get the file to verify it exists and get org_id
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('org_id')
      .eq('id', fileId)
      .is('deleted_at', null)
      .single();

    if (fileError || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Update the file's entity association
    // Note: In the new schema, we update entity_type and entity_id directly
    const { data: updatedFile, error: updateError } = await supabase
      .from('files')
      .update({
        entity_type: normalizedEntityType,
        entity_id: entityId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', fileId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update file association', details: updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: updatedFile,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error attaching file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
