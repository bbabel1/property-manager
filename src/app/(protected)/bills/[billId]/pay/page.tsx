import { notFound } from 'next/navigation';

import PayBillModal from '@/components/bills/PayBillModal';
import { supabase, supabaseAdmin } from '@/lib/db';
import type { Database } from '@/types/database';

type TransactionRow = Database['public']['Tables']['transactions']['Row'];

type TransactionLineWithProperty = Database['public']['Tables']['transaction_lines']['Row'] & {
  properties?:
    | {
        id?: string | null;
        name?: string | null;
        operating_bank_gl_account_id?: string | null;
        org_id?: string | null;
      }[]
    | null;
};

type BankAccountSummaryRow = {
  id: string;
  name: string | null;
  bank_account_number: string | null;
  buildium_gl_account_id: number | string | null;
  is_active: boolean | null;
  org_id: string | null;
};

type VendorWithContact = {
  id: string;
  contacts?: {
    display_name?: string | null;
    company_name?: string | null;
  } | null;
};

export default async function PayBillPage({ params }: { params: Promise<{ billId: string }> }) {
  const { billId } = await params;
  const BillDetailsPage = (await import('../page')).default;

  const db = supabaseAdmin || supabase;
  if (!db) {
    throw new Error('Database client is unavailable');
  }

  const billRes = await db
    .from('transactions')
    .select(
      `
        id,
        org_id,
        total_amount,
        memo,
        reference_number,
        date,
        due_date,
        buildium_bill_id,
        vendor_id,
        transaction_type
      `,
    )
    .eq('id', billId)
    .maybeSingle();

  if (billRes?.error) {
    console.error('Failed to load bill for payment', billRes.error);
  }

  const bill = billRes?.data as TransactionRow | null;
  if (!bill || bill.transaction_type !== 'Bill') {
    notFound();
  }

  let vendorName = 'Vendor';
  if (bill.vendor_id) {
    const vendorRes = await db
      .from('vendors')
      .select('id, contacts(display_name, company_name)')
      .eq('id', bill.vendor_id)
      .maybeSingle();

    if (vendorRes?.error) {
      console.error('Failed to load vendor for bill payment', vendorRes.error);
    }

    const vendor = vendorRes?.data as VendorWithContact | null;

    const vendorContact = vendor && typeof vendor.contacts === 'object' ? vendor.contacts : null;
    vendorName =
      (vendorContact?.display_name as string | undefined) ||
      (vendorContact?.company_name as string | undefined) ||
      'Vendor';
  }

  const linesRes = await db
    .from('transaction_lines')
    .select(
      `
        id,
        amount,
        posting_type,
        property_id,
        properties!inner (
          id,
          name,
          operating_bank_gl_account_id,
          org_id
        )
      `,
    )
    .eq('transaction_id', billId);

  if (linesRes?.error) {
    console.error('Failed to load bill line items for payment', linesRes.error);
  }

  const lines = Array.isArray(linesRes?.data)
    ? (linesRes.data as unknown as TransactionLineWithProperty[])
    : [];

  const propertyTotals = new Map<string, number>();
  const propertyMeta = new Map<
    string,
    {
      id: string;
      name: string;
      operatingBankAccountId: string | null;
      orgId: string | null;
    }
  >();
  let lineDebitTotal = 0;

  for (const line of lines) {
    const propertyId = typeof line?.property_id === 'string' ? line.property_id : null;
    if (!propertyId) continue;

    const amount = Number(line?.amount ?? 0);
    const postingType = String(line?.posting_type || '').toLowerCase();
    const debitAmount = postingType === 'credit' ? 0 : Math.abs(amount);
    if (debitAmount > 0) {
      propertyTotals.set(propertyId, (propertyTotals.get(propertyId) ?? 0) + debitAmount);
      lineDebitTotal += debitAmount;
    }

    if (!propertyMeta.has(propertyId)) {
      const properties = line?.properties as
        | {
            id?: string | null;
            name?: string | null;
            operating_bank_gl_account_id?: string | null;
            org_id?: string | null;
          }[]
        | null
        | undefined;

      const property = properties?.[0]; // Get the first (and should be only) property

      propertyMeta.set(propertyId, {
        id: propertyId,
        name: property?.name ?? 'Property',
        operatingBankAccountId: property?.operating_bank_gl_account_id ?? null,
        orgId: property?.org_id ?? null,
      });
    }
  }

  const primaryPropertyId =
    [...propertyTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    [...propertyMeta.keys()][0] ??
    null;
  const primaryProperty = primaryPropertyId ? (propertyMeta.get(primaryPropertyId) ?? null) : null;
  const orgId = primaryProperty?.orgId ?? bill.org_id ?? null;

  let bankAccountsRaw: BankAccountSummaryRow[] = [];
  if (orgId) {
    const bankAccountsRes = await db
      .from('gl_accounts')
      .select('id, name, bank_account_number, buildium_gl_account_id, is_active, org_id')
      .eq('org_id', orgId)
      .eq('is_bank_account', true)
      .order('name', { ascending: true });

    if (bankAccountsRes?.error) {
      console.error('Failed to load bank accounts for payment', bankAccountsRes.error);
    }

    bankAccountsRaw = Array.isArray(bankAccountsRes?.data)
      ? (bankAccountsRes.data as BankAccountSummaryRow[])
      : [];
  }

  const buildiumBillId =
    typeof bill.buildium_bill_id === 'number' ? bill.buildium_bill_id : null;
  const paymentsRes =
    buildiumBillId !== null
      ? await db
          .from('transactions')
          .select('id, total_amount, payment_method, paid_date, date, buildium_bill_id')
          .eq('transaction_type', 'Payment')
          .eq('buildium_bill_id', buildiumBillId)
      : null;
  if (paymentsRes?.error) {
    console.error('Failed to load bill payments for payment modal', paymentsRes.error);
  }

  const payments = Array.isArray(paymentsRes?.data) ? paymentsRes.data : [];
  const paymentIds = payments.map((p) => p.id).filter(Boolean);
  let paymentLineSums = new Map<string, number>();
  if (paymentIds.length) {
    const { data: paymentLines, error: payLineErr } = await db
      .from('transaction_lines')
      .select('transaction_id, posting_type, amount')
      .in('transaction_id', paymentIds);
    if (payLineErr) {
      console.error('Failed to load payment lines for bill payment modal', payLineErr);
    } else if (paymentLines) {
      paymentLineSums = paymentLines.reduce((map, line) => {
        const amt = Number(line?.amount ?? 0);
        const isDebit = String(line?.posting_type || '').toLowerCase() === 'debit';
        const add = isDebit ? Math.abs(amt) : 0;
        const key = line?.transaction_id as string;
        map.set(key, (map.get(key) ?? 0) + add);
        return map;
      }, new Map<string, number>());
    }
  }

  const paymentsTotal = payments.reduce((sum, p) => {
    const displayAmount = Number(p.total_amount ?? 0) || paymentLineSums.get(p.id) || 0;
    return sum + (Number.isFinite(displayAmount) ? Math.abs(displayAmount) : 0);
  }, 0);

  const billAmount = Number(bill.total_amount ?? 0) || 0;
  const billDueAmount = billAmount > 0 ? billAmount : lineDebitTotal;
  const billRemainingAmount = Math.max(billDueAmount - paymentsTotal, 0);

  // Ensure the property's operating bank account is present, even if it's inactive or not flagged as a bank account
  const operatingBankAccountId = primaryProperty?.operatingBankAccountId ?? null;
  if (
    operatingBankAccountId &&
    !bankAccountsRaw.some((row) => String(row.id) === String(operatingBankAccountId))
  ) {
    const { data: fallbackBank, error: fallbackErr } = await db
      .from('gl_accounts')
      .select('id, name, bank_account_number, buildium_gl_account_id, is_active, org_id')
      .eq('id', operatingBankAccountId)
      .maybeSingle();

    if (fallbackErr) {
      console.error('Failed to load operating bank account fallback for bill payment', fallbackErr);
    } else if (fallbackBank) {
      bankAccountsRaw.unshift(fallbackBank as BankAccountSummaryRow);
    }
  }

  const bankAccounts = bankAccountsRaw.map((row) => {
    const accountNumber =
      typeof row.bank_account_number === 'string' ? row.bank_account_number : null;
    const lastFour =
      accountNumber && accountNumber.length > 4 ? accountNumber.slice(-4) : accountNumber;
    const masked = lastFour ? `••••${lastFour}` : null;
    const rawBuildiumId = (row as any).buildium_gl_account_id ?? null;
    return {
      id: String(row.id),
      name: String(row.name ?? 'Bank account'),
      maskedAccountNumber: masked,
      buildiumBankAccountId:
        typeof rawBuildiumId === 'number' && Number.isFinite(rawBuildiumId)
          ? rawBuildiumId
          : typeof rawBuildiumId === 'string' && Number.isFinite(Number(rawBuildiumId))
            ? Number(rawBuildiumId)
            : null,
      isActive: Boolean(row.is_active ?? true),
    };
  });

  const payBillFormBill = {
    id: String(bill.id),
    buildiumBillId: buildiumBillId,
    totalAmount: billDueAmount,
    remainingAmount: billRemainingAmount,
    vendorName,
    dueDate: bill.due_date ?? null,
    date: bill.date ?? '',
    memo: bill.memo ?? null,
    referenceNumber: bill.reference_number ?? null,
    propertyName: primaryProperty?.name ?? null,
  };

  return (
    <>
      <BillDetailsPage params={Promise.resolve({ billId })} />
      <PayBillModal
        bill={payBillFormBill}
        bankAccounts={bankAccounts}
        defaultBankAccountId={
          operatingBankAccountId ? String(operatingBankAccountId) : null
        }
      />
    </>
  );
}
