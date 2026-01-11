import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { resolvePropertyIdentifier } from '@/lib/public-id-utils';
import { supabaseAdmin } from '@/lib/db';
import { resolveUndepositedFundsGlAccountId } from '@/lib/buildium-mappers';
import type { Database } from '@/types/database';

type TransactionRow = Pick<
  Database['public']['Tables']['transactions']['Row'],
  'id' | 'transaction_type' | 'property_id' | 'bank_gl_account_id'
>;
type TransactionLineRow = Pick<
  Database['public']['Tables']['transaction_lines']['Row'],
  'property_id'
>;
type TransactionLineDebitRow = Pick<
  Database['public']['Tables']['transaction_lines']['Row'],
  'id' | 'gl_account_id' | 'posting_type'
>;
type BankAccountRow = Pick<
  Database['public']['Tables']['gl_accounts']['Row'],
  'id' | 'is_bank_account'
>;
type TransactionUpdate = Database['public']['Tables']['transactions']['Update'];
type TransactionLineUpdate = Database['public']['Tables']['transaction_lines']['Update'];
type DepositPatchPayload = {
  bank_gl_account_id?: string | null;
  date?: string | null;
  memo?: string | null;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; transactionId: string }> },
) {
  try {
    const { id: slug, transactionId } = await params;
    const { internalId: propertyId } = await resolvePropertyIdentifier(slug);
    const { supabase: db, user } = await requireAuth();
    const orgId = await resolveOrgIdFromRequest(request, user.id, db);

    const { data: property, error: propertyError } = await db
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .eq('org_id', orgId)
      .maybeSingle();
    if (propertyError) {
      return NextResponse.json({ error: 'Failed to verify property' }, { status: 500 });
    }
    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // Verify transaction exists and is a Deposit
    const { data: transaction, error: txError } = await db
      .from('transactions')
      .select('id, transaction_type, property_id, bank_gl_account_id')
      .eq('id', transactionId)
      .eq('org_id', orgId)
      .maybeSingle<TransactionRow>();

    if (txError) {
      return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 });
    }

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction.transaction_type !== 'Deposit') {
      return NextResponse.json({ error: 'Transaction is not a deposit' }, { status: 400 });
    }

    // Verify property access (transaction should be linked to property via transaction_lines)
    const { data: lineData, error: lineError } = await db
      .from('transaction_lines')
      .select('property_id')
      .eq('transaction_id', transactionId)
      .eq('property_id', propertyId)
      .limit(1)
      .maybeSingle<TransactionLineRow>();

    if (lineError) {
      return NextResponse.json({ error: 'Failed to verify deposit ownership' }, { status: 500 });
    }

    if (!lineData) {
      return NextResponse.json({ error: 'Deposit not found for this property' }, { status: 404 });
    }

    const payload = ((await request.json().catch(() => ({}))) ?? {}) as DepositPatchPayload;
    const bank_gl_account_id = payload.bank_gl_account_id;
    const date = typeof payload.date === 'string' ? payload.date : undefined;
    const memo =
      typeof payload.memo === 'string' ? payload.memo : payload.memo === null ? null : undefined;

    const nowIso = new Date().toISOString();

    // Update transaction
    const updateData: TransactionUpdate = {
      updated_at: nowIso,
    };

    if (date !== undefined) {
      updateData.date = date;
    }

    if (memo !== undefined) {
      updateData.memo = memo || null;
    }

    if (bank_gl_account_id !== undefined) {
      const normalizedBankGlAccountId = bank_gl_account_id || null;
      // Verify bank GL account exists and is a bank account
      if (normalizedBankGlAccountId) {
        const { data: glAccount, error: glAccountError } = await db
          .from('gl_accounts')
          .select('id, is_bank_account')
          .eq('id', normalizedBankGlAccountId)
          .eq('org_id', orgId)
          .maybeSingle<BankAccountRow>();

        if (glAccountError) {
          return NextResponse.json({ error: 'Failed to validate bank account' }, { status: 500 });
        }

        if (!glAccount || !glAccount.is_bank_account) {
          return NextResponse.json({ error: 'Invalid bank account' }, { status: 400 });
        }
      }

      // Update bank_gl_account_id on transaction
      updateData.bank_gl_account_id = normalizedBankGlAccountId;

      // Update transaction_lines to use the new bank GL account
      // Find the bank debit line and update it
      const { data: bankLines, error: bankLinesError } = await db
        .from('transaction_lines')
        .select('id, gl_account_id, posting_type')
        .eq('transaction_id', transactionId)
        .eq('posting_type', 'Debit');

      if (bankLinesError) {
        return NextResponse.json({ error: 'Failed to load bank lines' }, { status: 500 });
      }

      const typedBankLines = (bankLines || []) as TransactionLineDebitRow[];
      if (typedBankLines.length > 0) {
        // Update the first debit line (should be the bank line)
        const bankLine = typedBankLines[0];

        if (bankLine && normalizedBankGlAccountId) {
          const bankLineUpdate: TransactionLineUpdate = {
            gl_account_id: normalizedBankGlAccountId,
            updated_at: nowIso,
          };
          const { error: bankLineUpdateError } = await (db as any)
            .from('transaction_lines')
            .update(bankLineUpdate)
            .eq('id', bankLine.id);

          if (bankLineUpdateError) {
            return NextResponse.json({ error: 'Failed to update bank line' }, { status: 500 });
          }
        }
      }
    }

    const { error: updateError } = await (db as any)
      .from('transactions')
      .update(updateData)
      .eq('id', transactionId)
      .eq('org_id', orgId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update deposit' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    console.error('Error updating deposit:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update deposit' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; transactionId: string }> },
) {
  try {
    const { id: slug, transactionId } = await params;
    const { internalId: propertyId } = await resolvePropertyIdentifier(slug);
    const { supabase: db, user } = await requireAuth();
    const orgId = await resolveOrgIdFromRequest(request, user.id, db);

    const { data: property, error: propertyError } = await db
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .eq('org_id', orgId)
      .maybeSingle();
    if (propertyError) {
      return NextResponse.json({ error: 'Failed to verify property' }, { status: 500 });
    }
    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // Verify transaction exists and is a Deposit
    const { data: transaction, error: txError } = await db
      .from('transactions')
      .select('id, transaction_type, property_id, bank_gl_account_id')
      .eq('id', transactionId)
      .eq('org_id', orgId)
      .maybeSingle<TransactionRow>();

    if (txError) {
      return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 });
    }

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction.transaction_type !== 'Deposit') {
      return NextResponse.json({ error: 'Transaction is not a deposit' }, { status: 400 });
    }

    // Verify property access
    const { data: lineData, error: lineError } = await db
      .from('transaction_lines')
      .select('property_id')
      .eq('transaction_id', transactionId)
      .eq('property_id', propertyId)
      .limit(1)
      .maybeSingle<TransactionLineRow>();

    if (lineError) {
      return NextResponse.json({ error: 'Failed to verify deposit ownership' }, { status: 500 });
    }

    if (!lineData) {
      return NextResponse.json({ error: 'Deposit not found for this property' }, { status: 404 });
    }

    // Before deleting, get the deposit transaction to find linked payments and org_id
    const { data: depositTx, error: depositError } = await supabaseAdmin
      .from('transactions')
      .select('id, org_id, bank_gl_account_id')
      .eq('id', transactionId)
      .eq('org_id', orgId)
      .maybeSingle<{ id: string; org_id: string | null; bank_gl_account_id: string | null }>();
    if (depositError) {
      return NextResponse.json({ error: 'Failed to load deposit' }, { status: 500 });
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

    // Resolve UDF before deleting to avoid stranding payments
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

    // Reclass payment transactions and their lines before removing the deposit.
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
      ] as const satisfies readonly Database['public']['Enums']['transaction_type_enum'][];

      const paymentIdSet = new Set<string>();

      if (paymentBuildiumIds.length > 0) {
        const { data: paymentTxs, error: paymentTxError } = await supabaseAdmin
          .from('transactions')
          .select('id')
          .eq('org_id', orgId)
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
          .eq('org_id', orgId)
          .in('id', paymentIds);
        if (updatePaymentsError) {
          return NextResponse.json({ error: 'Failed to reclassify payments' }, { status: 500 });
        }

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
              return NextResponse.json(
                { error: 'Failed to reclassify payment lines' },
                { status: 500 },
              );
            }
          }
        }
      }
    }

    // Delete transaction (lines will cascade). Use safe delete helper so validation triggers
    // do not block removal of legacy or unbalanced deposits.
    const { error: deleteError } = await supabaseAdmin.rpc('delete_transaction_safe', {
      p_transaction_id: transactionId,
    });

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete deposit' }, { status: 500 });
    }

    // After deletion, ensure payment transactions are properly marked as undeposited
    // This is a safeguard - payments should already be in undeposited funds since they weren't modified
    // when the deposit was created, but we verify and update if needed
    if (paymentLinks && paymentLinks.length > 0 && orgId) {
      const udfGlAccountId = await resolveUndepositedFundsGlAccountId(supabaseAdmin, orgId);
      if (udfGlAccountId) {
        // Find payment transactions that might need their bank_gl_account_id updated
        // Note: Most payments should already have bank_gl_account_id = udfGlAccountId
        // since they weren't modified when the deposit was created
        const paymentBuildiumIds = paymentLinks
          .map((p) => p?.buildium_payment_transaction_id)
          .filter((v): v is number => typeof v === 'number');

        if (paymentBuildiumIds.length > 0) {
          // Update payment transactions to ensure they're marked as undeposited
          // This is best-effort and won't fail if payments aren't found
          const { data: paymentTxs } = await supabaseAdmin
            .from('transactions')
            .select('id, bank_gl_account_id')
            .eq('org_id', orgId)
            .in('buildium_transaction_id', paymentBuildiumIds)
            .limit(100);

          if (paymentTxs) {
            const paymentsToUpdate = paymentTxs.filter(
              (tx) => tx.bank_gl_account_id !== udfGlAccountId && tx.bank_gl_account_id !== null,
            );

            if (paymentsToUpdate.length > 0) {
              const paymentIds = paymentsToUpdate.map((tx) => tx.id);
              await supabaseAdmin
                .from('transactions')
                .update({
                  bank_gl_account_id: udfGlAccountId,
                  updated_at: new Date().toISOString(),
                })
                .eq('org_id', orgId)
                .in('id', paymentIds);
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    console.error('Error deleting deposit:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete deposit' },
      { status: 500 },
    );
  }
}
