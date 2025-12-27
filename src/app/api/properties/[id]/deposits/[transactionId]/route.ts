import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { resolvePropertyIdentifier } from '@/lib/public-id-utils';
import type { Database } from '@/types/database';

type TransactionRow = Pick<
  Database['public']['Tables']['transactions']['Row'],
  'id' | 'transaction_type' | 'property_id' | 'bank_gl_account_id'
>;
type TransactionLineRow = Pick<Database['public']['Tables']['transaction_lines']['Row'], 'property_id'>;
type TransactionLineDebitRow = Pick<
  Database['public']['Tables']['transaction_lines']['Row'],
  'id' | 'gl_account_id' | 'posting_type'
>;
type BankAccountRow = Pick<Database['public']['Tables']['gl_accounts']['Row'], 'id' | 'is_bank_account'>;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
  try {
    const { id: slug, transactionId } = await params;
    const { internalId: propertyId } = await resolvePropertyIdentifier(slug);
    const db = await getSupabaseServerClient();

    // Verify transaction exists and is a Deposit
    const { data: transaction, error: txError } = await db
      .from('transactions')
      .select('id, transaction_type, property_id, bank_gl_account_id')
      .eq('id', transactionId)
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

    const body = await request.json();
    const { bank_gl_account_id, date, memo } = body;

    // Update transaction
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (date !== undefined) {
      updateData.date = date;
    }

    if (memo !== undefined) {
      updateData.memo = memo || null;
    }

    if (bank_gl_account_id !== undefined) {
      // Verify bank GL account exists and is a bank account
      if (bank_gl_account_id) {
        const { data: glAccount, error: glAccountError } = await db
          .from('gl_accounts')
          .select('id, is_bank_account')
          .eq('id', bank_gl_account_id)
          .maybeSingle<BankAccountRow>();

        if (glAccountError) {
          return NextResponse.json({ error: 'Failed to validate bank account' }, { status: 500 });
        }

        if (!glAccount || !glAccount.is_bank_account) {
          return NextResponse.json({ error: 'Invalid bank account' }, { status: 400 });
        }
      }

      // Update bank_gl_account_id on transaction
      updateData.bank_gl_account_id = bank_gl_account_id || null;

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

        if (bankLine && bank_gl_account_id) {
          await db
            .from('transaction_lines')
            .update({ gl_account_id: bank_gl_account_id })
            .eq('id', bankLine.id);
        }
      }
    }

    const { error: updateError } = await db
      .from('transactions')
      .update(updateData)
      .eq('id', transactionId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update deposit' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating deposit:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update deposit' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
  try {
    const { id: slug, transactionId } = await params;
    const { internalId: propertyId } = await resolvePropertyIdentifier(slug);
    const db = await getSupabaseServerClient();

    // Verify transaction exists and is a Deposit
    const { data: transaction, error: txError } = await db
      .from('transactions')
      .select('id, transaction_type, property_id, bank_gl_account_id')
      .eq('id', transactionId)
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

    // Delete transaction (cascade will delete lines and payment_transactions)
    const { error: deleteError } = await db
      .from('transactions')
      .delete()
      .eq('id', transactionId);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete deposit' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting deposit:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete deposit' },
      { status: 500 }
    );
  }
}
