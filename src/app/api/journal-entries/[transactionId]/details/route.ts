import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> },
) {
  try {
    await requireUser(request);
    const { transactionId } = await params;
    const db =
      process.env.NODE_ENV === 'development' ? supabaseAdmin : await getSupabaseServerClient();

    // Fetch transaction
    const { data: transaction } = await db
      .from('transactions')
      .select('id, date, memo, total_amount, transaction_type, org_id, monthly_log_id')
      .eq('id', transactionId)
      .maybeSingle();

    if (!transaction || transaction.transaction_type !== 'GeneralJournalEntry') {
      return NextResponse.json(
        { error: 'Transaction not found or is not a general journal entry' },
        { status: 404 },
      );
    }

    // Derive property context
    let propertyId: string | null = null;
    if (transaction.monthly_log_id) {
      const { data: monthlyLog } = await db
        .from('monthly_logs')
        .select('property_id')
        .eq('id', transaction.monthly_log_id)
        .maybeSingle();
      propertyId = monthlyLog?.property_id ?? null;
    }

    // Fetch transaction lines with related data, scoping to property when available to satisfy RLS
    let lineQuery = db
      .from('transaction_lines')
      .select(
        `
        id,
        property_id,
        posting_type,
        amount,
        memo,
        gl_account_id,
        unit_id,
        gl_accounts(name, account_number),
        units(unit_number, unit_name)
      `,
      )
      .eq('transaction_id', transactionId)
      .order('posting_type', { ascending: false })
      .order('created_at', { ascending: true });

    if (propertyId) {
      lineQuery = lineQuery.eq('property_id', propertyId);
    }

    const { data: lineRows } = await lineQuery;

    const safeLineRows: LineRow[] = Array.isArray(lineRows) ? (lineRows as LineRow[]) : [];

    if (!propertyId && safeLineRows.length) {
      propertyId = safeLineRows.find((line) => line?.property_id)?.property_id ?? null;
    }

    let property: { id: string; name: string | null; org_id: string | null } | null = null;
    if (propertyId) {
      const { data: propertyRow } = await db
        .from('properties')
        .select('id, name, org_id')
        .eq('id', propertyId)
        .maybeSingle();
      property = propertyRow ?? null;
    }

    type UnitRow = { id: string; unit_number: string | null; unit_name: string | null };
    let unitRows: UnitRow[] = [];
    if (propertyId) {
      const { data: units } = await db
        .from('units')
        .select('id, unit_number, unit_name')
        .eq('property_id', propertyId)
        .order('unit_number', { ascending: true });
      unitRows = Array.isArray(units) ? (units as UnitRow[]) : [];
    }

    const orgId = property?.org_id ?? (transaction.org_id ? String(transaction.org_id) : null);
    type AccountRow = { id: string; name: string | null; account_number: string | null; type: string | null };
    let accountsRows: AccountRow[] = [];
    if (orgId) {
      const { data: accounts } = await db
        .from('gl_accounts')
        .select('id, name, account_number, type')
        .eq('org_id', orgId)
        .order('type')
        .order('name');
      accountsRows = Array.isArray(accounts) ? (accounts as AccountRow[]) : [];
    }

    if (!accountsRows.length) {
      const { data: fallbackAccounts } = await db
        .from('gl_accounts')
        .select('id, name, account_number, type')
        .order('type')
        .order('name');
      accountsRows = Array.isArray(fallbackAccounts)
        ? (fallbackAccounts as AccountRow[])
        : [];
    }

    return NextResponse.json({
      transaction: {
        id: transaction.id,
        date: transaction.date,
        memo: transaction.memo,
        transaction_type: transaction.transaction_type,
      },
      lines: safeLineRows,
      property,
      units: unitRows,
      accounts: accountsRows,
    });
  } catch (error) {
    console.error('Error fetching journal entry details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch journal entry details' },
      { status: 500 },
    );
  }
}

