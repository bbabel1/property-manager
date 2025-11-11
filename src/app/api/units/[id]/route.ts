import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { supabase, supabaseAdmin } from '@/lib/db';
import { buildiumSync } from '@/lib/buildium-sync';

const ADMIN_ROLE_SET = new Set(['org_admin', 'org_manager', 'platform_admin']);

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

async function ensureOrgAccess(
  userId: string,
  orgId: string | null,
  db: typeof supabase | typeof supabaseAdmin,
) {
  if (!orgId) return true;
  const { data: membership } = await db
    .from('org_memberships')
    .select('role')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle();
  return Boolean(membership && ADMIN_ROLE_SET.has(String(membership.role)));
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(request);
    const unitId = params.id;
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const db = supabaseAdmin || supabase;

    const { data: unitRow, error: unitErr } = await db
      .from('units')
      .select('id, property_id')
      .eq('id', unitId)
      .maybeSingle();
    if (unitErr || !unitRow) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const { data: propertyRow, error: propertyErr } = await db
      .from('properties')
      .select('org_id')
      .eq('id', unitRow.property_id)
      .maybeSingle();
    if (propertyErr) {
      console.error('Units API: failed to load property context', propertyErr);
      return NextResponse.json({ error: 'Failed to update unit' }, { status: 500 });
    }

    const orgId = propertyRow?.org_id ?? null;
    const authorized = await ensureOrgAccess(user.id, orgId, db);
    if (!authorized) {
      return NextResponse.json({ error: 'Not authorized to manage this unit' }, { status: 403 });
    }

    const updatePatch = sanitizeUnitUpdate(payload);
    if (!Object.keys(updatePatch).length) {
      return NextResponse.json({ error: 'No changes supplied' }, { status: 400 });
    }
    updatePatch.updated_at = new Date().toISOString();

    const { data: updatedUnit, error: updateErr } = await db
      .from('units')
      .update(updatePatch)
      .eq('id', unitId)
      .select('*')
      .single();
    if (updateErr) {
      console.error('Units API: failed to update unit', updateErr);
      return NextResponse.json(
        { error: 'Failed to update unit', details: updateErr.message },
        { status: 500 },
      );
    }

    try {
      const { data: prop } = await db
        .from('properties')
        .select('buildium_property_id')
        .eq('id', updatedUnit.property_id)
        .maybeSingle();
      if (prop?.buildium_property_id) {
        await buildiumSync.syncUnitToBuildium({
          ...updatedUnit,
          buildium_property_id: prop.buildium_property_id,
        });
      } else {
        console.warn('Units API: skipping Buildium sync (missing buildium_property_id)');
      }
    } catch (syncErr) {
      console.error('Units API: non-fatal Buildium sync failure', syncErr);
    }

    return NextResponse.json(updatedUnit);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('Units API: unexpected error updating unit', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(request);
    const unitId = params.id;
    const db = supabaseAdmin || supabase;

    const { data: unitRow, error } = await db
      .from('units')
      .select('*, properties:property_id(org_id)')
      .eq('id', unitId)
      .maybeSingle();
    if (error || !unitRow) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const orgId = (unitRow as any)?.properties?.org_id ?? null;
    const authorized = await ensureOrgAccess(user.id, orgId, db);
    if (!authorized) {
      return NextResponse.json({ error: 'Not authorized to view this unit' }, { status: 403 });
    }

    const { properties, ...unitPayload } = unitRow as any;
    return NextResponse.json(unitPayload);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('Units API: unexpected error fetching unit', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
