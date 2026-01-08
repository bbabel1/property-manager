import { NextResponse } from 'next/server';
import { z } from 'zod';
import { RentCycleEnumDb } from '@/schemas/lease-api';
import { getServerSupabaseClient } from '@/lib/supabase-client';

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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const idRaw = (await params).id;
  const recurringId = Number(idRaw);
  if (!idRaw || Number.isNaN(recurringId)) {
    return NextResponse.json({ error: 'Recurring transaction ID is required' }, { status: 400 });
  }

  const body = await request.json().catch(() => undefined);
  const parsed = RecurringUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues?.[0]?.message ?? 'Invalid recurring transaction payload';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = getServerSupabaseClient('recurring-transactions:update');
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
    .eq('id', recurringId)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to update recurring transaction' },
      { status: 500 },
    );
  }

  return NextResponse.json({ data }, { status: 200 });
}
