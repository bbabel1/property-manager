import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PropertyService } from '@/lib/property-service'
import { supabase as supaClient, supabaseAdmin } from '@/lib/db'
import UnitDetailsCard from '@/components/unit/UnitDetailsCard'
import UnitBalanceCard from '@/components/unit/UnitBalanceCard'
import ManagementServicesCard from '@/components/property/ManagementServicesCard'
import LeaseSection from '@/components/units/LeaseSection'

type Fin = { cash_balance?: number; security_deposits?: number; reserve?: number; available_balance?: number; as_of?: string }

export default async function UnitDetailsNested({ params }: { params: Promise<{ id: string; unitId: string }> }) {
  const { id, unitId } = await params

  // Fetch property shell + units (server-side, cached by PropertyService)
  const property = await PropertyService.getPropertyById(id)

  // Try to find unit from property details; fallback to API
  let unit = property?.units?.find(u => String((u as any).id) === String(unitId)) as any
  if (!unit) {
    try {
      const res = await fetch(`/api/units/${unitId}`, { cache: 'no-store' })
      if (res.ok) unit = await res.json()
    } catch {}
  }

  // Load live leases and join tenant names (local DB)
  const db = supabaseAdmin || supaClient
  let leases: any[] = []
  let tenantNamesByLease: Record<string, string[]> = {}
  if (unit?.id) {
    try {
      const { data: leaseRows } = await db
        .from('lease')
        .select('id, lease_from_date, lease_to_date, status, rent_amount')
        .eq('unit_id', unit.id)
        .order('lease_from_date', { ascending: false })
      leases = Array.isArray(leaseRows) ? leaseRows : []
      const ids = leases.map((l:any)=>l.id)
      if (ids.length) {
        const { data: lcs } = await db
          .from('lease_contacts')
          .select('lease_id, tenants( id, contact:contacts(display_name, first_name, last_name, company_name, is_company) )')
          .in('lease_id', ids as any)
        if (Array.isArray(lcs)) {
          for (const row of lcs) {
            const contact = (row as any)?.tenants?.contact
            const name = contact?.display_name || contact?.company_name || [contact?.first_name, contact?.last_name].filter(Boolean).join(' ').trim() || 'Tenant'
            const key = String((row as any).lease_id)
            tenantNamesByLease[key] = [...(tenantNamesByLease[key] || []), name]
          }
        }
      }
    } catch {}
  }

  // Load locally stored appliances for this unit
  let appliances: any[] = []
  if (unit?.id) {
    try {
      const { data: appRows } = await db
        .from('appliances')
        .select('id, name, type, installation_date')
        .eq('unit_id', unit.id)
        .order('name')
      appliances = Array.isArray(appRows) ? appRows : []
    } catch {}
  }

  // Financial summary (property-level for now)
  let fin: Fin | undefined
  try {
    const today = new Date().toISOString().slice(0, 10)
    const res = await fetch(`/api/properties/${id}/financials?asOf=${today}`, { next: { revalidate: 60, tags: [`property-financials:${id}`] } })
    if (res.ok) fin = await res.json()
  } catch {}

  if (!property || !unit) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{!property ? 'Property not found.' : 'Unit not found.'}</CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column mirrors property summary */}
        <div className="space-y-6 lg:col-span-2">
          <UnitDetailsCard property={property} unit={unit} />

          {/* Below tables should match width of Unit Details card */}
          <LeaseSection leases={leases.map(l => ({ ...l, tenant_name: (tenantNamesByLease[String(l.id)] || []).join(', ') }))} unit={unit} property={property} />

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Appliances</h3>
              <Link href="#"><Button variant="outline" size="sm">Add</Button></Link>
            </div>
            <Card>
              <CardContent className="p-4">
                <div className="border rounded-md">
                  {appliances.length > 0 ? (
                    <>
                      <div className="px-4 py-3 flex items-center justify-between">
                        <Link href="#" className="text-primary hover:underline">{appliances[0]?.name || appliances[0]?.type || 'Appliance'}</Link>
                        <span className="text-xs text-muted-foreground">{(() => {
                          const d = appliances[0]?.installation_date
                          return d ? `Installed ${new Date(d).toLocaleDateString()}` : ''
                        })()}</span>
                      </div>
                      <div className="px-4 py-6 border-t text-sm text-muted-foreground">
                        {appliances.length > 1 ? `+ ${appliances.length - 1} more appliances` : 'No other appliances have been added to this unit.'}
                      </div>
                    </>
                  ) : (
                    <div className="px-4 py-6 text-sm text-muted-foreground">No appliances found for this unit.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-semibold text-foreground">Monthly Logs</h3>
              <Link href="#"><Button variant="outline" size="sm">Add</Button></Link>
            </div>
            <Card>
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={2} className="text-sm text-muted-foreground">No monthly logs have been recorded for this unit.</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Card>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-semibold text-foreground">Files</h3>
              <Link href="#"><Button variant="outline" size="sm">Add</Button></Link>
            </div>
            <Card>
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={3} className="text-sm text-muted-foreground">No files have been uploaded for this unit.</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Card>
          </section>
        </div>

        {/* Right rail: compact balance + management */}
        <div className="space-y-6">
          <UnitBalanceCard fin={fin} rent={(unit as any).market_rent ?? null} />
          <ManagementServicesCard property={property} />
        </div>
      </div>

      {/* Bottom sections now live under the left column above */}
    </div>
  )
}
