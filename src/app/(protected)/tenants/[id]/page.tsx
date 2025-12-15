import Link from 'next/link';

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

  return (
    <NavTabs defaultValue="summary" className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-foreground text-2xl font-semibold">{name}</h1>
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
          <p className="text-muted-foreground text-sm">{primaryLeaseSubtitle}</p>
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
              <div className="text-foreground mb-1 font-medium">{primaryLeaseHeadline}</div>
              {primaryLease ? (
                <>
                  <div className="space-y-1">
                    <Link
                      href={`/leases/${primaryLease.id}`}
                      className="text-primary font-medium hover:underline"
                    >
                      {primaryLease.unitName || primaryLease.propertyUnit || 'View lease'}
                    </Link>
                    <div className="text-muted-foreground">{primaryLease.type || '—'}</div>
                  </div>
                  <div className="text-muted-foreground mt-2">
                    {fmtDate(primaryLease.start)} – {fmtDate(primaryLease.end)}
                  </div>
                  <div className="border-border my-3 border-t" />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground">Balance:</span>
                      <span className="text-foreground font-semibold">{fmtUsd(0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground">Prepayments:</span>
                      <span className="font-medium">{fmtUsd(0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground">Deposits held:</span>
                      <span className="font-medium">{fmtUsd(0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground">Rent:</span>
                      <span className="font-medium">{fmtUsd(primaryLease.rent)}</span>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-3">
                    Payment is due on the 1st of the month. If payment isn't received, a one-time
                    fee of $50.00 will be charged on the 2nd of each month. An additional daily fee
                    of $10.00 will be charged starting on the 3rd and continue until the month ends.
                    Late fees will never exceed $100.00 per month.
                  </p>
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
                <div className="text-muted-foreground">Add a lease to see details here.</div>
              )}
            </div>
          </div>
        </div>

        {/* Constrain tables to the same width as the contact info card by using the same grid layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="space-y-4">
              <h2 className="text-foreground text-lg font-semibold">Leases</h2>
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

            <RecentFilesSection tenantId={id} />
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
        <TenantFilesPanel tenantId={tenant?.id ?? null} uploaderName={name} />
      </NavTabsContent>
      <NavTabsContent value="notes" className="space-y-6">
        <TenantNotesTable tenantId={id} />
      </NavTabsContent>
    </NavTabs>
  );
}

// (client component moved to src/components/tenants/EditContactButton.tsx)
