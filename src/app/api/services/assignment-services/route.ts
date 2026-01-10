import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { supabaseAdmin } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { Database } from '@/types/database';

function parseNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

type BillingFrequency = Database['public']['Enums']['billing_frequency_enum'];

const BILLING_FREQUENCIES: BillingFrequency[] = [
  'Annual',
  'Monthly',
  'monthly',
  'annually',
  'one_time',
  'per_event',
  'per_job',
  'quarterly',
];

function normalizeFrequency(value: unknown): BillingFrequency | null {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).toLowerCase();
  const match = BILLING_FREQUENCIES.find((freq) => freq.toLowerCase() === normalized);
  return match ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const { supabase, user, roles } = auth;

    const canRead =
      hasPermission(roles, 'settings.read') ||
      hasPermission(roles, 'settings.write') ||
      hasPermission(roles, 'properties.read');
    if (!canRead) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignmentId');
    if (!assignmentId) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'assignmentId is required' } },
        { status: 400 },
      );
    }

    const orgId = await resolveOrgIdFromRequest(request, user.id, supabase);
    const db = supabaseAdmin ?? supabase;

    const { data: assignment, error: assignmentError } = await db
      .from('service_plan_assignments')
      .select('id')
      .eq('org_id', orgId)
      .eq('id', assignmentId)
      .maybeSingle();

    if (assignmentError) {
      logger.error(
        { error: assignmentError, userId: user.id, orgId, assignmentId },
        'Error loading assignment',
      );
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to load assignment' } },
        { status: 500 },
      );
    }
    if (!assignment) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Assignment not found' } },
        { status: 404 },
      );
    }

    const { data, error } = await db
      .from('service_offering_assignments')
      .select(
        'id, assignment_id, offering_id, is_active, override_amount, override_frequency, amount, frequency',
      )
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error({ error, userId: user.id, orgId, assignmentId }, 'Error fetching assignment services');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to load assignment services' } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    logger.error({ error }, 'Error in GET /api/services/assignment-services');
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const { user, roles } = auth;

    if (!hasPermission(roles, 'settings.write')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const orgId = await resolveOrgIdFromRequest(request, user.id, supabaseAdmin);
    const body = await request.json().catch(() => ({}));
    const assignmentId = body?.assignment_id ? String(body.assignment_id) : null;
    const offeringId = body?.offering_id ? String(body.offering_id) : null;

    if (!assignmentId || !offeringId) {
      return NextResponse.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'assignment_id and offering_id are required',
          },
        },
        { status: 400 },
      );
    }

    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('service_plan_assignments')
      .select('id')
      .eq('org_id', orgId)
      .eq('id', assignmentId)
      .maybeSingle();

    if (assignmentError) {
      logger.error(
        { error: assignmentError, userId: user.id, orgId, assignmentId },
        'Error loading assignment',
      );
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to load assignment' } },
        { status: 500 },
      );
    }
    if (!assignment) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Assignment not found' } },
        { status: 404 },
      );
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('service_offering_assignments')
      .select('id, is_active, override_amount, override_frequency, amount, frequency')
      .eq('assignment_id', assignmentId)
      .eq('offering_id', offeringId)
      .maybeSingle();

    if (existingError) {
      logger.error(
        { error: existingError, userId: user.id, orgId, assignmentId, offeringId },
        'Error loading offering assignment',
      );
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to load service assignment' } },
        { status: 500 },
      );
    }

    const update: Database['public']['Tables']['service_offering_assignments']['Update'] = {
      updated_at: new Date().toISOString(),
    };
    if (body.is_active !== undefined) update.is_active = Boolean(body.is_active);
    if (body.override_amount !== undefined) update.override_amount = Boolean(body.override_amount);
    if (body.override_frequency !== undefined)
      update.override_frequency = Boolean(body.override_frequency);
    if (body.amount !== undefined) update.amount = parseNumber(body.amount);
    if (body.frequency !== undefined) update.frequency = normalizeFrequency(body.frequency);

    const hasAnyUpdates = Object.keys(update).length > 1;
    if (!hasAnyUpdates) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'No fields to update' } },
        { status: 400 },
      );
    }

    if (existing?.id) {
      const { error: updateError } = await supabaseAdmin
        .from('service_offering_assignments')
        .update(update)
        .eq('assignment_id', assignmentId)
        .eq('offering_id', offeringId);

      if (updateError) {
        logger.error(
          { error: updateError, userId: user.id, orgId, assignmentId, offeringId, update },
          'Error updating offering assignment',
        );
        return NextResponse.json(
          { error: { code: 'QUERY_ERROR', message: 'Failed to update service assignment' } },
          { status: 500 },
        );
      }

      return NextResponse.json({ success: true });
    }

    const insert: Database['public']['Tables']['service_offering_assignments']['Insert'] = {
      assignment_id: assignmentId,
      offering_id: offeringId,
      is_active: update.is_active ?? true,
      override_amount: update.override_amount ?? false,
      override_frequency: update.override_frequency ?? false,
      amount: update.amount ?? null,
      frequency: update.frequency ?? null,
      updated_at: update.updated_at,
    };

    const { error: insertError } = await supabaseAdmin
      .from('service_offering_assignments')
      .insert(insert);

    if (insertError) {
      logger.error(
        { error: insertError, userId: user.id, orgId, assignmentId, offeringId, insert },
        'Error inserting offering assignment',
      );
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to update service assignment' } },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error in PATCH /api/services/assignment-services');
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 },
        );
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json(
          { error: { code: 'ORG_CONTEXT_REQUIRED', message: 'Organization context required' } },
          { status: 400 },
        );
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json(
          { error: { code: 'ORG_FORBIDDEN', message: 'Forbidden: organization access denied' } },
          { status: 403 },
        );
      }
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const { user, roles } = auth;

    if (!hasPermission(roles, 'settings.write')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const orgId = await resolveOrgIdFromRequest(request, user.id, supabaseAdmin);
    const body = await request.json().catch(() => ({}));
    const assignmentId = body?.assignment_id ? String(body.assignment_id) : null;
    const services = Array.isArray(body?.services) ? (body.services as any[]) : null;

    if (!assignmentId || !services) {
      return NextResponse.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'assignment_id and services[] are required',
          },
        },
        { status: 400 },
      );
    }

    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('service_plan_assignments')
      .select('id')
      .eq('org_id', orgId)
      .eq('id', assignmentId)
      .maybeSingle();

    if (assignmentError) {
      logger.error(
        { error: assignmentError, userId: user.id, orgId, assignmentId },
        'Error loading assignment',
      );
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to load assignment' } },
        { status: 500 },
      );
    }

    if (!assignment) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Assignment not found' } },
        { status: 404 },
      );
    }

    type NormalizedServiceRow = {
      offering_id: string;
      is_active?: boolean;
      override_amount: boolean;
      override_frequency: boolean;
      amount: number | null;
      frequency: BillingFrequency | null;
    };

    const normalized = services
      .map<NormalizedServiceRow | null>((row) => {
        const offeringId = row?.offering_id ? String(row.offering_id) : null;
        if (!offeringId) return null;

        return {
          offering_id: offeringId,
          is_active: row?.is_active === undefined ? undefined : Boolean(row.is_active),
          override_amount: Boolean(row?.override_amount ?? row?.override ?? false),
          override_frequency: Boolean(row?.override_frequency ?? row?.override ?? false),
          amount: parseNumber(row?.amount),
          frequency: normalizeFrequency(row?.frequency),
        };
      })
      .filter((row): row is NormalizedServiceRow => Boolean(row));

    const desiredOfferingIds = Array.from(new Set(normalized.map((r) => r.offering_id as string)));

    // Delete removed selections
    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from('service_offering_assignments')
      .select('offering_id')
      .eq('assignment_id', assignmentId);

    if (existingError) {
      logger.error(
        { error: existingError, userId: user.id, orgId, assignmentId },
        'Error loading existing assignment services',
      );
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to update assignment services' } },
        { status: 500 },
      );
    }

    const existingOfferingIds = new Set((existingRows || []).map((r: any) => String(r.offering_id)));
    const toDelete = Array.from(existingOfferingIds).filter((id) => !desiredOfferingIds.includes(id));
    if (toDelete.length) {
      const { error: deleteError } = await supabaseAdmin
        .from('service_offering_assignments')
        .delete()
        .eq('assignment_id', assignmentId)
        .in('offering_id', toDelete);

      if (deleteError) {
        logger.error(
          { error: deleteError, userId: user.id, orgId, assignmentId, toDelete },
          'Error deleting assignment services',
        );
        return NextResponse.json(
          { error: { code: 'QUERY_ERROR', message: 'Failed to update assignment services' } },
          { status: 500 },
        );
      }
    }

    const upsertRows: Database['public']['Tables']['service_offering_assignments']['Insert'][] =
      normalized.map((row) => {
        const useOverride = row.override_amount || row.override_frequency;
        const payload: Database['public']['Tables']['service_offering_assignments']['Insert'] = {
          assignment_id: assignmentId,
          offering_id: row.offering_id,
          is_active: row.is_active ?? true,
          override_amount: Boolean(row.override_amount),
          override_frequency: Boolean(row.override_frequency),
          amount: useOverride ? row.amount : null,
          frequency: useOverride ? row.frequency ?? null : null,
          updated_at: new Date().toISOString(),
        };
        return payload;
      });

    if (upsertRows.length) {
      const { error: upsertError } = await supabaseAdmin
        .from('service_offering_assignments')
        .upsert(upsertRows, { onConflict: 'assignment_id,offering_id' });

      if (upsertError) {
        logger.error(
          { error: upsertError, userId: user.id, orgId, assignmentId },
          'Error upserting assignment services',
        );
        return NextResponse.json(
          { error: { code: 'QUERY_ERROR', message: 'Failed to update assignment services' } },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error in PUT /api/services/assignment-services');
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 },
        );
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json(
          { error: { code: 'ORG_CONTEXT_REQUIRED', message: 'Organization context required' } },
          { status: 400 },
        );
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json(
          { error: { code: 'ORG_FORBIDDEN', message: 'Forbidden: organization access denied' } },
          { status: 403 },
        );
      }
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
