import { notFound } from 'next/navigation';
import { supabase, supabaseAdmin } from '@/lib/db';
import JournalEntryEditForm from '@/components/financials/JournalEntryEditForm';
import {
  type AccountOption,
  type JournalEntryFormValues,
  type PropertyOption,
  type UnitOption,
} from '@/components/financials/GeneralJournalEntryForm';

type LineDetail = {
  id: string;
  property_id?: string | null;
  posting_type: string | null;
  amount: number;
  memo: string | null;
  gl_account_id?: string | null;
  unit_id?: string | null;
  gl_accounts?: { name?: string | null; account_number?: string | null } | null;
  units?: { unit_number?: string | null; unit_name?: string | null } | null;
};

type UnitRecord = {
  id: string;
  unit_number?: string | null;
  unit_name?: string | null;
};

type AccountRecord = {
  id: string;
  name: string;
  account_number?: string | null;
  type?: string | null;
};

export default async function JournalEntryDetailsPage({
  params,
}: {
  params: Promise<{ id: string; transactionId: string }>;
}) {
  const { id: propertyId, transactionId } = await params;
  const db = supabaseAdmin || supabase;

  const [{ data: property }, { data: transaction }, { data: journal }] = await Promise.all([
    db
      .from('properties')
      .select('id, name, org_id')
      .eq('id', propertyId)
      .maybeSingle(),
    db
      .from('transactions')
      .select('id, date, memo, total_amount, transaction_type')
      .eq('id', transactionId)
      .maybeSingle(),
    db
      .from('journal_entries')
      .select('id, buildium_gl_entry_id')
      .eq('transaction_id', transactionId)
      .maybeSingle(),
  ]);

  if (!property || !transaction || transaction.transaction_type !== 'GeneralJournalEntry') {
    notFound();
  }

  const [{ data: lineRows }, { data: unitRows }, accountsResponse] = await Promise.all([
    db
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
      .order('created_at', { ascending: true }),
    db
      .from('units')
      .select('id, unit_number, unit_name')
      .eq('property_id', propertyId)
      .order('unit_number', { ascending: true }),
    (async () => {
      let query = db.from('gl_accounts').select('id, name, account_number, type').order('type').order('name');
      if (property?.org_id) {
        query = query.eq('org_id', property.org_id);
      }
      return await query;
    })(),
  ]);

  if (!lineRows || lineRows.length === 0) {
    notFound();
  }

  const belongsToProperty = lineRows.every(
    (line: { property_id?: string | null }) => !line.property_id || String(line.property_id) === propertyId,
  );
  if (!belongsToProperty) {
    notFound();
  }

  const lines = lineRows as LineDetail[];
  const buildiumLocked = Boolean(journal?.buildium_gl_entry_id);

  const formatAmountString = (value?: number | null) => {
    const numeric = Math.abs(Number(value ?? 0));
    if (!Number.isFinite(numeric) || numeric === 0) return '';
    return numeric.toFixed(2);
  };

  const typedUnits = (unitRows ?? []) as UnitRecord[];
  const unitOptions: UnitOption[] = typedUnits.map((unit) => ({
    id: String(unit.id),
    label: unit.unit_number || unit.unit_name || 'Unit',
  }));

  const typedAccounts = (accountsResponse?.data ?? []) as AccountRecord[];
  const accountOptions: AccountOption[] = typedAccounts
    .slice()
    .sort(
      (a, b) =>
        (a.type || 'Other').localeCompare(b.type || 'Other') ||
        a.name.localeCompare(b.name),
    )
    .map((account) => ({
      value: String(account.id),
      label: account.account_number ? `${account.name} (${account.account_number})` : account.name,
      group: account.type || 'Other',
      groupLabel: account.type ? `${account.type} accounts` : 'Other accounts',
    }));

  const propertyOptions: PropertyOption[] = [
    {
      id: propertyId,
      label: property.name ?? 'Property',
    },
  ];

  const unitId = lines.find((line) => line.unit_id)?.unit_id
    ? String(lines.find((line) => line.unit_id)!.unit_id)
    : '';

  const initialValues: JournalEntryFormValues = {
    date: (transaction.date || '').slice(0, 10),
    propertyId,
    unitId,
    memo: transaction.memo || '',
    lines: lines.map((line) => {
      const posting = (line.posting_type || '').toLowerCase();
      return {
        accountId: line.gl_account_id ? String(line.gl_account_id) : '',
        description: line.memo || '',
        debit: posting === 'debit' ? formatAmountString(line.amount) : '',
        credit: posting === 'credit' ? formatAmountString(line.amount) : '',
      };
    }),
  };

  if (initialValues.lines.length < 2) {
    while (initialValues.lines.length < 2) {
      initialValues.lines.push({
        accountId: '',
        description: '',
        debit: '',
        credit: '',
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/30 p-4">
      <div className="flex max-h-screen w-full flex-col overflow-hidden rounded-none border-none bg-card shadow-2xl sm:w-[min(1100px,95vw)] sm:max-h-[95vh] sm:rounded-2xl sm:border">
        <JournalEntryEditForm
          transactionId={transactionId}
          propertyId={propertyId}
          buildiumLocked={buildiumLocked}
          propertyOptions={propertyOptions}
          unitOptions={unitOptions}
          accountOptions={accountOptions}
          initialValues={initialValues}
        />
      </div>
    </div>
  );
}
