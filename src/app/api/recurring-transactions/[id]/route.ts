import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { RentCycleEnumDb } from '@/schemas/lease-api';
import { requireAuth } from '@/lib/auth/guards';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { requireOrgMember } from '@/lib/auth/org-guards';

const RecurringUpdateSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  memo: z.string().nullable().optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().nullable().optional(),
  frequency: RentCycleEnumDb,
  posting_day: z.coerce.number().int().min(1).max(31).nullable().optional(),
  posting_days_in_advance: z.coerce.number().int().nullable().optional(),
  gl_account_id: z.string().nullable().optional(),
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const idRaw = (await params).id;
  if (!idRaw || typeof idRaw !== 'string') {
    return NextResponse.json({ error: 'Recurring transaction ID is required' }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => undefined);
    const parsed = RecurringUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues?.[0]?.message ?? 'Invalid recurring transaction payload';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { supabase, user } = await requireAuth();
    const orgId = await resolveOrgIdFromRequest(request, user.id, supabase);
    await requireOrgMember({ client: supabase, userId: user.id, orgId });

    const { data: recurring } = await supabase
      .from('recurring_transactions')
      .select('id, lease_id')
      .eq('id', idRaw)
      .maybeSingle();
    if (!recurring?.lease_id) {
      return NextResponse.json({ error: 'Recurring transaction not found' }, { status: 404 });
    }

    const { data: lease } = await supabase
      .from('lease')
      .select('id, org_id')
      .eq('id', recurring.lease_id)
      .eq('org_id', orgId)
      .maybeSingle();
    if (!lease) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const now = new Date().toISOString();
    const payload = parsed.data;

    const { data, error } = await supabase
      .from('recurring_transactions')
      .update({
        amount: payload.amount,
        memo: payload.memo ?? null,
        start_date: payload.start_date,
        end_date: payload.end_date ?? null,
        frequency: payload.frequency,
        posting_day: payload.posting_day ?? null,
        posting_days_in_advance: payload.posting_days_in_advance ?? null,
        gl_account_id: payload.gl_account_id ?? null,
        updated_at: now,
      })
      .eq('id', idRaw)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to update recurring transaction' },
        { status: 500 },
      );
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (error.message === 'ORG_CONTEXT_REQUIRED') return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
      if (error.message === 'ORG_FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to update recurring transaction' }, { status: 500 });
  }
}
