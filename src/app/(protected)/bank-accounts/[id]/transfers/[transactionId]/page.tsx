import { supabase, supabaseAdmin } from '@/lib/db';
import InfoCard from '@/components/layout/InfoCard';
import { PageBody, PageHeader, PageShell } from '@/components/layout/page-shell';
import EditTransferForm, {
  type TransferBankAccountOption,
  type TransferData,
  type TransferGlAccountOption,
  type TransferPropertyOption,
  type TransferUnitOption,
} from '@/components/bank-accounts/EditTransferForm';

type BankAccountDetail = { id: string; name: string | null };

type BankAccountRow = {
  id: string;
  name: string | null;
  bank_balance: number | null;
};

type PropertyRow = {
  id: string;
  name: string | null;
  address_line1: string | null;
  is_active: boolean | null;
};

type UnitRow = {
  id: string;
  property_id: string | null;
  unit_number: string | null;
  unit_name: string | null;
};

type GLAccountRow = {
  id: string;
  name: string | null;
  account_number: string | null;
  type: string | null;
  is_bank_account?: boolean | null;
};

type TransactionRow = {
  id: string;
  date: string;
  memo: string | null;
  total_amount: number | null;
  transaction_type: string | null;
  bank_gl_account_id: string | null;
  buildium_transaction_id: string | null;
};

type TransactionLineRow = {
  id: string;
  gl_account_id: string | null;
  posting_type: string | null;
  amount: number | null;
  property_id: string | null;
  unit_id: string | null;
};

function renderError(message: string) {
  return (
    <PageShell>
      <PageHeader title="Edit transfer" />
      <PageBody>
        <InfoCard title="Edit transfer">
          <p className="text-sm text-red-600">{message}</p>
        </InfoCard>
      </PageBody>
    </PageShell>
  );
}

export default async function BankAccountTransferEditPage({
  params,
}: {
  params: Promise<{ id: string; transactionId: string }>;
}) {
  const { id: bankAccountId, transactionId } = await params;
  const db = supabaseAdmin || supabase;
  if (!db) return renderError('Database client is unavailable.');

  const { data: accountRaw, error: accountError } = await db
    .from('gl_accounts')
    .select('id, name')
    .eq('id', bankAccountId)
    .eq('is_bank_account', true)
    .maybeSingle();

  const account = accountRaw || null;
  if (accountError || !account) return renderError('Bank account not found.');

  const { data: tx, error: txError } = await db
    .from('transactions')
    .select('id, date, memo, total_amount, transaction_type, bank_gl_account_id, buildium_transaction_id')
    .eq('id', transactionId)
    .maybeSingle();

  if (txError || !tx) return renderError('Transfer transaction not found.');

  // Heuristic: our "transfer" is stored as transaction_type 'Other' with exactly two bank GL lines.
  const { data: bankLines, error: linesError } = await db
    .from('transaction_lines')
    .select('id, gl_account_id, posting_type, amount, property_id, unit_id')
    .eq('transaction_id', transactionId)
    .limit(50);

  if (linesError) return renderError('Failed to load transfer lines.');

  const bankLineCandidates =
    bankLines?.filter((l) => {
      const glId = l?.gl_account_id ? String(l.gl_account_id) : '';
      return Boolean(glId);
    }) ?? [];

  const bankLineForContext = bankLineCandidates.find((l) => String(l.gl_account_id) === bankAccountId);
  if (!bankLineForContext) {
    return renderError('Transfer not found for this bank account.');
  }

  const byPosting = (posting: 'Credit' | 'Debit') =>
    bankLineCandidates.find((l) => String(l.posting_type) === posting) ?? null;

  // Most transfers: Credit = from, Debit = to (per record-other-transaction route)
  const creditLine = byPosting('Credit');
  const debitLine = byPosting('Debit');

  const fromBankAccountId = creditLine?.gl_account_id ? String(creditLine.gl_account_id) : bankAccountId;
  const toBankAccountId = debitLine?.gl_account_id ? String(debitLine.gl_account_id) : bankAccountId;
  const amountRaw = creditLine?.amount ?? debitLine?.amount ?? tx.total_amount ?? 0;
  const amount = Math.abs(Number(amountRaw ?? 0));

  const propertyId = creditLine?.property_id ?? debitLine?.property_id ?? null;
  const unitId = creditLine?.unit_id ?? debitLine?.unit_id ?? null;

  const [{ data: bankAccountsData }, { data: propertiesData }, { data: unitsData }, { data: glAccountsData }] =
    await Promise.all([
      db
        .from('gl_accounts')
        .select('id, name, bank_balance')
        .eq('is_bank_account', true)
        .order('name', { ascending: true })
        .limit(500),
      db
        .from('properties')
        .select('id, name, address_line1, is_active')
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(1000),
      db
        .from('units')
        .select('id, property_id, unit_number, unit_name')
        .order('unit_number', { ascending: true })
        .limit(5000),
      db
        .from('gl_accounts')
        .select('id, name, account_number, type, is_bank_account')
        .eq('is_bank_account', false)
        .order('name', { ascending: true })
        .limit(5000),
    ]);

  const bankAccounts: TransferBankAccountOption[] = (bankAccountsData || []).map((row) => ({
    id: String(row.id),
    label: row.name || 'Bank account',
    balance: typeof row.bank_balance === 'number' ? row.bank_balance : null,
  }));

  const properties: TransferPropertyOption[] = (propertiesData || []).map((p) => ({
    id: String(p.id),
    label: p.name || p.address_line1 || 'Property',
  }));

  const units: TransferUnitOption[] = (unitsData || []).map((u) => ({
    id: String(u.id),
    label: u.unit_number || u.unit_name || 'Unit',
    propertyId: u.property_id ? String(u.property_id) : null,
  }));

  const glAccounts: TransferGlAccountOption[] = (glAccountsData || []).map((a) => ({
    id: String(a.id),
    label: a?.name || a?.account_number || 'Account',
    type: a?.type ?? null,
  }));

  const transfer: TransferData = {
    id: String(tx.id),
    date: String(tx.date ?? ''),
    memo: tx.memo ?? null,
    amount,
    fromBankAccountId,
    toBankAccountId,
    propertyId,
    unitId,
  };

  const patchUrl = `/api/bank-accounts/${bankAccountId}/transfers/${transactionId}`;
  const deleteUrl = `/api/bank-accounts/${bankAccountId}/transfers/${transactionId}`;
  const returnHref = `/bank-accounts/${bankAccountId}`;

  return (
    <PageShell>
      <PageHeader title="Edit transfer" description={account.name ? `Bank account: ${account.name}` : undefined} />
      <PageBody>
        <EditTransferForm
          transfer={transfer}
          bankAccountId={bankAccountId}
          bankAccounts={bankAccounts}
          properties={properties}
          units={units}
          glAccounts={glAccounts}
          patchUrl={patchUrl}
          deleteUrl={deleteUrl}
          returnHref={returnHref}
        />
      </PageBody>
    </PageShell>
  );
}
