import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { buildiumSync } from '@/lib/buildium-sync';
import { resolveResourceOrg, requireOrgMember } from '@/lib/auth/org-guards';

function sanitizeUnitUpdate(body: Record<string, unknown>) {
  const allowedKeys = new Set([
    'unit_number',
    'description',
    'status',
    'unit_bedrooms',
    'unit_bathrooms',
    'unit_size',
    'market_rent',
    'address_line1',
    'address_line2',
    'city',
    'state',
    'postal_code',
    'country',
  ]);
  const numericKeys = new Set(['unit_size', 'market_rent']);
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!allowedKeys.has(key)) continue;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed.length) {
        patch[key] = null;
      } else if (numericKeys.has(key)) {
        const num = Number(trimmed);
        if (!Number.isFinite(num)) continue;
        patch[key] = num;
      } else {
        patch[key] = trimmed;
      }
    } else {
      if (value == null) {
        patch[key] = null;
      } else if (numericKeys.has(key)) {
        const num = Number(value);
        if (!Number.isFinite(num)) continue;
        patch[key] = num;
      } else {
        patch[key] = value;
      }
    }
  }
  return patch;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase: db, user } = await requireAuth();
    const { id: unitId } = await params;
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const resolvedOrg = await resolveResourceOrg(db, 'unit', unitId);
    if (!resolvedOrg.ok) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }
    await requireOrgMember({ client: db, userId: user.id, orgId: resolvedOrg.orgId });

    const updatePatch = sanitizeUnitUpdate(payload);
    if (!Object.keys(updatePatch).length) {
      return NextResponse.json({ error: 'No changes supplied' }, { status: 400 });
    }
    updatePatch.updated_at = new Date().toISOString();

    const { data: updatedUnit, error: updateErr } = await db
      .from('units')
      .update(updatePatch)
      .eq('id', unitId)
      .eq('org_id', resolvedOrg.orgId)
      .select('*')
      .single();
    if (updateErr) {
      console.error('Units API: failed to update unit', updateErr);
      return NextResponse.json(
        { error: 'Failed to update unit', details: updateErr.message },
        { status: 500 },
      );
    }

    let buildiumSyncError: string | null = null;
    let buildiumSyncedId: number | null = null;
    try {
      const { data: prop } = await db
        .from('properties')
        .select('buildium_property_id')
        .eq('id', updatedUnit.property_id)
        .eq('org_id', resolvedOrg.orgId)
        .maybeSingle();
      if (prop?.buildium_property_id) {
        const syncResult = await buildiumSync.syncUnitToBuildium({
          ...updatedUnit,
          buildium_property_id: prop.buildium_property_id,
        });
        if (!syncResult.success) {
          buildiumSyncError = syncResult.error || 'Failed to sync unit to Buildium';
        } else {
          buildiumSyncedId = syncResult.buildiumId ?? null;
        }
      } else {
        console.warn('Units API: skipping Buildium sync (missing buildium_property_id)');
      }
    } catch (syncErr) {
      buildiumSyncError =
        syncErr instanceof Error ? syncErr.message : 'Unknown Buildium sync error';
      console.error('Units API: Buildium sync failure', syncErr);
    }

    return NextResponse.json(
      {
        unit: updatedUnit,
        buildium_unit_id: buildiumSyncedId ?? updatedUnit.buildium_unit_id ?? null,
        buildium_sync_error: buildiumSyncError || undefined,
      },
      { status: buildiumSyncError ? 422 : 200 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
      }
    }
    console.error('Units API: unexpected error updating unit', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase: db, user } = await requireAuth();
    const { id: unitId } = await params;
    const resolvedOrg = await resolveResourceOrg(db, 'unit', unitId);
    if (!resolvedOrg.ok) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }
    await requireOrgMember({ client: db, userId: user.id, orgId: resolvedOrg.orgId });

    const { data: unitRow, error } = await db
      .from('units')
      .select('*, properties:property_id(org_id)')
      .eq('id', unitId)
      .eq('org_id', resolvedOrg.orgId)
      .maybeSingle();
    if (error || !unitRow) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const { properties, ...unitPayload } = unitRow as any;
    return NextResponse.json(unitPayload);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
      }
    }
    console.error('Units API: unexpected error fetching unit', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
