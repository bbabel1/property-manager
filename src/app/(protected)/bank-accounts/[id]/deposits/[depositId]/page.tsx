import { supabase, supabaseAdmin } from '@/lib/db';
import { PageBody, PageHeader, PageShell } from '@/components/layout/page-shell';
import InfoCard from '@/components/layout/InfoCard';
import EditDepositForm from '@/components/bank-accounts/EditDepositForm';
import type { DepositStatus } from '@/types/deposits';

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

export default async function BankAccountDepositEditPage({
  params,
}: {
  params: Promise<{ id: string; depositId: string }>;
}) {
  const { id: bankAccountId, depositId } = await params;
  const db = supabaseAdmin || supabase;
  const renderError = (message: string) => (
    <PageShell>
      <PageHeader title="Edit deposit" />
      <PageBody>
        <InfoCard title="Edit deposit">
          <p className="text-sm text-red-600">{message}</p>
        </InfoCard>
      </PageBody>
    </PageShell>
  );

  if (!db) {
    return renderError('Database client is unavailable.');
  }

  const { data: depositLookup } = await (db as any)
    .from('deposit_meta')
    .select('transaction_id')
    .eq('deposit_id', depositId)
    .maybeSingle();

  const transactionId = depositLookup?.transaction_id ?? depositId;

  // Fetch transaction and verify it's a Deposit
  const { data: transaction } = await db
    .from('transactions')
    .select('id, date, memo, total_amount, transaction_type, bank_gl_account_id, org_id')
    .eq('id', transactionId)
    .maybeSingle();

  if (!transaction || transaction.transaction_type !== 'Deposit') {
    return renderError('Deposit transaction not found.');
  }

  // Verify this deposit belongs to this bank account context
  if (transaction.bank_gl_account_id !== bankAccountId) {
    // fallback: check if it has any bank line tied to this bank account id (bank register view may resolve)
    const { data: bankLine } = await db
      .from('transaction_lines')
      .select('id')
      .eq('transaction_id', transactionId)
      .eq('gl_account_id', bankAccountId)
      .limit(1)
      .maybeSingle();
    if (!bankLine) return renderError('Deposit not found for this bank account.');
  }

  // Fetch bank GL account name
  let bankAccountName: string | null = null;
  if (transaction.bank_gl_account_id) {
    const { data: bankAccount } = await db
      .from('gl_accounts')
      .select('name')
      .eq('id', transaction.bank_gl_account_id)
      .maybeSingle();
    bankAccountName = bankAccount?.name || null;
  }

  // Fetch payment transactions linked to this deposit
  const { data: paymentTransactions } = await db
    .from('transaction_payment_transactions')
    .select(
      `
      id,
      amount,
      accounting_entity_id,
      accounting_unit_id,
      accounting_entity_type,
      accounting_unit_href,
      buildium_payment_transaction_id
    `,
    )
    .eq('transaction_id', transactionId);

  // Fetch bank accounts for the dropdown (org-scoped if possible)
  let bankAccountsQuery = db
    .from('gl_accounts')
    .select('id, name, account_number')
    .eq('is_bank_account', true)
    .order('name');

  if (transaction.org_id) {
    bankAccountsQuery = bankAccountsQuery.eq('org_id', transaction.org_id);
  }

  const { data: bankAccountsData } = await bankAccountsQuery;
  const bankAccounts: BankAccount[] = (bankAccountsData || []).map((acc) => ({
    id: acc.id,
    name: acc.name,
    account_number: acc.account_number,
  }));

  // Preload property/unit labels from Buildium IDs (accounting_entity_id/accounting_unit_id)
  const buildiumPropertyIds = Array.from(
    new Set(
      (paymentTransactions || [])
        .map((p) => p.accounting_entity_id)
        .filter((id): id is number => typeof id === 'number'),
    ),
  );
  const buildiumUnitIds = Array.from(
    new Set(
      (paymentTransactions || [])
        .map((p) => p.accounting_unit_id)
        .filter((id): id is number => typeof id === 'number'),
    ),
  );

  const propertyLabelByBuildiumId = new Map<number, string>();
  if (buildiumPropertyIds.length > 0) {
    const { data: buildiumProps } = await db
      .from('properties')
      .select('name, address_line1, buildium_property_id')
      .in('buildium_property_id', buildiumPropertyIds);
    (buildiumProps || []).forEach(
      (p: {
        name?: string | null;
        address_line1?: string | null;
        buildium_property_id?: number | null;
      }) => {
        if (typeof p.buildium_property_id === 'number') {
          const label = `${p.name || 'Property'}${p.address_line1 ? ` • ${p.address_line1}` : ''}`;
          propertyLabelByBuildiumId.set(p.buildium_property_id, label);
        }
      },
    );
  }

  const unitLabelByBuildiumId = new Map<
    number,
    { unitNumber: string | null; unitName: string | null; propertyLabel?: string | null }
  >();
  if (buildiumUnitIds.length > 0) {
    const { data: buildiumUnits } = await db
      .from('units')
      .select(
        'unit_number, unit_name, buildium_unit_id, properties(name, address_line1, buildium_property_id)',
      )
      .in('buildium_unit_id', buildiumUnitIds);
    (buildiumUnits || []).forEach((u) => {
      const unitRecord = u as {
        unit_number?: string | null;
        unit_name?: string | null;
        buildium_unit_id?: number | null;
        properties?: {
          name?: string | null;
          address_line1?: string | null;
          buildium_property_id?: number | null;
        } | null;
      };
      if (typeof unitRecord.buildium_unit_id === 'number') {
        const propertyLabel =
          unitRecord.properties && typeof unitRecord.properties === 'object'
            ? `${unitRecord.properties.name || 'Property'}${
                unitRecord.properties.address_line1
                  ? ` • ${unitRecord.properties.address_line1}`
                  : ''
              }`
            : null;
        unitLabelByBuildiumId.set(unitRecord.buildium_unit_id, {
          unitNumber: unitRecord.unit_number || null,
          unitName: unitRecord.unit_name || null,
          propertyLabel,
        });
      }
    });
  }

  // Resolve payment transaction details (best-effort)
  const paymentTransactionsWithDetails: PaymentTransaction[] = [];
  if (paymentTransactions && paymentTransactions.length > 0) {
    for (const payment of paymentTransactions) {
      let propertyName: string | null = null;
      let unitNumber: string | null = null;
      let unitName: string | null = null;

      if (payment.accounting_unit_id) {
        const preloadedUnit = unitLabelByBuildiumId.get(payment.accounting_unit_id);
        if (preloadedUnit) {
          unitNumber = preloadedUnit.unitNumber || unitNumber;
          unitName = preloadedUnit.unitName || unitName;
          if (!propertyName && preloadedUnit.propertyLabel) {
            propertyName = preloadedUnit.propertyLabel;
          }
        } else {
          const { data: unit } = await db
            .from('units')
            .select('unit_number, unit_name, properties(name)')
            .eq('buildium_unit_id', payment.accounting_unit_id)
            .maybeSingle();

          if (unit) {
            unitNumber = unit.unit_number || null;
            unitName = unit.unit_name || null;
            if (
              unit.properties &&
              typeof unit.properties === 'object' &&
              'name' in unit.properties
            ) {
              const propsWithName = unit.properties as { name?: string | null };
              propertyName = propsWithName.name || null;
            }
          }
        }
      }

      if (
        !propertyName &&
        payment.accounting_entity_id &&
        typeof payment.accounting_entity_id === 'number'
      ) {
        const label = propertyLabelByBuildiumId.get(payment.accounting_entity_id);
        if (label) propertyName = label;
      }

      // Try to resolve memo/check no. from the original payment transaction when possible
      let memo: string | null = null;
      let checkNo: string | null = null;
      const paymentBuildiumId = payment.buildium_payment_transaction_id;
      if (paymentBuildiumId) {
        const { data: sourceTx } = await db
          .from('transactions')
          .select(
            'id, memo, reference_number, check_number, date, transaction_lines(property_id, unit_id)',
          )
          .eq('buildium_transaction_id', paymentBuildiumId)
          .maybeSingle();
        memo = sourceTx?.memo ?? null;
        checkNo = sourceTx?.check_number ?? sourceTx?.reference_number ?? null;

        const lineWithEntity = (sourceTx?.transaction_lines || []).find(
          (l: { property_id?: string | null; unit_id?: string | null }) =>
            l?.property_id || l?.unit_id,
        );
        const sourcePropertyId = lineWithEntity?.property_id || null;
        const sourceUnitId = lineWithEntity?.unit_id || null;

        if (sourceUnitId && !unitNumber && !unitName) {
          const { data: sourceUnit } = await db
            .from('units')
            .select('unit_number, unit_name, properties(name)')
            .eq('id', sourceUnitId)
            .maybeSingle();
          unitNumber = sourceUnit?.unit_number || null;
          unitName = sourceUnit?.unit_name || null;
          if (
            !propertyName &&
            sourceUnit?.properties &&
            typeof sourceUnit.properties === 'object' &&
            'name' in sourceUnit.properties
          ) {
            const propsWithName = sourceUnit.properties as { name?: string | null };
            propertyName = propsWithName.name || null;
          }
        }

        if (sourcePropertyId && !propertyName) {
          const { data: sourceProp } = await db
            .from('properties')
            .select('name, address_line1')
            .eq('id', sourcePropertyId)
            .maybeSingle();
          if (sourceProp) {
            propertyName = `${sourceProp.name || 'Property'}${sourceProp.address_line1 ? ` • ${sourceProp.address_line1}` : ''}`;
          }
        }
      }

      // If we have unit_name, it already includes property-unit format, so don't show property_name separately
      paymentTransactionsWithDetails.push({
        id: payment.id,
        date: transaction.date || '',
        property_name: unitName ? null : propertyName || null,
        unit_number: unitNumber,
        unit_name: unitName,
        memo,
        check_number: checkNo,
        amount: Number(payment.amount || 0),
      });
    }
  }

  const paymentsTotal = paymentTransactionsWithDetails.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0,
  );
  const totalAmount =
    paymentsTotal > 0
      ? paymentsTotal
      : Number.isFinite(Number(transaction.total_amount))
        ? Number(transaction.total_amount)
        : 0;

  // Fetch deposit overlay (status + deposit_id)
  const { data: depositMeta } = await (db as any)
    .from('deposit_meta')
    .select('deposit_id, status')
    .eq('transaction_id', transactionId)
    .maybeSingle();

  const depositData = {
    id: transactionId,
    deposit_id: depositMeta?.deposit_id ?? depositId,
    status: (depositMeta?.status as DepositStatus | undefined) ?? 'posted',
    date: transaction.date || '',
    memo: transaction.memo || null,
    total_amount: totalAmount,
    bank_gl_account_id: transaction.bank_gl_account_id || null,
    bank_account_name: bankAccountName,
    payment_transactions: paymentTransactionsWithDetails,
  };

  const displayDepositId = depositData.deposit_id || depositData.id;
  const statusLabel = depositData.status
    ? depositData.status.charAt(0).toUpperCase() + depositData.status.slice(1)
    : null;

  const patchUrl = `/api/bank-accounts/${bankAccountId}/deposits/${transactionId}`;
  const deleteUrl = `/api/bank-accounts/${bankAccountId}/deposits/${transactionId}`;
  const returnHref = `/bank-accounts/${bankAccountId}`;

  return (
    <PageShell>
      <PageHeader
        title={`Deposit ${displayDepositId}`}
        description={statusLabel ? `Status: ${statusLabel}` : undefined}
      />
      <PageBody>
        <EditDepositForm
          deposit={depositData}
          bankAccounts={bankAccounts}
          patchUrl={patchUrl}
          deleteUrl={deleteUrl}
          returnHref={returnHref}
        />
      </PageBody>
    </PageShell>
  );
}
