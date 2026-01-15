import Link from 'next/link';
import type { ComponentProps } from 'react';

import { supabase, supabaseAdmin } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import TenantContactInlineEditor from '@/components/tenants/TenantContactInlineEditor';
import TenantPersonalInfoInlineEditor from '@/components/tenants/TenantPersonalInfoInlineEditor';
import TenantEmergencyContactInlineEditor from '@/components/tenants/TenantEmergencyContactInlineEditor';
import TenantFilesPanel from '@/components/tenants/TenantFilesPanel';
import TenantNotesTable from '@/components/tenants/TenantNotesTable';
import RecentNotesSection from '@/components/tenants/RecentNotesSection';
import RecentFilesSection from '@/components/tenants/RecentFilesSection';
import {
  NavTabs,
  NavTabsHeader,
  NavTabsList,
  NavTabsTrigger,
  NavTabsContent,
} from '@/components/ui/nav-tabs';
import { resolveLeaseBalances } from '@/lib/lease-balance';
import { Body, Heading } from '@/ui/typography';

type ContactDetails = {
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  company_name?: string | null;
  is_company?: boolean | null;
  primary_email?: string | null;
  alt_email?: string | null;
  primary_phone?: string | null;
  alt_phone?: string | null;
  date_of_birth?: string | null;
  mailing_preference?: string | null;
  primary_address_line_1?: string | null;
  primary_address_line_2?: string | null;
  primary_address_line_3?: string | null;
  primary_city?: string | null;
  primary_state?: string | null;
  primary_postal_code?: string | null;
  primary_country?: string | null;
  alt_address_line_1?: string | null;
  alt_address_line_2?: string | null;
  alt_address_line_3?: string | null;
  alt_city?: string | null;
  alt_state?: string | null;
  alt_postal_code?: string | null;
  alt_country?: string | null;
};

type ContactQueryRow = { contact: ContactDetails | null } | null;

type LeaseContactRow = {
  role: string;
  status: string;
  lease_id: number;
  move_in_date: string | null;
  tenants: { id: string }[];
  lease:
    | null
    | {
        id: number;
        lease_from_date: string | null;
        lease_to_date: string | null;
        lease_type: string | null;
        rent_amount: number | null;
        property_id: string | number | null;
        unit_id: string | number | null;
      }
    | Array<{
        id: number;
        lease_from_date: string | null;
        lease_to_date: string | null;
        lease_type: string | null;
        rent_amount: number | null;
        property_id: string | number | null;
        unit_id: string | number | null;
      }>;
};

type UnknownRow = Record<string, any>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toNumber = (value: unknown): number | null => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
};

const extractTransactionLines = (tx: unknown) => {
  if (!isRecord(tx)) return [];
  const candidates = [
    (tx as { transaction_lines?: unknown[] }).transaction_lines,
    (tx as { Lines?: unknown[] }).Lines,
    (tx as { Journal?: { Lines?: unknown[] | null } }).Journal?.Lines,
  ];
  const lines = candidates.find((c) => Array.isArray(c) && c.length) as unknown[] | undefined;
  return Array.isArray(lines) ? lines.filter(Boolean) : [];
};

const normalizePostingType = (line: unknown) => {
  if (!isRecord(line)) return '';
  const raw =
    line.posting_type ??
    line.PostingType ??
    line.LineType ??
    line.postingType ??
    line.posting_type_enum ??
    '';
  return typeof raw === 'string' ? raw.toLowerCase() : '';
};

const normalizeTransactionType = (tx: unknown) => {
  if (!isRecord(tx)) return '';
  const raw =
    (tx as { TransactionTypeEnum?: unknown })?.TransactionTypeEnum ??
    (tx as { TransactionType?: unknown })?.TransactionType ??
    (tx as { transaction_type?: unknown })?.transaction_type ??
    (tx as { type?: unknown })?.type ??
    '';
  return typeof raw === 'string' ? raw.toLowerCase() : '';
};

const isChargeLikeTransaction = (type: string) => {
  const normalized = type.toLowerCase();
  return normalized.includes('charge') || normalized.includes('invoice') || normalized.includes('bill');
};

const pickString = (obj: UnknownRow | null | undefined, keys: string[]) => {
  if (!obj) return '';
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'string') return val;
  }
  return '';
};

const extractAccountFromLine = (line: unknown) => {
  if (!isRecord(line)) {
    return {
      account: null,
      displayName: '',
      name: '',
      type: '',
      subType: '',
      isDeposit: false,
    };
  }
  const accountRaw =
    (line.gl_accounts && isRecord(line.gl_accounts) ? line.gl_accounts : null) ||
    (line.GLAccount && isRecord(line.GLAccount) ? line.GLAccount : null) ||
    (line.Account && isRecord(line.Account) ? line.Account : null);
  const rawName = pickString(accountRaw, ['name', 'Name']);
  const rawType = pickString(accountRaw, ['type', 'Type']);
  const rawSubType = pickString(accountRaw, ['sub_type', 'SubType']);

  return {
    account: accountRaw,
    displayName: rawName || '',
    name: rawName.toLowerCase(),
    type: rawType.toLowerCase(),
    subType: rawSubType.toLowerCase(),
    isDeposit: Boolean(accountRaw && isRecord(accountRaw) && accountRaw.is_security_deposit_liability),
  };
};

function fmtDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return '—';
  }
}

function fmtUsd(n?: number | null) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);
}

export default async function TenantDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseAdmin || supabase;

  const [{ data: tenant }, { data: contact }, { data: leaseContacts }] = await Promise.all([
    db.from('tenants').select('*').eq('id', id).maybeSingle(),
    db
      .from('tenants')
      .select(
        'contact:contact_id ( first_name, last_name, display_name, company_name, is_company, primary_email, alt_email, primary_phone, alt_phone, date_of_birth, mailing_preference, primary_address_line_1, primary_address_line_2, primary_address_line_3, primary_city, primary_state, primary_postal_code, primary_country, alt_address_line_1, alt_address_line_2, alt_address_line_3, alt_city, alt_state, alt_postal_code, alt_country )',
      )
      .eq('id', id)
      .maybeSingle(),
    db
      .from('lease_contacts')
      .select(
        'role, status, lease_id, move_in_date, tenants!inner( id ), lease!inner( id, lease_from_date, lease_to_date, lease_type, rent_amount, property_id, unit_id )',
      )
      .eq('tenant_id', id),
  ]);

  const contactRow = contact as ContactQueryRow;
  const contactInfo = contactRow?.contact || null;
  const name =
    contactInfo?.display_name ||
    [contactInfo?.first_name, contactInfo?.last_name].filter(Boolean).join(' ') ||
    'Tenant';

  type LeaseSummary = {
    id: number;
    start: string | null;
    end: string | null;
    type: string | null;
    rent: number | null;
    propertyUnit: string | null;
    status: string;
    unitName: string | null;
  };

  const leases: LeaseSummary[] = [];
  if (Array.isArray(leaseContacts)) {
    const leaseRows = leaseContacts as unknown as LeaseContactRow[];
    const propertyIds = new Set<string>();
    const unitIds = new Set<string>();

    for (const row of leaseRows) {
      const leaseArray = Array.isArray(row?.lease) ? row.lease : row?.lease ? [row.lease] : [];

      for (const lease of leaseArray) {
        if (lease.property_id != null) propertyIds.add(String(lease.property_id));
        if (lease.unit_id != null) unitIds.add(String(lease.unit_id));
      }
    }

    const propertyIdList = Array.from(propertyIds);
    const unitIdList = Array.from(unitIds);

    let propertyRows: Array<{ id: string; name: string | null; address_line1: string | null }> = [];
    if (propertyIdList.length) {
      const { data } = await db
        .from('properties')
        .select('id, name, address_line1')
        .in('id', propertyIdList);
      propertyRows = data ?? [];
    }

    let unitRows: Array<{
      id: string;
      unit_number: string | null;
      unit_name: string | null;
      address_line1: string | null;
    }> = [];
    if (unitIdList.length) {
      const { data } = await db
        .from('units')
        .select('id, unit_number, unit_name, address_line1')
        .in('id', unitIdList);
      unitRows = data ?? [];
    }

    const propertyById = new Map<
      string,
      { id: string; name: string | null; address_line1: string | null }
    >();
    for (const property of propertyRows) {
      if (property?.id) propertyById.set(String(property.id), property);
    }

    const unitById = new Map<
      string,
      {
        id: string;
        unit_number: string | null;
        unit_name: string | null;
        address_line1: string | null;
      }
    >();
    for (const unit of unitRows) {
      if (unit?.id) unitById.set(String(unit.id), unit);
    }

    for (const row of leaseRows) {
      const leaseArray = Array.isArray(row?.lease) ? row.lease : row?.lease ? [row.lease] : [];

      for (const lease of leaseArray) {
        const propertyRow =
          lease.property_id != null ? propertyById.get(String(lease.property_id)) : undefined;
        const unitRow = lease.unit_id != null ? unitById.get(String(lease.unit_id)) : undefined;

        const streetLine =
          propertyRow?.address_line1 || unitRow?.address_line1 || propertyRow?.name || null;
        const unitNumber = unitRow?.unit_number || null;
        const unitLabel = [streetLine, unitNumber].filter(Boolean).join(' - ');

        const unitName =
          unitLabel ||
          unitRow?.unit_name ||
          propertyRow?.address_line1 ||
          propertyRow?.name ||
          unitNumber ||
          null;
        const propertyUnit =
          unitLabel ||
          propertyRow?.address_line1 ||
          propertyRow?.name ||
          unitRow?.unit_name ||
          unitNumber ||
          null;

        leases.push({
          id: lease.id,
          start: lease.lease_from_date,
          end: lease.lease_to_date,
          type: lease.lease_type,
          rent: lease.rent_amount,
          propertyUnit,
          status: row.status,
          unitName,
        });
      }
    }
  }

  const leasePriority = (status: string | null | undefined): number => {
    const normalized = (status || '').toLowerCase();
    if (normalized.includes('current') || normalized.includes('active')) return 0;
    if (normalized.includes('future')) return 1;
    if (normalized.includes('past') || normalized.includes('former')) return 2;
    return 3;
  };

  const primaryLease = leases.slice().sort((a, b) => {
    const statusDiff = leasePriority(a.status) - leasePriority(b.status);
    if (statusDiff !== 0) return statusDiff;
    const aTimestamp = a.start ? new Date(a.start).getTime() : 0;
    const bTimestamp = b.start ? new Date(b.start).getTime() : 0;
    return bTimestamp - aTimestamp;
  })[0];

  const primaryLeaseHeadline = primaryLease
    ? primaryLease.status
      ? primaryLease.status.charAt(0).toUpperCase() + primaryLease.status.slice(1).toLowerCase()
      : 'Lease details'
    : 'No lease';

  const primaryLeaseSubtitle = primaryLease
    ? `${primaryLease.status || 'Lease'} • ${primaryLease.unitName || primaryLease.propertyUnit || '—'}`
    : `${[
        contactInfo?.primary_address_line_1 || '—',
        contactInfo?.primary_city || null,
        contactInfo?.primary_state || null,
      ]
        .filter(Boolean)
        .join(', ')} ${contactInfo?.primary_postal_code || ''}`.trim();

  let primaryLeaseBalances = { balance: 0, prepayments: 0, depositsHeld: 0 };
  if (primaryLease?.id != null) {
    try {
      const { data: txRows } = await db
        .from('transactions')
        .select(
          `
          id,
          transaction_type,
          total_amount,
          tenant_id,
          transaction_lines (
            amount,
            posting_type,
            gl_account_id,
            gl_accounts ( id, name, type, sub_type, is_security_deposit_liability )
          )
        `,
        )
        .eq('lease_id', primaryLease.id);

      const transactions = (Array.isArray(txRows) ? txRows : []) as UnknownRow[];

      let balances = resolveLeaseBalances(
        { balance: 0, prepayments: 0, depositsHeld: 0 },
        transactions,
      );

      const needsDeposits = !balances.depositsHeld;
      const needsPrepayments = !balances.prepayments;

      if ((needsDeposits || needsPrepayments) && transactions.length) {
        let depositBalance = 0;
        let prepaymentBalance = 0;

        const readAmount = (line: unknown) => {
          if (!isRecord(line)) return 0;
          const val = line.amount ?? (isRecord(line) ? line.Amount : null);
          return toNumber(val) ?? 0;
        };

        for (const tx of transactions) {
          const lines = extractTransactionLines(tx);
          if (!lines.length) continue;
          const txType = normalizeTransactionType(tx);
          const isChargeLike = isChargeLikeTransaction(txType);

          for (const line of lines) {
            const amountRaw = readAmount(line);
            const amount = Math.abs(amountRaw);
            if (!amount) continue;

            const postingType = normalizePostingType(line);
            const isCredit = postingType === 'credit' || postingType === 'cr';
            const signed = postingType ? (isCredit ? amount : -amount) : amountRaw;

            const { name, type, subType, isDeposit } = extractAccountFromLine(line);
            const depositFlag =
              isDeposit ||
              (type === 'liability' && (name.includes('deposit') || subType.includes('deposit')));
            if (depositFlag) {
              if (!isChargeLike) depositBalance += signed;
              continue;
            }

            const prepayFlag =
              name.includes('prepay') ||
              subType.includes('prepay') ||
              (type === 'liability' && !depositFlag);
            if (prepayFlag && !isChargeLike) prepaymentBalance += signed;
          }
        }

        if (needsDeposits && depositBalance) {
          balances = { ...balances, depositsHeld: depositBalance };
        }
        if (needsPrepayments && prepaymentBalance) {
          balances = { ...balances, prepayments: prepaymentBalance };
        }
      }

      primaryLeaseBalances = balances;
    } catch (err) {
      console.error('Failed to load primary lease balances for tenant', {
        tenantId: id,
        leaseId: primaryLease.id,
        error: err,
      });
    }
  }

  const buildiumTenantId = toNumber(tenant?.buildium_tenant_id);
  const orgId = tenant?.org_id ?? null;
  const tenantId = tenant?.id ?? id;
  const tenantFilesPanelProps: ComponentProps<typeof TenantFilesPanel> = {
    tenantId,
    buildiumTenantId,
    orgId,
    uploaderName: name,
  };

  return (
    <NavTabs defaultValue="summary" className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Heading as="h1" size="h2">
              {name}
            </Heading>
            {tenant?.buildium_tenant_id ? (
              <Badge variant="secondary" className="text-xs">
                {tenant.buildium_tenant_id}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                Not in Buildium
              </Badge>
            )}
          </div>
          <Body size="sm" tone="muted">
            {primaryLeaseSubtitle}
          </Body>
        </div>
      </div>
      <NavTabsHeader className="mt-4">
        <NavTabsList>
          <NavTabsTrigger value="summary">Summary</NavTabsTrigger>
          <NavTabsTrigger value="communications">Communications</NavTabsTrigger>
          <NavTabsTrigger value="files">Files</NavTabsTrigger>
          <NavTabsTrigger value="notes">Notes</NavTabsTrigger>
        </NavTabsList>
      </NavTabsHeader>

      <NavTabsContent value="summary" className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {tenant?.contact_id ? (
              <>
                <TenantContactInlineEditor
                  contactId={Number(tenant.contact_id)}
                  initial={contactInfo || {}}
                />
                {tenant?.id ? (
                  <>
                    <TenantPersonalInfoInlineEditor
                      tenantId={String(tenant.id)}
                      contactId={Number(tenant.contact_id)}
                      initial={{
                        date_of_birth: contactInfo?.date_of_birth ?? null,
                        tax_id: tenant?.tax_id ?? null,
                        comment: tenant?.comment ?? null,
                      }}
                    />
                    <TenantEmergencyContactInlineEditor
                      tenantId={String(tenant.id)}
                      initial={{
                        emergency_contact_name: tenant?.emergency_contact_name ?? null,
                        emergency_contact_email: tenant?.emergency_contact_email ?? null,
                        emergency_contact_phone: tenant?.emergency_contact_phone ?? null,
                        emergency_contact_relationship:
                          tenant?.emergency_contact_relationship ?? null,
                      }}
                    />
                  </>
                ) : null}
              </>
            ) : (
              <div className="border-border text-muted-foreground rounded-lg border p-4 text-sm">
                No contact found.
              </div>
            )}
          </div>
          <div>
            <div className="border-primary/30 bg-primary/5 rounded-lg border p-4 text-sm">
              <Body className="mb-1 font-medium">{primaryLeaseHeadline}</Body>
              {primaryLease ? (
                <>
                  <div className="space-y-1">
                    <Link
                      href={`/leases/${primaryLease.id}`}
                      className="text-primary font-medium hover:underline"
                    >
                      {primaryLease.unitName || primaryLease.propertyUnit || 'View lease'}
                    </Link>
                    <Body tone="muted" size="sm">
                      {primaryLease.type || '—'}
                    </Body>
                  </div>
                  <Body tone="muted" size="sm" className="mt-2">
                    {fmtDate(primaryLease.start)} – {fmtDate(primaryLease.end)}
                  </Body>
                  <div className="border-border my-3 border-t" />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Body as="span">Balance:</Body>
                      <Body as="span" className="font-semibold">
                        {fmtUsd(primaryLeaseBalances.balance)}
                      </Body>
                    </div>
                    <div className="flex items-center justify-between">
                      <Body as="span">Prepayments:</Body>
                      <Body as="span" className="font-medium">
                        {fmtUsd(primaryLeaseBalances.prepayments)}
                      </Body>
                    </div>
                    <div className="flex items-center justify-between">
                      <Body as="span">Deposits held:</Body>
                      <Body as="span" className="font-medium">
                        {fmtUsd(Math.abs(primaryLeaseBalances.depositsHeld))}
                      </Body>
                    </div>
                    <div className="flex items-center justify-between">
                      <Body as="span">Rent:</Body>
                      <Body as="span" className="font-medium">
                        {fmtUsd(primaryLease.rent)}
                      </Body>
                    </div>
                  </div>
                  <Body tone="muted" size="sm" className="mt-3">
                    Payment is due on the 1st of the month. If payment isn't received, a one-time
                    fee of $50.00 will be charged on the 2nd of each month. An additional daily fee
                    of $10.00 will be charged starting on the 3rd and continue until the month ends.
                    Late fees will never exceed $100.00 per month.
                  </Body>
                  <div className="mt-3 flex items-center justify-between">
                    <Button variant="secondary" disabled>
                      Receive payment
                    </Button>
                    <Link
                      href={`/leases/${primaryLease.id}?tab=financials`}
                      className="text-primary hover:underline"
                    >
                      Lease ledger
                    </Link>
                  </div>
                </>
              ) : (
                <Body tone="muted">Add a lease to see details here.</Body>
              )}
            </div>
          </div>
        </div>

        {/* Constrain tables to the same width as the contact info card by using the same grid layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="space-y-4">
              <Heading as="h2" size="h3">
                Leases
              </Heading>
              <div className="border-border rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Start - End</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Rent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leases.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground text-sm">
                          No leases for this tenant.
                        </TableCell>
                      </TableRow>
                    ) : (
                      leases.map((l) => (
                        <TableRow key={l.id} className="hover:bg-muted/60">
                          <TableCell className="text-sm">{l.status || '—'}</TableCell>
                          <TableCell className="text-sm">
                            <Link href={`/leases/${l.id}`} className="text-primary hover:underline">
                              {fmtDate(l.start)} – {fmtDate(l.end)}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm">
                            {l.unitName || l.propertyUnit || '—'}
                          </TableCell>
                          <TableCell className="text-sm">{l.type || '—'}</TableCell>
                          <TableCell className="text-sm">{fmtUsd(l.rent)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <RecentNotesSection tenantId={id} />

            <RecentFilesSection
              tenantId={tenantId}
              buildiumTenantId={buildiumTenantId}
              orgId={orgId}
              uploaderName={name}
            />
          </div>
          <div className="hidden lg:block" />
        </div>
      </NavTabsContent>

      <NavTabsContent value="communications" className="space-y-6">
        <div className="border-border text-muted-foreground rounded-md border p-4 text-sm">
          No communications yet.
        </div>
      </NavTabsContent>
      <NavTabsContent value="files" className="space-y-6">
        <TenantFilesPanel {...tenantFilesPanelProps} />
      </NavTabsContent>
      <NavTabsContent value="notes" className="space-y-6">
        <TenantNotesTable tenantId={id} />
      </NavTabsContent>
    </NavTabs>
  );
}

// (client component moved to src/components/tenants/EditContactButton.tsx)
