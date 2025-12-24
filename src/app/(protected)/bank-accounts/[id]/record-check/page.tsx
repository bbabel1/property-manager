import { supabase, supabaseAdmin } from '@/lib/db';
import InfoCard from '@/components/layout/InfoCard';
import { PageBody, PageHeader, PageShell } from '@/components/layout/page-shell';
import RecordCheckForm from '@/components/bank-accounts/RecordCheckForm';

type BankAccountDetail = {
  id: string;
  name: string | null;
};

type BankAccountRow = {
  id: string;
  name: string | null;
  bank_balance: number | null;
  buildium_gl_account_id: number | null;
};

type VendorRecord = {
  id: string;
  buildium_vendor_id?: number | null;
  contact?: {
    display_name?: string | null;
    company_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  };
};

type OwnerRecord = {
  id: string;
  buildium_owner_id: number | null;
  contacts?: {
    display_name?: string | null;
    company_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    is_company?: boolean | null;
  } | null;
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
  type: string | null;
  is_bank_account?: boolean | null;
};

function nameOfVendor(v: VendorRecord) {
  return (
    v?.contact?.display_name ||
    v?.contact?.company_name ||
    [v?.contact?.first_name, v?.contact?.last_name].filter(Boolean).join(' ') ||
    'Vendor'
  );
}

function nameOfOwner(o: OwnerRecord) {
  const c = o?.contacts ?? null;
  if (!c) return 'Owner';
  const display =
    c.display_name ||
    (c.is_company ? c.company_name : null) ||
    [c.first_name, c.last_name].filter(Boolean).join(' ');
  return display || 'Owner';
}

function labelOfProperty(row: PropertyRow) {
  const name = row?.name || 'Property';
  const addr = row?.address_line1 ? ` • ${row.address_line1}` : '';
  return `${name}${addr}`;
}

function labelOfUnit(row: UnitRow) {
  return row?.unit_number || row?.unit_name || 'Unit';
}

export default async function RecordCheckPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const db = supabaseAdmin || supabase;

  const [
    { data: accountRaw, error: accountError },
    { data: bankAccountsData },
    { data: vendorsData },
    { data: ownersData },
    { data: propertiesData },
    { data: unitsData },
    { data: glAccountsData },
  ] = await Promise.all([
    db
      .from('gl_accounts')
      .select('id, name')
      .eq('id', id)
      .eq('is_bank_account', true)
      .maybeSingle(),
    db
      .from('gl_accounts')
      .select('id, name, bank_balance, buildium_gl_account_id')
      .eq('is_bank_account', true)
      .order('name', { ascending: true })
      .limit(500),
    db
      .from('vendors')
      .select(
        'id, buildium_vendor_id, contact:contacts!vendors_contact_id_fkey(display_name, company_name, first_name, last_name)',
      )
      .order('updated_at', { ascending: false })
      .limit(1000),
    db
      .from('owners')
      .select(
        'id, buildium_owner_id, contacts!owners_contact_fk(display_name, company_name, first_name, last_name, is_company)',
      )
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1000),
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
      .select('id, name, account_number, type, buildium_gl_account_id, is_bank_account')
      .eq('is_bank_account', false)
      .order('name', { ascending: true })
      .limit(5000),
  ]);

  const account = accountRaw || null;

  if (accountError || !account) {
    return (
      <InfoCard title="Record check">
        <p className="text-sm text-red-600">Bank account not found.</p>
      </InfoCard>
    );
  }

  const allBankAccounts = bankAccountsData || [];

  const recordCheckBankAccounts = allBankAccounts.map((row) => ({
    id: String(row.id),
    label: row?.name || 'Bank account',
    buildiumBankAccountId:
      typeof row?.buildium_gl_account_id === 'number' ? row.buildium_gl_account_id : null,
    balance: typeof row?.bank_balance === 'number' ? row.bank_balance : null,
  }));

  const vendorsAll = vendorsData || [];
  const recordCheckVendors = vendorsAll
    .map((v) => ({
      id: String(v.id),
      label: nameOfVendor(v),
      buildiumId: typeof v.buildium_vendor_id === 'number' ? v.buildium_vendor_id : null,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const ownersAll = ownersData || [];
  const recordCheckOwners = ownersAll
    .map((o) => ({
      id: String(o.id),
      label: nameOfOwner(o),
      buildiumId: typeof o.buildium_owner_id === 'number' ? o.buildium_owner_id : null,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const propertyRows = propertiesData || [];
  const recordCheckProperties = propertyRows.map((p) => ({
    id: String(p.id),
    label: labelOfProperty(p),
    buildiumPropertyId: typeof p.buildium_property_id === 'number' ? p.buildium_property_id : null,
  }));

  const unitRows = unitsData || [];
  const recordCheckUnits = unitRows.map((u) => ({
    id: String(u.id),
    label: labelOfUnit(u),
    propertyId: u.property_id ? String(u.property_id) : null,
    buildiumUnitId: typeof u.buildium_unit_id === 'number' ? u.buildium_unit_id : null,
  }));

  const glAccountRows = glAccountsData || [];
  const recordCheckGlAccounts = glAccountRows.map((a) => ({
    id: String(a.id),
    label: a?.name || a?.account_number || 'Account',
    buildiumGlAccountId:
      typeof a.buildium_gl_account_id === 'number' ? a.buildium_gl_account_id : null,
    type: a?.type ?? null,
  }));

  return (
    <PageShell>
      <PageHeader
        title="Record check"
        description={account.name ? `Bank account: ${account.name}` : undefined}
      />
      <PageBody>
        <RecordCheckForm
          bankAccountId={id}
          bankAccounts={recordCheckBankAccounts}
          vendors={recordCheckVendors}
          rentalOwners={recordCheckOwners}
          properties={recordCheckProperties}
          units={recordCheckUnits}
          glAccounts={recordCheckGlAccounts}
          defaultBankAccountId={id}
        />
      </PageBody>
    </PageShell>
  );
}
