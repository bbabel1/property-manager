import { supabase, supabaseAdmin } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import TenantContactInlineEditor from '@/components/tenants/TenantContactInlineEditor'
import TenantPersonalInfoInlineEditor from '@/components/tenants/TenantPersonalInfoInlineEditor'
import TenantEmergencyContactInlineEditor from '@/components/tenants/TenantEmergencyContactInlineEditor'
import TenantFilesPanel from '@/components/tenants/TenantFilesPanel'
import TenantNotesTable from '@/components/tenants/TenantNotesTable'
import RecentNotesSection from '@/components/tenants/RecentNotesSection'
import RecentFilesSection from '@/components/tenants/RecentFilesSection'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import LeaseRowLink from '@/components/tenants/LeaseRowLink'

type ContactDetails = {
  first_name?: string | null
  last_name?: string | null
  display_name?: string | null
  company_name?: string | null
  is_company?: boolean | null
  primary_email?: string | null
  alt_email?: string | null
  primary_phone?: string | null
  alt_phone?: string | null
  date_of_birth?: string | null
  mailing_preference?: string | null
  primary_address_line_1?: string | null
  primary_address_line_2?: string | null
  primary_address_line_3?: string | null
  primary_city?: string | null
  primary_state?: string | null
  primary_postal_code?: string | null
  primary_country?: string | null
  alt_address_line_1?: string | null
  alt_address_line_2?: string | null
  alt_address_line_3?: string | null
  alt_city?: string | null
  alt_state?: string | null
  alt_postal_code?: string | null
  alt_country?: string | null
}

type ContactQueryRow = { contact: ContactDetails | null } | null

type LeaseContactRow = {
  role: string
  status: string
  lease: {
    id: number
    lease_from_date: string | null
    lease_to_date: string | null
    lease_type: string | null
    rent_amount: number | null
    property_id: number | null
    unit_id: number | null
  } | null
}

function fmtDate(value?: string | null) {
  if (!value) return '—'
  try { return new Date(value).toLocaleDateString() } catch { return '—' }
}

function fmtUsd(n?: number | null) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)
}

export default async function TenantDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = supabaseAdmin || supabase

  const [{ data: tenant }, { data: contact }, { data: leaseContacts }] = await Promise.all([
    db.from('tenants').select('*').eq('id', id).maybeSingle(),
    db.from('tenants').select('contact:contact_id ( first_name, last_name, display_name, company_name, is_company, primary_email, alt_email, primary_phone, alt_phone, date_of_birth, mailing_preference, primary_address_line_1, primary_address_line_2, primary_address_line_3, primary_city, primary_state, primary_postal_code, primary_country, alt_address_line_1, alt_address_line_2, alt_address_line_3, alt_city, alt_state, alt_postal_code, alt_country )').eq('id', id).maybeSingle(),
    db.from('lease_contacts').select('role, status, lease_id, move_in_date, tenants!inner( id ), lease!inner( id, lease_from_date, lease_to_date, lease_type, rent_amount, property_id, unit_id )').eq('tenant_id', id)
  ])

  const contactRow = contact as ContactQueryRow
  const contactInfo = contactRow?.contact || null
  const name = contactInfo?.display_name || [contactInfo?.first_name, contactInfo?.last_name].filter(Boolean).join(' ') || 'Tenant'

  const leases: Array<{
    id: number; start: string | null; end: string | null; type: string | null; rent: number | null; propertyUnit: string | null; status: string; unitName: string | null
  }> = []
  if (Array.isArray(leaseContacts)) {
    for (const row of leaseContacts as LeaseContactRow[]) {
      const lease = row?.lease
      if (!lease) continue
      // Resolve property/unit display
      let propertyUnit: string | null = null
      let unitRow: any = null
      try {
        const [{ data: propertyRow }, { data: unitData }] = await Promise.all([
          db.from('properties').select('name').eq('id', lease.property_id).maybeSingle(),
          db.from('units').select('unit_number, unit_name').eq('id', lease.unit_id).maybeSingle(),
        ])
        unitRow = unitData
        if (propertyRow?.name) propertyUnit = propertyRow.name
        if (unitRow?.unit_number) propertyUnit = propertyUnit ? `${propertyUnit} - ${unitRow.unit_number}` : unitRow.unit_number
      } catch {}
      leases.push({ id: lease.id, start: lease.lease_from_date, end: lease.lease_to_date, type: lease.lease_type, rent: lease.rent_amount, propertyUnit, status: row.status, unitName: unitRow?.unit_name || null })
    }
  }

  // Choose a primary lease to highlight (most recent by start date)
  const primaryLease = leases
    .slice()
    .sort((a, b) => {
      const ad = a.start ? new Date(a.start).getTime() : 0
      const bd = b.start ? new Date(b.start).getTime() : 0
      return bd - ad
    })[0]

  return (
    <Tabs defaultValue="summary" className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">{name}</h1>
            {tenant?.buildium_tenant_id
              ? <Badge variant="secondary" className="text-xs">Buildium ID: {tenant.buildium_tenant_id}</Badge>
              : <Badge variant="outline" className="text-xs">Not in Buildium</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {primaryLease
              ? `${primaryLease.status || ''} | ${contactInfo?.primary_address_line_1 || '—'} - ${primaryLease.unitName || '—'}`
              : `${[
                  contactInfo?.primary_address_line_1 || '—',
                  contactInfo?.primary_city || null,
                  contactInfo?.primary_state || null,
                ]
                  .filter(Boolean)
                  .join(', ')} ${contactInfo?.primary_postal_code || ''}`}
          </p>
        </div>
      </div>
      <div className="mt-4 border-b border-border">
        <TabsList className="flex items-center space-x-8 bg-transparent p-0 text-muted-foreground h-auto rounded-none">
          <TabsTrigger
            value="summary"
            className="flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pb-3 pt-2 text-sm font-medium transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none hover:border-muted-foreground hover:text-foreground"
          >
            Summary
          </TabsTrigger>
          <TabsTrigger value="communications" className="flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pb-3 pt-2 text-sm font-medium transition-colors data-[state=active]:border-primary data-[state=active]:text-primary">Communications</TabsTrigger>
          <TabsTrigger value="files" className="flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pb-3 pt-2 text-sm font-medium transition-colors data-[state=active]:border-primary data-[state=active]:text-primary">Files</TabsTrigger>
          <TabsTrigger value="notes" className="flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pb-3 pt-2 text-sm font-medium transition-colors data-[state=active]:border-primary data-[state=active]:text-primary">Notes</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="summary" className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {tenant?.contact_id ? (
            <>
              <TenantContactInlineEditor contactId={Number(tenant.contact_id)} initial={contactInfo || {}} />
              {tenant?.id ? (
                <>
                  <TenantPersonalInfoInlineEditor
                    tenantId={String(tenant.id)}
                    contactId={Number(tenant.contact_id)}
                    initial={{
                      date_of_birth: contactInfo?.date_of_birth ?? null,
                      tax_id: tenant?.tax_id ?? null,
                      comment: tenant?.comment ?? null
                    }}
                  />
                  <TenantEmergencyContactInlineEditor
                    tenantId={String(tenant.id)}
                    initial={{
                      emergency_contact_name: tenant?.emergency_contact_name ?? null,
                      emergency_contact_email: tenant?.emergency_contact_email ?? null,
                      emergency_contact_phone: tenant?.emergency_contact_phone ?? null,
                      emergency_contact_relationship: tenant?.emergency_contact_relationship ?? null
                    }}
                  />
                </>
              ) : null}
            </>
          ) : (
            <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">No contact found.</div>
          )}
        </div>
        <div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
            <div className="mb-1 font-medium text-foreground">{primaryLease ? 'Future lease' : 'No lease'}</div>
            {primaryLease ? (
              <>
                <Link href={`/leases/${primaryLease.id}`} className="text-primary hover:underline">{primaryLease.unitName || 'View lease'}</Link>
                <div className="mt-2 text-muted-foreground">{primaryLease.type || '—'}</div>
                <div className="mb-3 text-muted-foreground">{fmtDate(primaryLease.start)} - {fmtDate(primaryLease.end)}</div>
                <div className="my-2 border-b border-border"></div>
                <div className="mb-2 flex items-center justify-between"><span className="text-foreground">Balance:</span><span className="font-semibold text-foreground">{fmtUsd(0)}</span></div>
                <div className="mb-2 flex items-center justify-between"><span className="text-foreground">Prepayments:</span><span className="font-medium">{fmtUsd(0)}</span></div>
                <div className="mb-2 flex items-center justify-between"><span className="text-foreground">Deposits held:</span><span className="font-medium">{fmtUsd(0)}</span></div>
                <div className="mb-2 flex items-center justify-between"><span className="text-foreground">Rent:</span><span className="font-medium">{fmtUsd(primaryLease.rent)}</span></div>
                <p className="mt-3 text-muted-foreground">Payment is due on the 1st of the month. If payment isn't received, a one-time fee of $50.00 will be charged on the 2nd of each month. An additional daily fee of $10.00 will be charged starting on the 3rd and continue until the month ends. Late fees will never exceed $100.00 per month.</p>
                <div className="mt-3 flex items-center justify-between">
                  <Button variant="secondary" disabled>Receive payment</Button>
                  <Link href={`/leases/${primaryLease.id}?tab=financials`} className="text-primary hover:underline">Lease ledger</Link>
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
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Leases</h2>
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader className="bg-muted">
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
                    <TableCell colSpan={5} className="text-sm text-muted-foreground">No leases for this tenant.</TableCell>
                  </TableRow>
                ) : leases.map((l) => (
                  <LeaseRowLink key={l.id} href={`/leases/${l.id}`}>
                    <TableCell className="text-sm">Current</TableCell>
                    <TableCell className="text-sm">
                      <span className="text-primary hover:underline">{fmtDate(l.start)} – {fmtDate(l.end)}</span>
                    </TableCell>
                    <TableCell className="text-sm">{l.unitName || '—'}</TableCell>
                    <TableCell className="text-sm">{l.type || '—'}</TableCell>
                    <TableCell className="text-sm">{fmtUsd(l.rent)}</TableCell>
                  </LeaseRowLink>
                ))}
              </TableBody>
              </Table>
            </div>
          </div>

          <RecentNotesSection tenantId={id} />

          <RecentFilesSection tenantId={id} />
        </div>
        <div className="hidden lg:block" />
      </div>
      </TabsContent>

      <TabsContent value="communications" className="space-y-6">
        <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">No communications yet.</div>
      </TabsContent>
      <TabsContent value="files" className="space-y-6">
        <TenantFilesPanel tenantId={tenant?.id ?? null} uploaderName={name} />
      </TabsContent>
      <TabsContent value="notes" className="space-y-6">
        <TenantNotesTable tenantId={id} />
      </TabsContent>
    </Tabs>
  )
}

// (client component moved to src/components/tenants/EditContactButton.tsx)
