import { notFound } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import DepositEditFormContainer from '@/components/financials/DepositEditFormContainer';
import { resolvePropertyIdentifier } from '@/lib/public-id-utils';

type BankAccount = {
  id: string;
  name: string;
  account_number?: string | null;
};

type PaymentTransaction = {
  id: string;
  date: string;
  property_name?: string | null;
  unit_number?: string | null;
  unit_name?: string | null;
  memo?: string | null;
  check_number?: string | null;
  amount: number;
};

type DepositTransactionRow = {
  id: string;
  date: string;
  memo: string | null;
  total_amount: number | null;
  transaction_type: string | null;
  bank_gl_account_id: string | null;
};

type PaymentLinkRow = {
  id: string;
  amount: number | null;
  accounting_entity_id?: string | number | null;
  accounting_unit_id?: string | number | null;
  accounting_entity_type?: string | null;
  accounting_unit_href?: string | null;
};

export default async function DepositEditPage({
  params,
}: {
  params: Promise<{ id: string; transactionId: string }>;
}) {
  const { id: slug, transactionId } = await params;
  const { internalId: propertyId, publicId: propertyPublicId } = await resolvePropertyIdentifier(slug);
  const db = await getSupabaseServerClient();

  // Fetch transaction and verify it's a Deposit
  const { data: transactionData } = await db
    .from('transactions')
    .select('id, date, memo, total_amount, transaction_type, bank_gl_account_id')
    .eq('id', transactionId)
    .maybeSingle();
  const transaction = (transactionData as DepositTransactionRow | null) ?? null;

  if (!transaction || transaction.transaction_type !== 'Deposit') {
    notFound();
  }

  // Fetch bank GL account name
  let bankAccountName: string | null = null;
  if (transaction.bank_gl_account_id) {
    const { data: bankAccountData } = await db
      .from('gl_accounts')
      .select('name')
      .eq('id', transaction.bank_gl_account_id)
      .maybeSingle();
    const bankAccount = (bankAccountData as { name: string | null } | null) ?? null;
    bankAccountName = bankAccount?.name || null;
  }

  // Fetch payment transactions linked to this deposit
  const { data: paymentTransactionsRaw } = await db
    .from('transaction_payment_transactions')
    .select(
      `
      id,
      amount,
      accounting_entity_id,
      accounting_unit_id,
      accounting_entity_type,
      accounting_unit_href
    `
    )
    .eq('transaction_id', transactionId);
  const paymentTransactions = (paymentTransactionsRaw ?? []) as PaymentLinkRow[] | null;

  // Fetch property and unit details for payments
  const { data: propertyDataRaw } = await db
    .from('properties')
    .select('id, name, org_id')
    .eq('id', propertyId)
    .maybeSingle();
  const property = (propertyDataRaw as { id: string; name: string | null; org_id: string | null } | null) ?? null;

  if (!property) {
    notFound();
  }

  // Fetch bank accounts for the dropdown
  let bankAccountsQuery = db
    .from('gl_accounts')
    .select('id, name, account_number')
    .eq('is_bank_account', true)
    .order('name');

  if (property.org_id) {
    bankAccountsQuery = bankAccountsQuery.eq('org_id', property.org_id);
  }

  const { data: bankAccountsData } = await bankAccountsQuery;
  const bankAccounts: BankAccount[] = (bankAccountsData || []).map((acc: { id: string; name: string; account_number?: string | null }) => ({
    id: acc.id,
    name: acc.name,
    account_number: acc.account_number,
  }));

  // Resolve payment transaction details
  const paymentTransactionsWithDetails: PaymentTransaction[] = [];
  if (paymentTransactions && paymentTransactions.length > 0) {
    for (const payment of paymentTransactions) {
      let propertyName: string | null = null;
      let unitNumber: string | null = null;
      let unitName: string | null = null;

      // Try to resolve unit from accounting_unit_href or accounting_unit_id
      const accountingUnitId = Number(payment.accounting_unit_id);
      if (Number.isFinite(accountingUnitId)) {
        const { data: unitData } = await db
          .from('units')
          .select('unit_number, unit_name, property_id, properties(name)')
          .eq('buildium_unit_id', accountingUnitId)
          .maybeSingle();
        const unit = (unitData as {
            unit_number: string | null;
            unit_name: string | null;
            property_id: string | null;
            properties?: { name?: string | null } | null;
          } | null) ?? null;

        if (unit) {
          unitNumber = unit.unit_number || null;
          unitName = unit.unit_name || null;
          if (unit.properties && typeof unit.properties === 'object' && 'name' in unit.properties) {
            const unitProperty = unit.properties as { name?: string | null };
            propertyName = unitProperty.name ?? null;
          }
        }
      }

      // Get memo from transaction_lines if available
      const { data: lineDataRaw } = await db
        .from('transaction_lines')
        .select('memo, reference_number')
        .eq('transaction_id', transactionId)
        .limit(1)
        .maybeSingle();
      const lineData = (lineDataRaw as { memo: string | null; reference_number: string | null } | null) ?? null;

      paymentTransactionsWithDetails.push({
        id: payment.id,
        date: transaction.date || '',
        property_name: propertyName || property.name || null,
        unit_number: unitNumber,
        unit_name: unitName,
        memo: lineData?.memo || null,
        check_number: lineData?.reference_number || null,
        amount: Number(payment.amount || 0),
      });
    }
  }

  const depositData = {
    id: transactionId,
    date: transaction.date || '',
    memo: transaction.memo || null,
    total_amount: Number(transaction.total_amount || 0),
    bank_gl_account_id: transaction.bank_gl_account_id || null,
    bank_account_name: bankAccountName,
    payment_transactions: paymentTransactionsWithDetails,
  };

  const returnHref = `/properties/${slug}/financials`;

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/30 p-4">
      <DepositEditFormContainer
        deposit={depositData}
        bankAccounts={bankAccounts}
        propertyId={propertyId}
        propertyPublicId={propertyPublicId}
        returnHref={returnHref}
      />
    </div>
  );
}
