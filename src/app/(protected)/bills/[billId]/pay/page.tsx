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
        operating_bank_account_id?: string | null;
        org_id?: string | null;
      }[]
    | null;
};

type BankAccountSummaryRow = Pick<
  Database['public']['Tables']['bank_accounts']['Row'],
  'id' | 'name' | 'account_number' | 'buildium_bank_id' | 'is_active' | 'org_id'
>;

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
          operating_bank_account_id,
          org_id
        )
      `,
    )
    .eq('transaction_id', billId);

  if (linesRes?.error) {
    console.error('Failed to load bill line items for payment', linesRes.error);
  }

  const lines = Array.isArray(linesRes?.data)
    ? (linesRes.data as TransactionLineWithProperty[])
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

  for (const line of lines) {
    const propertyId = typeof line?.property_id === 'string' ? line.property_id : null;
    if (!propertyId) continue;

    const amount = Number(line?.amount ?? 0);
    const postingType = String(line?.posting_type || '').toLowerCase();
    const debitAmount = postingType === 'credit' ? 0 : Math.abs(amount);
    if (debitAmount > 0) {
      propertyTotals.set(propertyId, (propertyTotals.get(propertyId) ?? 0) + debitAmount);
    }

    if (!propertyMeta.has(propertyId)) {
      const properties = line?.properties as
        | {
            id?: string | null;
            name?: string | null;
            operating_bank_account_id?: string | null;
            org_id?: string | null;
          }[]
        | null
        | undefined;

      const property = properties?.[0]; // Get the first (and should be only) property

      propertyMeta.set(propertyId, {
        id: propertyId,
        name: property?.name ?? 'Property',
        operatingBankAccountId: property?.operating_bank_account_id ?? null,
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
      .from('bank_accounts')
      .select('id, name, account_number, buildium_bank_id, is_active, org_id')
      .eq('org_id', orgId)
      .order('name', { ascending: true });

    if (bankAccountsRes?.error) {
      console.error('Failed to load bank accounts for payment', bankAccountsRes.error);
    }

    bankAccountsRaw = Array.isArray(bankAccountsRes?.data)
      ? (bankAccountsRes.data as BankAccountSummaryRow[])
      : [];
  }

  const bankAccounts = bankAccountsRaw.map((row) => {
    const accountNumber = typeof row.account_number === 'string' ? row.account_number : null;
    const lastFour =
      accountNumber && accountNumber.length > 4 ? accountNumber.slice(-4) : accountNumber;
    const masked = lastFour ? `••••${lastFour}` : null;
    return {
      id: String(row.id),
      name: String(row.name ?? 'Bank account'),
      maskedAccountNumber: masked,
      buildiumBankAccountId:
        typeof row.buildium_bank_id === 'number' && Number.isFinite(row.buildium_bank_id)
          ? row.buildium_bank_id
          : null,
      isActive: Boolean(row.is_active ?? true),
    };
  });

  const payBillFormBill = {
    id: String(bill.id),
    buildiumBillId: typeof bill.buildium_bill_id === 'number' ? bill.buildium_bill_id : null,
    totalAmount: Number(bill.total_amount ?? 0),
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
        defaultBankAccountId={primaryProperty?.operatingBankAccountId ?? null}
      />
    </>
  );
}
