import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { createBuildiumClient, defaultBuildiumConfig } from '@/lib/buildium-client';
import type { BuildiumFileShareSettingsUpdate } from '@/types/buildium';
import { FILE_ENTITY_TYPES } from '@/lib/files';
import { z } from 'zod';

const BodySchema = z
  .object({
    shareWithTenants: z.boolean().optional(),
    shareWithRentalOwners: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.shareWithTenants !== undefined || value.shareWithRentalOwners !== undefined,
    'At least one sharing toggle must be provided',
  );

const deriveShareFlags = (
  data: BuildiumFileShareSettingsUpdate | null | undefined,
): { tenants: boolean; owners: boolean } => {
  const scope = data ?? {};
  const tenants = Boolean(
    scope?.Lease?.Tenants ??
      scope?.Rental?.Tenants ??
      scope?.Tenant?.Tenants ??
      scope?.RentalUnit?.Tenants ??
      scope?.Account?.AllResidents,
  );
  const owners = Boolean(
    scope?.Lease?.RentalOwners ??
      scope?.Rental?.RentalOwners ??
      scope?.Tenant?.RentalOwners ??
      scope?.RentalOwner?.RentalOwner ??
      scope?.RentalUnit?.RentalOwners ??
      scope?.Account?.AllRentalOwners,
  );
  return { tenants, owners };
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser(request);
    const supabase = await getSupabaseServerClient();

    const fileId = (await params).id;
    if (!fileId) {
      return NextResponse.json({ error: 'Missing file id' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'Invalid sharing payload';
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const { shareWithTenants, shareWithRentalOwners } = parsed.data;

    const { data: fileRecord, error: lookupError } = await supabase
      .from('files')
      .select('id, buildium_file_id, org_id, entity_type')
      .eq('id', fileId)
      .is('deleted_at', null)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json(
        { error: 'File lookup failed', details: lookupError.message },
        { status: 500 },
      );
    }

    if (!fileRecord) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const buildiumFileId = fileRecord.buildium_file_id;
    if (!buildiumFileId || !Number.isFinite(Number(buildiumFileId))) {
      return NextResponse.json(
        { error: 'File must be synced to Buildium before updating sharing settings' },
        { status: 400 },
      );
    }

    const entityType = fileRecord.entity_type as string | null;

    const buildiumClient = createBuildiumClient(defaultBuildiumConfig);
    const payload: BuildiumFileShareSettingsUpdate = {};

    const setScopeValue = (
      scope: keyof BuildiumFileShareSettingsUpdate,
      field: string,
      value: boolean,
    ) => {
      const current = (payload[scope] ?? {}) as Record<string, boolean | undefined>;
      payload[scope] = {
        ...current,
        [field]: value,
      } as BuildiumFileShareSettingsUpdate[typeof scope];
    };

    const applyTenantSetting = (value: boolean) => {
      switch (entityType) {
        case FILE_ENTITY_TYPES.LEASES:
          setScopeValue('Lease', 'Tenants', value);
          break;
        case FILE_ENTITY_TYPES.PROPERTIES:
          setScopeValue('Rental', 'Tenants', value);
          break;
        case FILE_ENTITY_TYPES.UNITS:
          setScopeValue('RentalUnit', 'Tenants', value);
          break;
        case FILE_ENTITY_TYPES.TENANTS:
          setScopeValue('Tenant', 'Tenants', value);
          break;
        default:
          setScopeValue('Account', 'AllResidents', value);
          break;
      }
    };

    const applyOwnerSetting = (value: boolean) => {
      switch (entityType) {
        case FILE_ENTITY_TYPES.LEASES:
          setScopeValue('Lease', 'RentalOwners', value);
          break;
        case FILE_ENTITY_TYPES.PROPERTIES:
          setScopeValue('Rental', 'RentalOwners', value);
          break;
        case FILE_ENTITY_TYPES.UNITS:
          setScopeValue('RentalUnit', 'RentalOwners', value);
          break;
        case FILE_ENTITY_TYPES.RENTAL_OWNERS:
          setScopeValue('RentalOwner', 'RentalOwner', value);
          break;
        default:
          setScopeValue('Account', 'AllRentalOwners', value);
          break;
      }
    };

    if (shareWithTenants !== undefined) {
      applyTenantSetting(shareWithTenants);
    }

    if (shareWithRentalOwners !== undefined) {
      applyOwnerSetting(shareWithRentalOwners);
    }

    await buildiumClient.updateFileSharingSettings(Number(buildiumFileId), payload);
    let latest = null;
    try {
      latest = await buildiumClient.getFileSharingSettings(Number(buildiumFileId));
    } catch (_err) {
      // Non-fatal: Buildium sometimes delays propagating sharing updates
      latest = null;
    }

    let resolvedTenants =
      shareWithTenants !== undefined ? Boolean(shareWithTenants) : false;
    let resolvedOwners =
      shareWithRentalOwners !== undefined ? Boolean(shareWithRentalOwners) : false;
    if (latest) {
      const derived = deriveShareFlags(latest);
      resolvedTenants = derived.tenants;
      resolvedOwners = derived.owners;
    }

    // Update local flag for convenience (best-effort)
    return NextResponse.json({
      success: true,
      data: {
        shareWithTenants: Boolean(resolvedTenants),
        shareWithRentalOwners: Boolean(resolvedOwners),
        raw: latest,
      },
    });
  } catch (error) {
    console.error('Error updating file sharing settings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
