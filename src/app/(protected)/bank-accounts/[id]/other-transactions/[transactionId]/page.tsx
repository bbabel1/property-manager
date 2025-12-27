import { supabase, supabaseAdmin, type TypedSupabaseClient } from '@/lib/db';
import InfoCard from '@/components/layout/InfoCard';
import { PageBody, PageHeader, PageShell } from '@/components/layout/page-shell';
import EditTransferForm, {
  type TransferBankAccountOption,
  type TransferData,
  type TransferGlAccountOption,
  type TransferPropertyOption,
  type TransferUnitOption,
} from '@/components/bank-accounts/EditTransferForm';

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
  gl_accounts?: { is_bank_account: boolean | null } | { is_bank_account: boolean | null }[] | null;
};

function renderError(message: string) {
  return (
    <PageShell>
      <PageHeader title="Edit other transaction" />
      <PageBody>
        <InfoCard title="Edit other transaction">
          <p className="text-sm text-red-600">{message}</p>
        </InfoCard>
      </PageBody>
    </PageShell>
  );
}

function isBankLine(line: TransactionLineRow) {
  const ga = line.gl_accounts;
  const obj = Array.isArray(ga) ? ga[0] : ga;
  return Boolean(obj?.is_bank_account);
}

export default async function BankAccountOtherTransactionEditPage({
  params,
}: {
  params: Promise<{ id: string; transactionId: string }>;
}) {
  const { id: bankAccountId, transactionId } = await params;
  const db: TypedSupabaseClient = supabaseAdmin || supabase;
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

  const txRow = tx as TransactionRow | null;
  if (txError || !txRow) return renderError('Transaction not found.');

  const { data: linesRaw, error: linesError } = await db
    .from('transaction_lines')
    .select('id, gl_account_id, posting_type, amount, property_id, unit_id, gl_accounts(is_bank_account)')
    .eq('transaction_id', transactionId)
    .limit(50);

  if (linesError) return renderError('Failed to load transaction lines.');

  const lines = ((linesRaw || []) as TransactionLineRow[]).filter((l) => Boolean(l?.gl_account_id));
  const bankLines = lines.filter(isBankLine);
  const nonBankLines = lines.filter((l) => !isBankLine(l));

  const bankLineForContext = bankLines.find((l) => String(l.gl_account_id) === bankAccountId);
  if (!bankLineForContext) {
    return renderError('Transaction not found for this bank account.');
  }

  // Infer initial mode from lines:
  // - transfer: >=2 bank lines
  // - deposit: 1 bank line with Debit
  // - withdrawal: 1 bank line with Credit
  const normalizedBankPosting = String(bankLineForContext.posting_type ?? '').toLowerCase();
  const inferredMode: TransferData['mode'] =
    bankLines.length >= 2 ? 'transfer' : normalizedBankPosting === 'debit' ? 'deposit' : 'withdrawal';

  const bankDebit = bankLines.find((l) => String(l.posting_type) === 'Debit') ?? null;
  const bankCredit = bankLines.find((l) => String(l.posting_type) === 'Credit') ?? null;
  const otherLine =
    inferredMode === 'deposit'
      ? nonBankLines.find((l) => String(l.posting_type) === 'Credit') ?? nonBankLines[0] ?? null
      : inferredMode === 'withdrawal'
        ? nonBankLines.find((l) => String(l.posting_type) === 'Debit') ?? nonBankLines[0] ?? null
        : null;

  const fromBankAccountId =
    inferredMode === 'transfer'
      ? bankCredit?.gl_account_id
        ? String(bankCredit.gl_account_id)
        : bankAccountId
      : bankLineForContext.gl_account_id
        ? String(bankLineForContext.gl_account_id)
        : bankAccountId;

  const toBankAccountId =
    inferredMode === 'transfer'
      ? bankDebit?.gl_account_id
        ? String(bankDebit.gl_account_id)
        : bankAccountId
      : '';

  const glAccountId =
    inferredMode === 'transfer' ? null : otherLine?.gl_account_id ? String(otherLine.gl_account_id) : null;

  const amountRaw =
    (inferredMode === 'transfer' ? bankCredit?.amount ?? bankDebit?.amount : bankLineForContext.amount) ??
    txRow.total_amount ??
    0;
  const amount = Math.abs(Number(amountRaw ?? 0));

  const propertyId = bankLineForContext.property_id ?? otherLine?.property_id ?? null;
  const unitId = bankLineForContext.unit_id ?? otherLine?.unit_id ?? null;

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
    id: String(txRow.id),
    date: String(txRow.date ?? ''),
    memo: txRow.memo ?? null,
    amount,
    fromBankAccountId,
    toBankAccountId,
    propertyId,
    unitId,
    mode: inferredMode,
    glAccountId,
  };

  const patchUrl = `/api/bank-accounts/${bankAccountId}/transfers/${transactionId}`;
  const deleteUrl = `/api/bank-accounts/${bankAccountId}/transfers/${transactionId}`;
  const returnHref = `/bank-accounts/${bankAccountId}`;

  return (
    <PageShell>
      <PageHeader
        title="Edit other transaction"
        description={account.name ? `Bank account: ${account.name}` : undefined}
      />
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
