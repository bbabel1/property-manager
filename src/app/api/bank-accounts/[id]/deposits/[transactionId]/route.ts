import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import { getOrgScopedBuildiumClient } from '@/lib/buildium-client';
import { resolveUndepositedFundsGlAccountId } from '@/lib/buildium-mappers';

type TransactionRow = {
  id: string;
  transaction_type: string | null;
  bank_gl_account_id: string | null;
  date?: string | null;
  memo?: string | null;
  org_id?: string | null;
  buildium_transaction_id?: number | null;
  gl_accounts?: { buildium_gl_account_id?: number | null } | null;
};

type GlAccountRow = { id: string; is_bank_account?: boolean | null; buildium_gl_account_id?: number | null };
type TransactionLineRow = {
  id: string;
  gl_account_id: string | null;
  amount?: number | null;
  property_id?: string | null;
  unit_id?: string | null;
  posting_type?: string | null;
};
type PropertyRow = { id: string; buildium_property_id: number | null };
type UnitRow = { id: string; buildium_unit_id: number | null };

async function assertDepositInBankAccountContext(params: {
  bankAccountId: string;
  transactionId: string;
}) {
  const { bankAccountId, transactionId } = params;

  const { data: tx, error: txError } = await supabaseAdmin
    .from('transactions')
    .select('id, transaction_type, bank_gl_account_id')
    .eq('id', transactionId)
    .maybeSingle<TransactionRow>();

  if (txError) throw txError;
  if (!tx) return { ok: false as const, status: 404, message: 'Transaction not found' };
  if (tx.transaction_type !== 'Deposit') return { ok: false as const, status: 400, message: 'Transaction is not a deposit' };

  if (tx.bank_gl_account_id === bankAccountId) {
    return { ok: true as const, tx };
  }

  // fallback: ensure a bank line exists for this bank account id
  const { data: line } = await supabaseAdmin
    .from('transaction_lines')
    .select('id')
    .eq('transaction_id', transactionId)
    .eq('gl_account_id', bankAccountId)
    .limit(1)
    .maybeSingle<TransactionLineRow>();
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
          .maybeSingle<GlAccountRow>();
        if (!glAccount || glAccount.is_bank_account !== true) {
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
        .limit(20)
        .returns<TransactionLineRow[]>();

      const candidateLineId = debitLines?.[0]?.id ?? null;
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
        .maybeSingle<TransactionRow>();

      const buildiumDepositId =
        txRow && typeof txRow.buildium_transaction_id === 'number'
          ? txRow.buildium_transaction_id
          : null;
      const bankBuildiumId =
        txRow &&
        txRow.gl_accounts &&
        typeof txRow.gl_accounts.buildium_gl_account_id === 'number'
          ? txRow.gl_accounts.buildium_gl_account_id
          : null;

      if (buildiumDepositId && bankBuildiumId) {
        const orgId = txRow?.org_id ?? null;
        const udfGlAccountId = await resolveUndepositedFundsGlAccountId(supabaseAdmin, orgId);

        // PaymentTransactionIds from splits
        const { data: splits } = await supabaseAdmin
          .from('transaction_payment_transactions')
          .select('buildium_payment_transaction_id')
          .eq('transaction_id', transactionId)
          .not('buildium_payment_transaction_id', 'is', null);
        const paymentBuildiumIds = (splits || [])
          .map((s) => s?.buildium_payment_transaction_id)
          .filter((v): v is number => typeof v === 'number');

        // Other lines (credits) excluding bank + UDF
        const { data: lines } = await supabaseAdmin
          .from('transaction_lines')
          .select('gl_account_id, amount, property_id, unit_id, posting_type')
          .eq('transaction_id', transactionId)
          .eq('posting_type', 'Credit')
          .limit(100)
          .returns<TransactionLineRow[]>();

        const creditLines = (lines || []).filter((l) => {
          const glId = l?.gl_account_id;
          if (!glId) return false;
          if (glId === bankAccountId) return false;
          if (udfGlAccountId && glId === udfGlAccountId) return false;
          return true;
        });

        const glIds = Array.from(new Set(creditLines.map((l) => l.gl_account_id).filter(Boolean))).map(String);
        const propertyIds = Array.from(new Set(creditLines.map((l) => l.property_id).filter(Boolean))).map(String);
        const unitIds = Array.from(new Set(creditLines.map((l) => l.unit_id).filter(Boolean))).map(String);

        const { data: glRows } = await supabaseAdmin
          .from('gl_accounts')
          .select('id, buildium_gl_account_id')
          .in('id', glIds)
          .returns<GlAccountRow[]>();
        const glBuildiumById = new Map<string, number>();
        (glRows || []).forEach((g) => {
          if (typeof g?.buildium_gl_account_id === 'number') glBuildiumById.set(String(g.id), g.buildium_gl_account_id);
        });

        const { data: propRows } = propertyIds.length
          ? await supabaseAdmin
              .from('properties')
              .select('id, buildium_property_id')
              .in('id', propertyIds)
          : { data: [] as PropertyRow[] };
        const propertyBuildiumById = new Map<string, number>();
        (propRows || []).forEach((p) => {
          if (typeof p?.buildium_property_id === 'number')
            propertyBuildiumById.set(String(p.id), p.buildium_property_id);
        });

        const { data: unitRows } = unitIds.length
          ? await supabaseAdmin.from('units').select('id, buildium_unit_id').in('id', unitIds)
          : { data: [] as UnitRow[] };
        const unitBuildiumById = new Map<string, number>();
        (unitRows || []).forEach((u) => {
          if (typeof u?.buildium_unit_id === 'number') unitBuildiumById.set(String(u.id), u.buildium_unit_id);
        });

        const otherLines = creditLines
          .map((l) => {
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
          EntryDate: txRow?.date ?? undefined,
          Memo: txRow?.memo || undefined,
          PaymentTransactionIds: paymentBuildiumIds,
          Lines: otherLines,
        };

        const buildiumClient = await getOrgScopedBuildiumClient(orgId ?? undefined);
        await buildiumClient.makeRequest(
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

    // Before deleting, fetch deposit context and linked payment references
    const { data: depositTx, error: depositError } = await supabaseAdmin
      .from('transactions')
      .select('id, org_id, bank_gl_account_id, date')
      .eq('id', transactionId)
      .maybeSingle<TransactionRow>();
    if (depositError) {
      return NextResponse.json({ error: 'Failed to load deposit' }, { status: 500 });
    }
    if (!depositTx) {
      return NextResponse.json({ error: 'Deposit not found' }, { status: 404 });
    }

    const orgId = depositTx?.org_id ?? null;
    const depositBankAccountId = depositTx?.bank_gl_account_id ?? null;

    // Get payment transactions linked to this deposit before deletion
    const { data: paymentLinks, error: paymentLinksError } = await supabaseAdmin
      .from('transaction_payment_transactions')
      .select('buildium_payment_transaction_id')
      .eq('transaction_id', transactionId);
    if (paymentLinksError) {
      return NextResponse.json({ error: 'Failed to load linked payments' }, { status: 500 });
    }

    // Resolve UDF account before deleting; if missing, block the delete to avoid inconsistency.
    let udfGlAccountId: string | null = null;
    if (paymentLinks && paymentLinks.length > 0 && orgId) {
      udfGlAccountId = await resolveUndepositedFundsGlAccountId(supabaseAdmin, orgId);
      if (!udfGlAccountId) {
        return NextResponse.json(
          {
            error:
              'Cannot delete deposit: undeposited funds account not found. Payments cannot be reclassified.',
          },
          { status: 422 },
        );
      }
    }

    // Reclass payment transactions and their lines before removing the deposit to avoid stranding cash.
    if (paymentLinks && paymentLinks.length > 0 && udfGlAccountId) {
      const paymentBuildiumIds = paymentLinks
        .map((p) => p?.buildium_payment_transaction_id)
        .filter((v): v is number => typeof v === 'number');

      const paymentTypeFilters = [
        'Payment',
        'ElectronicFundsTransfer',
        'ApplyDeposit',
        'Refund',
        'UnreversedPayment',
        'UnreversedElectronicFundsTransfer',
        'ReverseElectronicFundsTransfer',
        'ReversePayment',
        'Check',
      ];

      const paymentIdSet = new Set<string>();

      if (paymentBuildiumIds.length > 0) {
        const { data: paymentTxs, error: paymentTxError } = await supabaseAdmin
          .from('transactions')
          .select('id')
          .in('buildium_transaction_id', paymentBuildiumIds)
          .limit(1000);
        if (paymentTxError) {
          return NextResponse.json({ error: 'Failed to load linked payments' }, { status: 500 });
        }
        (paymentTxs || []).forEach((tx) => paymentIdSet.add(tx.id));
      }

      // Fallback for local-only payments (no Buildium ids): grab payments on this bank account in this org.
      if (paymentIdSet.size === 0 && depositBankAccountId && orgId) {
        const { data: fallbackPayments, error: fallbackError } = await supabaseAdmin
          .from('transactions')
          .select('id')
          .eq('org_id', orgId)
          .eq('bank_gl_account_id', depositBankAccountId)
          .in('transaction_type', paymentTypeFilters)
          .limit(1000);
        if (fallbackError) {
          return NextResponse.json({ error: 'Failed to load fallback payments' }, { status: 500 });
        }
        (fallbackPayments || []).forEach((tx) => paymentIdSet.add(tx.id));
      }

      const paymentIds = Array.from(paymentIdSet);

      if (paymentIds.length > 0) {
        const nowIso = new Date().toISOString();
        const { error: updatePaymentsError } = await supabaseAdmin
          .from('transactions')
          .update({ bank_gl_account_id: udfGlAccountId, updated_at: nowIso })
          .in('id', paymentIds);
        if (updatePaymentsError) {
          return NextResponse.json({ error: 'Failed to reclassify payments' }, { status: 500 });
        }

        // Reclass any payment transaction lines that still point at the deposit bank account.
        if (depositBankAccountId) {
          const { data: bankLines, error: bankLinesError } = await supabaseAdmin
            .from('transaction_lines')
            .select('id')
            .in('transaction_id', paymentIds)
            .eq('gl_account_id', depositBankAccountId)
            .limit(5000);
          if (bankLinesError) {
            return NextResponse.json({ error: 'Failed to load payment lines' }, { status: 500 });
          }
          if (bankLines && bankLines.length > 0) {
            const lineIds = bankLines.map((l) => l.id).filter(Boolean);
            const { error: updateLinesError } = await supabaseAdmin
              .from('transaction_lines')
              .update({ gl_account_id: udfGlAccountId, updated_at: nowIso })
              .in('id', lineIds);
            if (updateLinesError) {
              return NextResponse.json({ error: 'Failed to reclassify payment lines' }, { status: 500 });
            }
          }
        }
      }
    }

    // Delete the deposit transaction (lines will cascade via FK). Use the safe helper to
    // temporarily disable balance validation triggers so legacy/unbalanced deposits can be removed.
    const { error: deleteError } = await supabaseAdmin.rpc('delete_transaction_safe', {
      p_transaction_id: transactionId,
    });
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
