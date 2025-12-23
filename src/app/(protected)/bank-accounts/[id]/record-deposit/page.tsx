import { supabase, supabaseAdmin } from '@/lib/db';
import InfoCard from '@/components/layout/InfoCard';
import { PageBody, PageHeader, PageShell } from '@/components/layout/page-shell';
import RecordDepositForm, {
  type BankAccountOption,
  type GlAccountOption,
  type PropertyOption,
  type UnitOption,
  type UndepositedPaymentRow,
} from '@/components/bank-accounts/RecordDepositForm';
import { resolveUndepositedFundsGlAccountId } from '@/lib/buildium-mappers';

type BankAccountDetail = {
  id: string;
  name: string | null;
  org_id: string | null;
};

type BankAccountRow = {
  id: string;
  name: string | null;
  bank_balance: number | null;
};

type TxProperty = {
  id: string | null;
  name: string | null;
  operating_bank_gl_account_id: string | null;
  deposit_trust_gl_account_id: string | null;
};

type TxUnit = {
  unit_number: string | null;
  unit_name: string | null;
  property_id: string | null;
  properties?: TxProperty | TxProperty[] | null;
};

type TxRow = {
  id: string | number | null;
  date: string | null;
  memo: string | null;
  check_number: string | null;
  reference_number: string | null;
  total_amount: number | null;
  buildium_transaction_id: number | null;
  payee_name: string | null;
  paid_by_label?: string | null;
  paid_to_name?: string | null;
  tenant_id: string | null;
  paid_to_tenant_id?: string | null;
  transaction_lines?: {
    gl_account_id: string | null;
    amount: number | null;
    posting_type: string | null;
  }[];
  units?: TxUnit | TxUnit[] | null;
};

type PropertyRow = {
  id: string;
  name: string | null;
  address_line1: string | null;
  buildium_property_id: number | null;
  is_active: boolean | null;
};

type UnitRow = {
  id: string;
  property_id: string | null;
  unit_number: string | null;
  unit_name: string | null;
  buildium_unit_id: number | null;
};

type GLAccountRow = {
  id: string;
  name: string | null;
  account_number: string | null;
  buildium_gl_account_id: number | null;
  is_bank_account?: boolean | null;
};

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    const isoLike = value.includes('T') ? value : `${value}T00:00:00Z`;
    const date = new Date(isoLike);
    if (Number.isNaN(date.getTime())) return '—';
    return dateFormatter.format(date);
  } catch {
    return '—';
  }
}

function labelOfUnit(unitNumber: string | null, unitName: string | null) {
  return unitNumber || unitName || '—';
}

function labelOfProperty(name: string | null) {
  return name || '—';
}

function normalizeUnit(unit: TxRow['units']): (TxUnit & { properties: TxProperty | null }) | null {
  const unitObj = Array.isArray(unit) ? unit?.[0] ?? null : unit ?? null;
  if (!unitObj) return null;
  const propertiesRaw = unitObj.properties;
  const properties = Array.isArray(propertiesRaw)
    ? propertiesRaw?.[0] ?? null
    : propertiesRaw ?? null;
  return {
    unit_number: unitObj.unit_number ?? null,
    unit_name: unitObj.unit_name ?? null,
    property_id: unitObj.property_id ?? null,
    properties,
  };
}

export default async function RecordDepositPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseAdmin || supabase;

  const [{ data: accountRaw, error: accountError }, { data: bankAccountsData }] = await Promise.all([
    db
      .from('gl_accounts')
      .select('id, name, org_id')
      .eq('id', id)
      .eq('is_bank_account', true)
      .maybeSingle(),
    db
      .from('gl_accounts')
      .select('id, name, bank_balance')
      .eq('is_bank_account', true)
      .order('name', { ascending: true })
      .limit(500),
  ]);

  const account = (accountRaw || null) as BankAccountDetail | null;

  if (accountError || !account) {
    return (
      <InfoCard title="Record deposit">
        <p className="text-sm text-red-600">Bank account not found.</p>
      </InfoCard>
    );
  }

  const udfGlAccountId = await resolveUndepositedFundsGlAccountId(db, account.org_id ?? null);

  const depositedBuildiumPaymentIds = new Set<number>();
  if (udfGlAccountId) {
    const { data: depositedRows } = await db
      .from('transaction_payment_transactions')
      .select('buildium_payment_transaction_id')
      .not('buildium_payment_transaction_id', 'is', null)
      .limit(10000);

    const deposited = (depositedRows || []) as Array<{ buildium_payment_transaction_id: number | null }>;
    deposited.forEach((row) => {
      const idNum = Number(row.buildium_payment_transaction_id ?? NaN);
      if (Number.isFinite(idNum)) depositedBuildiumPaymentIds.add(idNum);
    });
  }

  const undepositedPayments: UndepositedPaymentRow[] = [];
  if (udfGlAccountId) {
    const { data: txRowsData } = await db
      .from('transactions')
      .select(
        `
        id,
        date,
        memo,
        check_number,
        reference_number,
        total_amount,
        buildium_transaction_id,
        payee_name,
        paid_by_label,
        paid_to_name,
        tenant_id,
        paid_to_tenant_id,
        transaction_lines!inner(
          gl_account_id,
          amount,
          posting_type
        ),
        units:units(
          unit_number,
          unit_name,
          property_id,
          properties:properties(id, name, operating_bank_gl_account_id, deposit_trust_gl_account_id)
        )
      `,
      )
      .eq('bank_gl_account_id', udfGlAccountId)
      .eq('transaction_lines.gl_account_id', udfGlAccountId)
      .in('transaction_type', ['Payment', 'ElectronicFundsTransfer', 'ApplyDeposit'])
      .order('date', { ascending: false })
      .limit(500);

    const candidates = (txRowsData || []) as unknown as TxRow[];
    const tenantIds = new Set<string>();
    for (const row of candidates) {
      const tenantId = row.tenant_id ?? null;
      const paidToTenantId = row.paid_to_tenant_id ?? null;
      if (tenantId) tenantIds.add(String(tenantId));
      if (paidToTenantId) tenantIds.add(String(paidToTenantId));
    }
    const tenantNameById = new Map<string, string>();
    if (tenantIds.size > 0) {
      const { data: tenantRows } = await db
        .from('tenants')
        .select(
          `
          id,
          contacts:contacts!tenants_contact_id_fkey (
            display_name,
            first_name,
            last_name,
            company_name
          )
        `,
        )
        .in('id', Array.from(tenantIds))
        .limit(2000);

      const tenants = (tenantRows || []) as Array<{
        id: string;
        contacts?: {
          display_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          company_name?: string | null;
        } | null;
      }>;

      tenants.forEach((t) => {
        const contact = t?.contacts || {};
        const name =
          contact.display_name ||
          [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() ||
          contact.company_name ||
          null;
        if (name && t?.id) tenantNameById.set(String(t.id), name);
      });
    }

    for (const row of candidates) {
      const buildiumTxId = row.buildium_transaction_id ?? null;
      if (buildiumTxId != null && depositedBuildiumPaymentIds.has(buildiumTxId)) continue;

      const unitCtx = normalizeUnit(row.units);
      const propertyName = unitCtx?.properties?.name ?? null;
      const unitLabel = labelOfUnit(unitCtx?.unit_number ?? null, unitCtx?.unit_name ?? null);
      const tenantName =
        (row.tenant_id && tenantNameById.get(row.tenant_id)) ||
        (row.paid_to_tenant_id && tenantNameById.get(row.paid_to_tenant_id)) ||
        null;
      const nameLabel =
        row.payee_name ||
        (row.paid_by_label as string | null) ||
        (row.paid_to_name as string | null) ||
        tenantName ||
        '—';
      const bankLineAmount =
        row.transaction_lines?.reduce((max, line) => {
          const amt = Math.abs(Number(line?.amount ?? NaN));
          return Number.isFinite(amt) && amt > max ? amt : max;
        }, 0) ?? 0;
      const amount = bankLineAmount > 0 ? bankLineAmount : Math.abs(Number(row.total_amount ?? 0));
      const propertyOperatingBankId = unitCtx?.properties?.operating_bank_gl_account_id ?? null;
      const propertyDepositTrustBankId = unitCtx?.properties?.deposit_trust_gl_account_id ?? null;
      const allowedBankIds = new Set(
        [propertyOperatingBankId, propertyDepositTrustBankId].filter(Boolean).map(String),
      );
      if (allowedBankIds.size > 0 && !allowedBankIds.has(id)) continue;

      undepositedPayments.push({
        id: String(row.id),
        date: formatDate(row.date),
        propertyLabel: labelOfProperty(propertyName),
        unitLabel,
        nameLabel,
        memoLabel: row.memo || '—',
        checkNumberLabel: row.check_number || row.reference_number || '—',
        amount,
      });
    }
  }

  const bankAccounts: BankAccountOption[] = ((bankAccountsData || []) as BankAccountRow[]).map(
    (row) => ({
      id: String(row.id),
      label: row.name || 'Bank account',
      balance: typeof row.bank_balance === 'number' ? row.bank_balance : null,
    }),
  );

  const [{ data: propertiesData }, { data: unitsData }, { data: glAccountsData }] =
    await Promise.all([
      db
        .from('properties')
        .select('id, name, address_line1, buildium_property_id, is_active')
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(1000),
      db
        .from('units')
        .select('id, property_id, unit_number, unit_name, buildium_unit_id')
        .order('unit_number', { ascending: true })
        .limit(5000),
      db
        .from('gl_accounts')
        .select('id, name, account_number, buildium_gl_account_id, is_bank_account')
        .eq('is_bank_account', false)
        .order('name', { ascending: true })
        .limit(5000),
    ]);

  const properties: PropertyOption[] = ((propertiesData || []) as PropertyRow[]).map((p) => ({
    id: String(p.id),
    label: `${p.name || 'Property'}${p.address_line1 ? ` • ${p.address_line1}` : ''}`,
    buildiumPropertyId: typeof p.buildium_property_id === 'number' ? p.buildium_property_id : null,
  }));

  const units: UnitOption[] = ((unitsData || []) as UnitRow[]).map((u) => ({
    id: String(u.id),
    label: u.unit_number || u.unit_name || 'Unit',
    propertyId: u.property_id ? String(u.property_id) : null,
    buildiumUnitId: typeof u.buildium_unit_id === 'number' ? u.buildium_unit_id : null,
  }));

  const glAccounts: GlAccountOption[] = ((glAccountsData || []) as GLAccountRow[]).map((a) => ({
    id: String(a.id),
    label: a?.name || a?.account_number || 'Account',
    buildiumGlAccountId:
      typeof a.buildium_gl_account_id === 'number' ? a.buildium_gl_account_id : null,
  }));

  return (
    <PageShell>
      <PageHeader
        title="Record deposit"
        description={account.name ? `Bank account: ${account.name}` : undefined}
      />
      <PageBody>
        <RecordDepositForm
          bankAccountId={id}
          bankAccounts={bankAccounts}
          defaultBankAccountId={id}
          undepositedPaymentsTitle={`Undeposited payments for ${account.name || 'this bank account'}`}
          undepositedPayments={undepositedPayments}
          properties={properties}
          units={units}
          glAccounts={glAccounts}
        />
      </PageBody>
    </PageShell>
  );
}
