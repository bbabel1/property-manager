import { notFound } from 'next/navigation';

import { supabase, supabaseAdmin } from '@/lib/db';
import { PageBody, PageHeader, PageShell } from '@/components/layout/page-shell';
import InfoCard from '@/components/layout/InfoCard';
import EditCheckForm from '@/components/bank-accounts/EditCheckForm';

type BankAccountOption = {
  id: string;
  name: string;
  account_number?: string | null;
};

type PayeeOption = { id: string; label: string; buildiumId: number | null };

type PropertyOption = {
  id: string;
  label: string;
  buildiumPropertyId: number | null;
  rentalType: string | null;
};

type UnitOption = {
  id: string;
  label: string;
  propertyId: string | null;
  buildiumUnitId: number | null;
};

type GlAccountOption = {
  id: string;
  label: string;
  buildiumGlAccountId: number | null;
};

type CheckAllocationLine = {
  id: string;
  propertyId: string;
  unitId: string;
  glAccountId: string;
  description: string;
  referenceNumber: string;
  amount: string;
};

type CheckData = {
  id: string;
  date: string;
  memo: string | null;
  check_number: string | null;
  bank_gl_account_id: string | null;
  vendor_id: string | null;
  payee_buildium_id: number | null;
  payee_buildium_type: string | null;
  buildium_bill_id: number | null;
  allocations: CheckAllocationLine[];
};

type BillsPaidRow = {
  dueDate: string | null;
  vendorName: string;
  memo: string | null;
  referenceNumber: string | null;
  amount: number;
};

function nameOfVendor(v: {
  id: string;
  buildium_vendor_id?: number | null;
  contact?: { display_name?: string; company_name?: string; first_name?: string; last_name?: string } | null;
}) {
  const c = v?.contact ?? null;
  return (
    c?.display_name ||
    c?.company_name ||
    [c?.first_name, c?.last_name].filter(Boolean).join(' ') ||
    'Vendor'
  );
}

function nameOfOwner(o: {
  id: string;
  buildium_owner_id: number | null;
  contacts?: {
    display_name?: string | null;
    company_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    is_company?: boolean | null;
  } | null;
}) {
  const c = o?.contacts ?? null;
  if (!c) return 'Owner';
  const display =
    c.display_name ||
    (c.is_company ? c.company_name : null) ||
    [c.first_name, c.last_name].filter(Boolean).join(' ');
  return display || 'Owner';
}

function labelOfProperty(row: { name: string | null }) {
  // UI: show only the property name (no address, no owner suffixes).
  // Some orgs embed extra info in name like "123 Main St | Owner Name"; keep only the left side.
  const raw = (row?.name ?? '').trim();
  const base = raw.includes('|') ? raw.split('|')[0].trim() : raw;
  return base || 'Property';
}

function isAccountsPayableName(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized.startsWith('accounts payable');
}

function labelOfUnit(row: { unit_number: string | null; unit_name: string | null }) {
  return row?.unit_number || row?.unit_name || 'Unit';
}

export default async function BankAccountCheckEditPage({
  params,
}: {
  params: Promise<{ id: string; transactionId: string }>;
}) {
  const { id: bankAccountId, transactionId } = await params;
  const db = supabaseAdmin || supabase;
  if (!db) {
    throw new Error('Database client is unavailable');
  }

  const { data: tx, error: txError } = await db
    .from('transactions')
    .select(
      // NOTE: internal references should use local IDs. bill_transaction_id is introduced via migration.
      'id, date, memo, check_number, reference_number, transaction_type, payment_method, bank_gl_account_id, org_id, vendor_id, payee_buildium_id, payee_buildium_type, buildium_bill_id, bill_transaction_id',
    )
    .eq('id', transactionId)
    .maybeSingle();

  if (txError || !tx) {
    return (
      <PageShell>
        <PageHeader title="Edit check" />
        <PageBody>
          <InfoCard title="Edit check">
            <p className="text-sm text-red-600">Check transaction not found.</p>
          </InfoCard>
        </PageBody>
      </PageShell>
    );
  }

  const txType = String(tx.transaction_type ?? '').toLowerCase();
  const paymentMethod =
    typeof (tx as any).payment_method === 'string'
      ? (tx as any).payment_method.toLowerCase()
      : '';
  const hasCheckNumber = Boolean(tx.check_number) || Boolean(tx.reference_number);
  const isCheckTx =
    txType === 'check' ||
    hasCheckNumber ||
    (txType === 'payment' && (paymentMethod === 'check' || hasCheckNumber));

  if (!isCheckTx) {
    return (
      <PageShell>
        <PageHeader title="Edit check" />
        <PageBody>
          <InfoCard title="Edit check">
            <p className="text-sm text-red-600">Transaction is not a check.</p>
          </InfoCard>
        </PageBody>
      </PageShell>
    );
  }

  if (tx.bank_gl_account_id !== bankAccountId) {
    const { data: bankLine } = await db
      .from('transaction_lines')
      .select('id')
      .eq('transaction_id', transactionId)
      .eq('gl_account_id', bankAccountId)
      .limit(1)
      .maybeSingle();
    if (!bankLine) {
      return (
        <PageShell>
          <PageHeader title="Edit check" />
          <PageBody>
            <InfoCard title="Edit check">
              <p className="text-sm text-red-600">Check not found for this bank account.</p>
            </InfoCard>
          </PageBody>
        </PageShell>
      );
    }
  }

  const [bankAccountsData, vendorsData, ownersData, propertiesData, unitsData, glAccountsData, linesData] =
    await Promise.all([
      db
        .from('gl_accounts')
        .select('id, name, account_number')
        .eq('is_bank_account', true)
        .order('name')
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
        .select('id, name, buildium_property_id, rental_type')
        .order('name', { ascending: true })
        .limit(1000),
      db
        .from('units')
        .select('id, property_id, unit_number, unit_name, buildium_unit_id')
        .order('unit_number', { ascending: true })
        .limit(5000),
      db
        .from('gl_accounts')
        .select('id, name, account_number, buildium_gl_account_id, default_account_name, type, sub_type, is_bank_account')
        .eq('is_bank_account', false)
        .order('name', { ascending: true })
        .limit(5000),
      db
        .from('transaction_lines')
        .select(
          'id, gl_account_id, amount, posting_type, memo, property_id, unit_id, reference_number, buildium_property_id, buildium_unit_id',
        )
        .eq('transaction_id', transactionId)
        .order('created_at', { ascending: true })
        .limit(5000),
    ]);

  const bankAccounts: BankAccountOption[] = (bankAccountsData.data || []).map((a) => ({
    id: String(a.id),
    name: a.name,
    account_number: a.account_number,
  }));

  const vendorOptions: PayeeOption[] = ((vendorsData.data || []) as any[]).map((v) => ({
    id: String(v.id),
    label: nameOfVendor(v),
    buildiumId: typeof v.buildium_vendor_id === 'number' ? v.buildium_vendor_id : null,
  }));

  const ownerOptions: PayeeOption[] = ((ownersData.data || []) as any[]).map((o) => ({
    id: String(o.id),
    label: nameOfOwner(o),
    buildiumId: typeof o.buildium_owner_id === 'number' ? o.buildium_owner_id : null,
  }));

  const vendorLabelById = new Map<string, string>();
  vendorOptions.forEach((v) => vendorLabelById.set(v.id, v.label));

  const propertyOptions: PropertyOption[] = ((propertiesData.data || []) as any[]).map((p) => ({
    id: String(p.id),
    label: labelOfProperty(p),
    buildiumPropertyId: typeof p.buildium_property_id === 'number' ? p.buildium_property_id : null,
    rentalType: typeof p.rental_type === 'string' ? p.rental_type : null,
  }));

  const unitOptions: UnitOption[] = ((unitsData.data || []) as any[]).map((u) => ({
    id: String(u.id),
    label: labelOfUnit(u),
    propertyId: u.property_id ? String(u.property_id) : null,
    buildiumUnitId: typeof u.buildium_unit_id === 'number' ? u.buildium_unit_id : null,
  }));

  const glAccountOptions: GlAccountOption[] = ((glAccountsData.data || []) as any[]).map((a) => ({
    id: String(a.id),
    label: a?.name || a?.account_number || 'Account',
    buildiumGlAccountId: typeof a.buildium_gl_account_id === 'number' ? a.buildium_gl_account_id : null,
  }));

  const glMetaById = new Map<
    string,
    { name: string | null; default_account_name: string | null; type: string | null; sub_type: string | null }
  >();
  ((glAccountsData.data || []) as any[]).forEach((a) => {
    glMetaById.set(String(a.id), {
      name: typeof a?.name === 'string' ? a.name : null,
      default_account_name: typeof a?.default_account_name === 'string' ? a.default_account_name : null,
      type: typeof a?.type === 'string' ? a.type : null,
      sub_type: typeof a?.sub_type === 'string' ? a.sub_type : null,
    });
  });

  const nonBankLinesAll = ((linesData.data || []) as any[]).filter((l) => {
    const glId = l?.gl_account_id ? String(l.gl_account_id) : '';
    if (!glId) return false;
    if (glId === bankAccountId) return false;
    return true;
  });

  // Hide the bill "offset" line (Accounts Payable) from allocations when possible.
  const nonBankLinesWithoutAp = nonBankLinesAll.filter((l) => {
    const glId = l?.gl_account_id ? String(l.gl_account_id) : '';
    if (!glId) return true;
    const meta = glMetaById.get(glId);
    return !isAccountsPayableName(meta?.default_account_name) && !isAccountsPayableName(meta?.name);
  });
  const nonBankLines = nonBankLinesWithoutAp.length ? nonBankLinesWithoutAp : nonBankLinesAll;

  let allocations: CheckAllocationLine[] = nonBankLines.map((l) => ({
    id: String(l.id),
    propertyId: l.property_id ? String(l.property_id) : '',
    unitId: l.unit_id ? String(l.unit_id) : '',
    glAccountId: l.gl_account_id ? String(l.gl_account_id) : '',
    description: typeof l.memo === 'string' ? l.memo : '',
    referenceNumber: typeof l.reference_number === 'string' ? l.reference_number : '',
    amount:
      typeof l.amount === 'number'
        ? String(l.amount)
        : typeof l.amount === 'string'
          ? String(l.amount)
          : '',
  }));

  // If this payment is linked to a bill, load the bill by local ID and use it for:
  // - Bills paid section
  // - Vendor fallback (vendor_id should be present on payment, but bill is authoritative)
  // - Allocation display when the payment lines are missing (bill-locked edits).
  let billsPaid: BillsPaidRow[] = [];
  const billTransactionId = (tx as any)?.bill_transaction_id ? String((tx as any).bill_transaction_id) : null;
  if (billTransactionId) {
    const { data: billTx } = await db
      .from('transactions')
      .select('id, due_date, memo, reference_number, total_amount, vendor_id, transaction_type')
      .eq('id', billTransactionId)
      .maybeSingle();

    if (billTx?.id) {
      billsPaid = [
        {
          dueDate: (billTx as any).due_date ?? null,
          vendorName: (billTx as any).vendor_id ? vendorLabelById.get(String((billTx as any).vendor_id)) ?? '—' : '—',
          memo: (billTx as any).memo ?? null,
          referenceNumber: (billTx as any).reference_number ?? null,
          amount: Number((billTx as any).total_amount ?? 0),
        },
      ];

      const { data: billLines } = await db
        .from('transaction_lines')
        .select('id, gl_account_id, amount, memo, property_id, unit_id, reference_number')
        .eq('transaction_id', billTx.id)
        .order('created_at', { ascending: true })
        .limit(5000);

      const mappedAll = (billLines || []).map((l: any) => ({
        id: String(l.id),
        propertyId: l.property_id ? String(l.property_id) : '',
        unitId: l.unit_id ? String(l.unit_id) : '',
        glAccountId: l.gl_account_id ? String(l.gl_account_id) : '',
        description: typeof l.memo === 'string' ? l.memo : '',
        referenceNumber: typeof l.reference_number === 'string' ? l.reference_number : '',
        amount:
          typeof l.amount === 'number'
            ? String(Math.abs(l.amount))
            : typeof l.amount === 'string'
              ? String(l.amount)
              : '',
      }));

      const mappedWithoutAp = mappedAll.filter((l) => {
        const meta = glMetaById.get(l.glAccountId);
        return !isAccountsPayableName(meta?.default_account_name) && !isAccountsPayableName(meta?.name);
      });
      const mapped = mappedWithoutAp.length ? mappedWithoutAp : mappedAll;

      if (mapped.length && allocations.length === 0) {
        allocations = mapped;
      }
    }
  }

  const checkData: CheckData = {
    id: String(tx.id),
    date: tx.date,
    memo: tx.memo ?? null,
    check_number: tx.check_number ?? null,
    bank_gl_account_id: tx.bank_gl_account_id ?? null,
    vendor_id:
      typeof tx.vendor_id === 'string' && tx.vendor_id
        ? tx.vendor_id
        : billTransactionId
          ? ((await db
              .from('transactions')
              .select('vendor_id')
              .eq('id', billTransactionId)
              .maybeSingle()) as any)?.data?.vendor_id ?? null
          : null,
    payee_buildium_id: tx.payee_buildium_id ?? null,
    payee_buildium_type: tx.payee_buildium_type ?? null,
    buildium_bill_id: tx.buildium_bill_id ?? null,
    allocations: allocations.length ? allocations : [],
  };

  return (
    <PageShell>
      <PageHeader title="Edit check" />
      <PageBody>
        <EditCheckForm
          check={checkData}
          bankAccountId={bankAccountId}
          bankAccounts={bankAccounts}
          vendors={vendorOptions}
          rentalOwners={ownerOptions}
          properties={propertyOptions}
          units={unitOptions}
          glAccounts={glAccountOptions}
          billsPaid={billsPaid}
          patchUrl={`/api/bank-accounts/${bankAccountId}/checks/${transactionId}`}
          deleteUrl={`/api/bank-accounts/${bankAccountId}/checks/${transactionId}`}
          returnHref={`/bank-accounts/${bankAccountId}`}
        />
      </PageBody>
    </PageShell>
  );
}

