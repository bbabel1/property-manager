import { supabase, supabaseAdmin } from '@/lib/db';
import InfoCard from '@/components/layout/InfoCard';
import { PageBody, PageHeader, PageShell } from '@/components/layout/page-shell';
import RecordOtherTransactionForm, {
  type BankAccountOption,
  type GlAccountOption,
  type PropertyOption,
  type UnitOption,
} from '@/components/bank-accounts/RecordOtherTransactionForm';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

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

export default async function RecordOtherTransactionPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const db = (supabaseAdmin || supabase) as SupabaseClient<Database>;

  const { data: accountRaw, error: accountError } = await db
    .from('gl_accounts')
    .select('id, name')
    .eq('id', id)
    .eq('is_bank_account', true)
    .maybeSingle();

  const { data: bankAccountsData } = await db
    .from('gl_accounts')
    .select('id, name, bank_balance')
    .eq('is_bank_account', true)
    .order('name', { ascending: true })
    .limit(500);

  const { data: propertiesData } = await db
    .from('properties')
    .select('id, name, address_line1, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(1000);

  const { data: unitsData } = await db
    .from('units')
    .select('id, property_id, unit_number, unit_name')
    .order('unit_number', { ascending: true })
    .limit(5000);

  const { data: glAccountsData } = await db
    .from('gl_accounts')
    .select('id, name, account_number, type, is_bank_account')
    .eq('is_bank_account', false)
    .order('name', { ascending: true })
    .limit(5000);

  const account = (accountRaw || null) as BankAccountDetail | null;

  if (accountError || !account) {
    return (
      <InfoCard title="Record other transaction">
        <p className="text-sm text-red-600">Bank account not found.</p>
      </InfoCard>
    );
  }

  const bankAccounts: BankAccountOption[] = ((bankAccountsData || []) as BankAccountRow[]).map((row) => ({
    id: String(row.id),
    label: row.name || 'Bank account',
    balance: typeof row.bank_balance === 'number' ? row.bank_balance : null,
  }));

  const properties: PropertyOption[] = ((propertiesData || []) as PropertyRow[]).map((p) => ({
    id: String(p.id),
    label: p.name || p.address_line1 || 'Property',
  }));

  const units: UnitOption[] = ((unitsData || []) as UnitRow[]).map((u) => ({
    id: String(u.id),
    label: u.unit_number || u.unit_name || 'Unit',
    propertyId: u.property_id ? String(u.property_id) : null,
  }));

  const glAccounts: GlAccountOption[] = ((glAccountsData || []) as GLAccountRow[]).map((a) => ({
    id: String(a.id),
    label: a?.name || a?.account_number || 'Account',
    type: a?.type ?? null,
  }));

  return (
    <PageShell>
      <PageHeader
        title="Record other transaction"
        description={account.name ? `Bank account: ${account.name}` : undefined}
      />
      <PageBody>
        <RecordOtherTransactionForm
          bankAccountId={id}
          bankAccounts={bankAccounts}
          properties={properties}
          units={units}
          glAccounts={glAccounts}
          defaultFromBankAccountId={id}
        />
      </PageBody>
    </PageShell>
  );
}
