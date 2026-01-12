import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { RentCycleEnumDb, RentScheduleStatusEnumDb } from '@/schemas/lease-api';
import { requireAuth } from '@/lib/auth/guards';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { requireOrgMember } from '@/lib/auth/org-guards';

const RentSchedulePayloadSchema = z.object({
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().nullable().optional(),
  rent_cycle: RentCycleEnumDb,
  total_amount: z.coerce.number().positive('Amount must be greater than 0'),
  status: RentScheduleStatusEnumDb.default('Future'),
  backdate_charges: z.boolean().optional().default(false),
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scheduleId = (await params).id;

  if (!scheduleId) {
    return NextResponse.json({ error: 'Rent schedule ID is required' }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => undefined);
    const result = RentSchedulePayloadSchema.safeParse(body);

    if (!result.success) {
      const message = result.error.issues?.[0]?.message ?? 'Invalid rent schedule payload';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const payload = result.data;
    const { supabase, user } = await requireAuth();
    const orgId = await resolveOrgIdFromRequest(request, user.id, supabase);
    await requireOrgMember({ client: supabase, userId: user.id, orgId });

    const { data: schedule } = await supabase
      .from('rent_schedules')
      .select('lease_id')
      .eq('id', scheduleId)
      .maybeSingle();
    if (!schedule?.lease_id) {
      return NextResponse.json({ error: 'Rent schedule not found' }, { status: 404 });
    }

    const { data: lease } = await supabase
      .from('lease')
      .select('id, org_id')
      .eq('id', schedule.lease_id)
      .eq('org_id', orgId)
      .maybeSingle();
    if (!lease) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('rent_schedules')
      .update({
        start_date: payload.start_date,
        end_date: payload.end_date ?? null,
        rent_cycle: payload.rent_cycle,
        total_amount: payload.total_amount,
        status: payload.status,
        backdate_charges: payload.backdate_charges ?? false,
        updated_at: now,
      })
      .eq('id', scheduleId)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to update rent schedule' }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (error.message === 'ORG_CONTEXT_REQUIRED') return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
      if (error.message === 'ORG_FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to update rent schedule' }, { status: 500 });
  }
}
