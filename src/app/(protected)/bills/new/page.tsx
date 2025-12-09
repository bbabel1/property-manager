import { Metadata } from 'next';
import Link from 'next/link';

import RecordBillForm from '@/components/bills/RecordBillForm';
import { getSupabaseServiceRoleClient, type TypedSupabaseClient } from '@/lib/db';
import { PageBody, PageHeader, PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Record bill',
};

function mapLabel(input: { name?: string | null; address_line1?: string | null }) {
  return input?.name || input?.address_line1 || 'Property';
}

function mapUnitLabel(input: { unit_number?: string | null; unit_name?: string | null }) {
  return input?.unit_number || input?.unit_name || 'Property level';
}

type PropertyRow = {
  id: string | number;
  name?: string | null;
  address_line1?: string | null;
};

type UnitRow = {
  id: string | number;
  property_id?: string | number | null;
  unit_number?: string | null;
  unit_name?: string | null;
};

type VendorContactRow = {
  display_name?: string | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

type VendorRow = {
  id: string | number;
  payment_terms_days?: number | null;
  display_name?: string | null;
  contact?: VendorContactRow | null;
  contacts?: VendorContactRow | null;
};

type AccountRow = {
  id: string | number;
  name?: string | null;
  account_number?: string | null;
  type?: string | null;
  buildium_gl_account_id?: string | number | null;
};

type VendorCategoryRow = {
  id: string | number;
  name?: string | null;
  buildium_category_id?: number | null;
};

const VENDOR_BASE_SELECTION =
  'id, contact:contacts!vendors_contact_id_fkey(display_name, company_name, first_name, last_name)';
const OPTIONAL_VENDOR_COLUMNS = [
  {
    column: 'payment_terms_days',
    warning:
      'RecordBillPage: vendors.payment_terms_days is missing. Apply migration 20251109090000_add_payment_terms_days_to_vendors.sql to enable default vendor terms support. Falling back without the column.',
  },
  {
    column: 'display_name',
    warning:
      'RecordBillPage: vendors.display_name is missing. Apply the vendor contact migrations (035-039) to rely on contacts for naming. Falling back to contact names.',
  },
] as const;

const VENDOR_RESULT_LIMIT = 200;
const warnedMissingVendorColumns = new Set<string>();

function buildVendorSelectClause(optionalColumns: readonly string[]) {
  const extras = optionalColumns.length ? `, ${optionalColumns.join(', ')}` : '';
  return `${VENDOR_BASE_SELECTION}${extras}`;
}

function isMissingColumnError(error: unknown, columnName: string) {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error ? String((error as { message?: string }).message || '') : '';
  const details = 'details' in error ? String((error as { details?: string }).details || '') : '';
  const haystack = `${message} ${details}`.toLowerCase();
  return haystack.includes(columnName.toLowerCase());
}

async function fetchVendorsWithOptionalColumns(db: TypedSupabaseClient) {
  const disabledColumns = new Set<string>();

  while (true) {
    const optionalColumns = OPTIONAL_VENDOR_COLUMNS.filter(
      (column) => !disabledColumns.has(column.column),
    );
    const selection = buildVendorSelectClause(optionalColumns.map((column) => column.column));
    const result = await db
      .from('vendors')
      .select(selection)
      .order('updated_at', { ascending: false })
      .limit(VENDOR_RESULT_LIMIT);

    if (!result.error) {
      return result;
    }

    const missingColumn = optionalColumns.find((column) =>
      isMissingColumnError(result.error, column.column),
    );

    if (!missingColumn) {
      return result;
    }

    disabledColumns.add(missingColumn.column);
    if (!warnedMissingVendorColumns.has(missingColumn.column)) {
      console.warn(missingColumn.warning, result.error);
      warnedMissingVendorColumns.add(missingColumn.column);
    }

    if (disabledColumns.size >= OPTIONAL_VENDOR_COLUMNS.length) {
      // Next loop iteration will request only the base selection.
      continue;
    }
  }
}

export default async function RecordBillPage({
  searchParams,
}: {
  searchParams?: Promise<{ propertyId?: string }>;
}) {
  const sp = (await (searchParams || Promise.resolve({}))) || {};
  const preferredPropertyId = typeof (sp as any)?.propertyId === 'string' ? (sp as any).propertyId : null;
  let db: TypedSupabaseClient;
  try {
    db = getSupabaseServiceRoleClient('loading record bill form data');
  } catch (error) {
    console.error(
      'RecordBillPage: Supabase service role key missing. Set SUPABASE_SERVICE_ROLE_KEY to enable bill creation.',
      error,
    );
    throw error;
  }

  const [propertyRes, unitRes, vendorRes, accountRes, vendorCategoryRes] = await Promise.all([
    db.from('properties').select('id, name, address_line1').order('name', { ascending: true }),
    db.from('units').select('id, property_id, unit_number, unit_name').order('unit_number', {
      ascending: true,
    }),
    fetchVendorsWithOptionalColumns(db),
    db.from('gl_accounts').select('id, name, account_number, type').order('name', { ascending: true }),
    db
      .from('vendor_categories')
      .select('id, name, buildium_category_id')
      .eq('is_active', true)
      .order('name', { ascending: true }),
  ]);

  const throwLoadError = (resource: string, error: unknown) => {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || '')
        : '';
    throw new Error(
      `Unable to load ${resource} for record bill form${
        message ? `: ${message}` : '. Check Supabase policies and service role configuration.'
      }`,
    );
  };

  if (propertyRes.error) throwLoadError('properties', propertyRes.error);
  if (unitRes.error) throwLoadError('units', unitRes.error);
  if (vendorRes.error) throwLoadError('vendors', vendorRes.error);
  if (accountRes.error) throwLoadError('accounts', accountRes.error);
  if (vendorCategoryRes.error) throwLoadError('vendor categories', vendorCategoryRes.error);

  const propertyRows = (propertyRes.data ?? []) as PropertyRow[];
  const properties =
    propertyRows.map((row) => ({
      id: String(row.id),
      label: mapLabel(row),
    })) ?? [];

  const propertyOptions = [
    { id: '__company__', label: 'Company (no property)' },
    ...properties,
  ];
  const unitRows = (unitRes.data ?? []) as UnitRow[];
  const units =
    unitRows.map((row) => ({
      id: String(row.id),
      label: mapUnitLabel(row),
      property_id: row.property_id != null ? String(row.property_id) : null,
    })) ?? [];

  const vendorRows = (vendorRes.data ?? []) as VendorRow[];
  const vendors =
    vendorRows.map((row) => {
      const contact = row?.contact ?? row?.contacts ?? {};
      const displayName = row?.display_name;
      const label =
        displayName ||
        contact?.display_name ||
        contact?.company_name ||
        [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') ||
        'Vendor';
      const defaultTermDays =
        typeof row?.payment_terms_days === 'number' ? row.payment_terms_days : null;
      return {
        id: String(row.id),
        label,
        defaultTermDays,
      };
    }) ?? [];

  const accountRows = (accountRes.data ?? []) as AccountRow[];
  const accounts = accountRows.map((row) => ({
    id: String(row.id),
    label: row?.name || row?.account_number || 'Account',
    type: row?.type || null,
  }));

  const vendorCategoryRows = (vendorCategoryRes.data ?? []) as VendorCategoryRow[];
  const vendorCategories =
    vendorCategoryRows.map((row) => ({
      id: String(row.id),
      name: row?.name || 'Category',
      buildiumCategoryId:
        typeof row?.buildium_category_id === 'number' ? row.buildium_category_id : null,
    })) ?? [];

  const payableAccountCandidates = accounts.filter((account) =>
    String(account.type || '').toLowerCase().includes('payable'),
  );

  return (
    <PageShell>
      <PageHeader
        title="Record bill"
        description="Capture vendor invoices, allocate costs, and maintain accounts payable balances."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/bills">Back to bills</Link>
          </Button>
        }
      />
      <PageBody>
        <RecordBillForm
          vendors={vendors}
          vendorCategories={vendorCategories}
          properties={propertyOptions}
          units={units}
          glAccounts={accounts}
          payableAccounts={payableAccountCandidates.length ? payableAccountCandidates : accounts}
          defaultPropertyId={preferredPropertyId}
        />
      </PageBody>
    </PageShell>
  );
}
