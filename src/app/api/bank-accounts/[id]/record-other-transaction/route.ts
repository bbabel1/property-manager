import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';

const parseAmount = (value: string) => {
  const sanitized = value.replace(/[^\d.-]/g, '');
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const PayloadSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('transfer'),
    date: z.string().min(1),
    propertyId: z.string().optional(),
    unitId: z.string().optional(),
    fromBankAccountId: z.string().min(1),
    toBankAccountId: z.string().min(1),
    amount: z.string().min(1),
    memo: z.string().max(2000).optional(),
  }),
  z.object({
    mode: z.literal('deposit'),
    date: z.string().min(1),
    propertyId: z.string().optional(),
    unitId: z.string().optional(),
    bankAccountId: z.string().min(1),
    glAccountId: z.string().min(1),
    amount: z.string().min(1),
    memo: z.string().max(2000).optional(),
  }),
  z.object({
    mode: z.literal('withdrawal'),
    date: z.string().min(1),
    propertyId: z.string().optional(),
    unitId: z.string().optional(),
    bankAccountId: z.string().min(1),
    glAccountId: z.string().min(1),
    amount: z.string().min(1),
    memo: z.string().max(2000).optional(),
  }),
]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('platform_admin');
    const { id: pageBankAccountId } = await params;

    const body = await request.json().catch(() => null);
    const parsed = PayloadSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues?.[0];
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: issue?.message ?? 'Invalid request' } },
        { status: 400 },
      );
    }

    const nowIso = new Date().toISOString();
    const data = parsed.data;

    if (data.mode === 'transfer') {
      const amount = parseAmount(data.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Amount must be greater than zero.' } },
          { status: 400 },
        );
      }
      if (data.fromBankAccountId === data.toBankAccountId) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Transfer from and transfer to must be different bank accounts.',
            },
          },
          { status: 400 },
        );
      }

      const { data: fromAccount } = await supabaseAdmin
        .from('gl_accounts')
        .select('id, org_id')
        .eq('id', data.fromBankAccountId)
        .eq('is_bank_account', true)
        .maybeSingle();
      if (!fromAccount) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Transfer-from bank account not found.' } },
          { status: 404 },
        );
      }

      // NOTE: This creates a single balanced transaction (credit from, debit to).
      // It will be visible in the "from" bank register (bank_gl_account_id is fromBankAccountId).
      const { data: tx, error: txErr } = await supabaseAdmin
        .from('transactions')
        .insert({
          date: data.date,
          memo: data.memo ?? null,
          total_amount: amount,
          transaction_type: 'Other',
          status: 'Paid',
          org_id: (fromAccount as any).org_id ?? null,
          bank_gl_account_id: data.fromBankAccountId,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select('id')
        .maybeSingle();
      if (txErr || !tx?.id) throw txErr ?? new Error('Failed to create transfer');

      const lines = [
        {
          transaction_id: tx.id,
          gl_account_id: data.fromBankAccountId,
          amount,
          posting_type: 'Credit',
          memo: data.memo ?? null,
          account_entity_type: data.propertyId ? 'Rental' : 'Company',
          account_entity_id: null,
          date: data.date,
          property_id: data.propertyId ?? null,
          unit_id: data.unitId ?? null,
          created_at: nowIso,
          updated_at: nowIso,
        },
        {
          transaction_id: tx.id,
          gl_account_id: data.toBankAccountId,
          amount,
          posting_type: 'Debit',
          memo: data.memo ?? null,
          account_entity_type: data.propertyId ? 'Rental' : 'Company',
          account_entity_id: null,
          date: data.date,
          property_id: data.propertyId ?? null,
          unit_id: data.unitId ?? null,
          created_at: nowIso,
          updated_at: nowIso,
        },
      ];
      const { error: lineErr } = await supabaseAdmin.from('transaction_lines').insert(lines);
      if (lineErr) throw lineErr;

      return NextResponse.json({ data: { transactionId: String(tx.id) } }, { status: 201 });
    }

    // Deposit / Withdrawal
    const amount = parseAmount(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Amount must be greater than zero.' } },
        { status: 400 },
      );
    }

    const bankId = data.bankAccountId || pageBankAccountId;
    const { data: bankAccount } = await supabaseAdmin
      .from('gl_accounts')
      .select('id, org_id')
      .eq('id', bankId)
      .eq('is_bank_account', true)
      .maybeSingle();
    if (!bankAccount) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Bank account not found.' } },
        { status: 404 },
      );
    }

    const transactionType = data.mode === 'deposit' ? 'Deposit' : 'Other';
    const { data: tx, error: txErr } = await supabaseAdmin
      .from('transactions')
      .insert({
        date: data.date,
        memo: data.memo ?? null,
        total_amount: amount,
        transaction_type: transactionType,
        status: 'Paid',
        org_id: (bankAccount as any).org_id ?? null,
        bank_gl_account_id: bankId,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('id')
      .maybeSingle();
    if (txErr || !tx?.id) throw txErr ?? new Error('Failed to create transaction');

    const bankPostingType = data.mode === 'deposit' ? 'Debit' : 'Credit';
    const otherPostingType = data.mode === 'deposit' ? 'Credit' : 'Debit';

    const lines = [
      {
        transaction_id: tx.id,
        gl_account_id: bankId,
        amount,
        posting_type: bankPostingType,
        memo: data.memo ?? null,
        account_entity_type: data.propertyId ? 'Rental' : 'Company',
        account_entity_id: null,
        date: data.date,
        property_id: data.propertyId ?? null,
        unit_id: data.unitId ?? null,
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        transaction_id: tx.id,
        gl_account_id: data.glAccountId,
        amount,
        posting_type: otherPostingType,
        memo: data.memo ?? null,
        account_entity_type: data.propertyId ? 'Rental' : 'Company',
        account_entity_id: null,
        date: data.date,
        property_id: data.propertyId ?? null,
        unit_id: data.unitId ?? null,
        created_at: nowIso,
        updated_at: nowIso,
      },
    ];
    const { error: lineErr } = await supabaseAdmin.from('transaction_lines').insert(lines);
    if (lineErr) throw lineErr;

    return NextResponse.json({ data: { transactionId: String(tx.id) } }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to record transaction',
        },
      },
      { status: 500 },
    );
  }
}


