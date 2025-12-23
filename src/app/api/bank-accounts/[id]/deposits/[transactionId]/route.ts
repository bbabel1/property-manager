import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import { getOrgScopedBuildiumClient } from '@/lib/buildium-client';
import { resolveUndepositedFundsGlAccountId } from '@/lib/buildium-mappers';

async function assertDepositInBankAccountContext(params: {
  bankAccountId: string;
  transactionId: string;
}) {
  const { bankAccountId, transactionId } = params;

  const { data: tx, error: txError } = await supabaseAdmin
    .from('transactions')
    .select('id, transaction_type, bank_gl_account_id')
    .eq('id', transactionId)
    .maybeSingle();

  if (txError) throw txError;
  if (!tx) return { ok: false as const, status: 404, message: 'Transaction not found' };
  if ((tx as any).transaction_type !== 'Deposit')
    return { ok: false as const, status: 400, message: 'Transaction is not a deposit' };

  if ((tx as any).bank_gl_account_id === bankAccountId) {
    return { ok: true as const, tx };
  }

  // fallback: ensure a bank line exists for this bank account id
  const { data: line } = await supabaseAdmin
    .from('transaction_lines')
    .select('id')
    .eq('transaction_id', transactionId)
    .eq('gl_account_id', bankAccountId)
    .limit(1)
    .maybeSingle();
  if (!line) return { ok: false as const, status: 404, message: 'Deposit not found for this bank account' };

  return { ok: true as const, tx };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; transactionId: string }> },
) {
  try {
    await requireRole('platform_admin');
    const { id: bankAccountId, transactionId } = await params;

    const membership = await assertDepositInBankAccountContext({ bankAccountId, transactionId });
    if (!membership.ok) {
      return NextResponse.json({ error: membership.message }, { status: membership.status });
    }

    const body = await request.json().catch(() => ({}));
    const { bank_gl_account_id, date, memo } = body as {
      bank_gl_account_id?: string | null;
      date?: string;
      memo?: string | null;
    };

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (date !== undefined) updateData.date = date;
    if (memo !== undefined) updateData.memo = memo || null;

    if (bank_gl_account_id !== undefined) {
      if (bank_gl_account_id) {
        const { data: glAccount } = await supabaseAdmin
          .from('gl_accounts')
          .select('id, is_bank_account')
          .eq('id', bank_gl_account_id)
          .maybeSingle();
        if (!glAccount || !(glAccount as any).is_bank_account) {
          return NextResponse.json({ error: 'Invalid bank account' }, { status: 400 });
        }
      }

      updateData.bank_gl_account_id = bank_gl_account_id || null;

      // Update the bank debit line to point at the new bank account.
      const { data: debitLines } = await supabaseAdmin
        .from('transaction_lines')
        .select('id')
        .eq('transaction_id', transactionId)
        .eq('posting_type', 'Debit')
        .limit(20);

      const candidateLineId = (debitLines as any[])?.[0]?.id ?? null;
      if (candidateLineId && bank_gl_account_id) {
        await supabaseAdmin
          .from('transaction_lines')
          .update({ gl_account_id: bank_gl_account_id, updated_at: new Date().toISOString() })
          .eq('id', candidateLineId);
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update(updateData)
      .eq('id', transactionId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update deposit' }, { status: 500 });
    }

    // Best-effort sync to Buildium if this deposit is already linked.
    try {
      const { data: txRow } = await supabaseAdmin
        .from('transactions')
        .select(
          `
          id,
          date,
          memo,
          org_id,
          bank_gl_account_id,
          buildium_transaction_id,
          gl_accounts!transactions_bank_gl_account_id_fkey(buildium_gl_account_id)
        `,
        )
        .eq('id', transactionId)
        .maybeSingle();

      const buildiumDepositId =
        txRow && typeof (txRow as any).buildium_transaction_id === 'number'
          ? (txRow as any).buildium_transaction_id
          : null;
      const bankBuildiumId =
        txRow &&
        (txRow as any).gl_accounts &&
        typeof (txRow as any).gl_accounts.buildium_gl_account_id === 'number'
          ? (txRow as any).gl_accounts.buildium_gl_account_id
          : null;

      if (buildiumDepositId && bankBuildiumId) {
        const orgId = (txRow as any)?.org_id ?? null;
        const udfGlAccountId = await resolveUndepositedFundsGlAccountId(supabaseAdmin as any, orgId);

        // PaymentTransactionIds from splits
        const { data: splits } = await supabaseAdmin
          .from('transaction_payment_transactions')
          .select('buildium_payment_transaction_id')
          .eq('transaction_id', transactionId)
          .not('buildium_payment_transaction_id', 'is', null);
        const paymentBuildiumIds = (splits || [])
          .map((s: any) => s?.buildium_payment_transaction_id)
          .filter((v: any): v is number => typeof v === 'number');

        // Other lines (credits) excluding bank + UDF
        const { data: lines } = await supabaseAdmin
          .from('transaction_lines')
          .select('gl_account_id, amount, property_id, unit_id, posting_type')
          .eq('transaction_id', transactionId)
          .eq('posting_type', 'Credit')
          .limit(100);

        const creditLines = (lines || []).filter((l: any) => {
          const glId = l?.gl_account_id;
          if (!glId) return false;
          if (glId === bankAccountId) return false;
          if (udfGlAccountId && glId === udfGlAccountId) return false;
          return true;
        });

        const glIds = Array.from(new Set(creditLines.map((l: any) => l?.gl_account_id).filter(Boolean))).map(String);
        const propertyIds = Array.from(new Set(creditLines.map((l: any) => l?.property_id).filter(Boolean))).map(String);
        const unitIds = Array.from(new Set(creditLines.map((l: any) => l?.unit_id).filter(Boolean))).map(String);

        const { data: glRows } = await supabaseAdmin
          .from('gl_accounts')
          .select('id, buildium_gl_account_id')
          .in('id', glIds);
        const glBuildiumById = new Map<string, number>();
        (glRows || []).forEach((g: any) => {
          if (typeof g?.buildium_gl_account_id === 'number') glBuildiumById.set(String(g.id), g.buildium_gl_account_id);
        });

        const { data: propRows } = propertyIds.length
          ? await supabaseAdmin
              .from('properties')
              .select('id, buildium_property_id')
              .in('id', propertyIds)
          : { data: [] as any[] };
        const propertyBuildiumById = new Map<string, number>();
        (propRows || []).forEach((p: any) => {
          if (typeof p?.buildium_property_id === 'number')
            propertyBuildiumById.set(String(p.id), p.buildium_property_id);
        });

        const { data: unitRows } = unitIds.length
          ? await supabaseAdmin.from('units').select('id, buildium_unit_id').in('id', unitIds)
          : { data: [] as any[] };
        const unitBuildiumById = new Map<string, number>();
        (unitRows || []).forEach((u: any) => {
          if (typeof u?.buildium_unit_id === 'number') unitBuildiumById.set(String(u.id), u.buildium_unit_id);
        });

        const otherLines = creditLines
          .map((l: any) => {
            const glBuildiumId = glBuildiumById.get(String(l.gl_account_id));
            if (typeof glBuildiumId !== 'number') return null;
            const buildiumPropertyId = l?.property_id ? propertyBuildiumById.get(String(l.property_id)) : undefined;
            const buildiumUnitId = l?.unit_id ? unitBuildiumById.get(String(l.unit_id)) : undefined;
            const accountingEntity =
              typeof buildiumPropertyId === 'number'
                ? {
                    Id: buildiumPropertyId,
                    AccountingEntityType: 'Rental',
                    UnitId: typeof buildiumUnitId === 'number' ? buildiumUnitId : undefined,
                  }
                : null;
            const amount = Number(l?.amount ?? 0);
            return {
              GLAccountId: glBuildiumId,
              AccountingEntity: accountingEntity ?? undefined,
              Amount: amount,
            };
          })
          .filter(Boolean);

        const buildiumPayload: Record<string, unknown> = {
          EntryDate: (txRow as any)?.date ?? undefined,
          Memo: (txRow as any)?.memo || undefined,
          PaymentTransactionIds: paymentBuildiumIds,
          Lines: otherLines,
        };

        const buildiumClient = await getOrgScopedBuildiumClient(orgId ?? undefined);
        await buildiumClient.makeRequest<any>(
          'PUT',
          `/bankaccounts/${bankBuildiumId}/deposits/${buildiumDepositId}`,
          buildiumPayload,
        );
      }
    } catch (err) {
      console.error('Failed to sync deposit update to Buildium', err);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update deposit' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; transactionId: string }> },
) {
  try {
    await requireRole('platform_admin');
    const { id: bankAccountId, transactionId } = await params;

    const membership = await assertDepositInBankAccountContext({ bankAccountId, transactionId });
    if (!membership.ok) {
      return NextResponse.json({ error: membership.message }, { status: membership.status });
    }

    const { error: deleteError } = await supabaseAdmin.from('transactions').delete().eq('id', transactionId);
    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete deposit' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete deposit' },
      { status: 500 },
    );
  }
}
