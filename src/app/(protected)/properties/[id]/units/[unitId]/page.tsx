export const dynamic = 'force-dynamic'
export const revalidate = 0

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PropertyService } from '@/lib/property-service'
import { supabase as supaClient, supabaseAdmin } from '@/lib/db'
import UnitDetailsCard from '@/components/unit/UnitDetailsCard'
import UnitFinancialServicesCard from '@/components/unit/UnitFinancialServicesCard'
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
  const tenantNamesByLease: Record<string, string[]> = {}
  if (unit?.id) {
    try {
      const { data: leaseRows } = await db
        .from('lease')
        .select('id, lease_from_date, lease_to_date, status, rent_amount, buildium_lease_id, sync_status, last_sync_error, last_sync_attempt_at')
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

  // Fetch transactions tied to this unit's leases for local balance computation
  let transactions: any[] = []
  if (leases.length) {
    const leaseIds = leases
      .map((l: any) => {
        const raw = l?.id
        if (typeof raw === 'number' && Number.isFinite(raw)) return raw
        if (typeof raw === 'string' && raw.trim() !== '') {
          const parsed = Number(raw)
          if (Number.isFinite(parsed)) return parsed
        }
        return null
      })
      .filter((id): id is number => id != null)

    const buildiumLeaseIds = leases
      .map((l: any) => {
        const raw = l?.buildium_lease_id
        if (typeof raw === 'number' && Number.isFinite(raw)) return raw
        if (typeof raw === 'string' && raw.trim() !== '') {
          const parsed = Number(raw)
          if (Number.isFinite(parsed)) return parsed
        }
        return null
      })
      .filter((id): id is number => id != null)

    const byId = new Map<string, any>()
    let tempId = 0
    const collect = (rows?: any[] | null) => {
      if (!Array.isArray(rows)) return
      for (const row of rows) {
        if (!row) continue
        const key = row.id ? String(row.id) : row.buildium_transaction_id != null ? `buildium:${row.buildium_transaction_id}` : `tmp:${tempId++}`
        if (!byId.has(key)) byId.set(key, row)
      }
    }

    try {
      if (leaseIds.length) {
        const { data } = await db
          .from('transactions')
          .select('id, date, total_amount, memo, transaction_type, buildium_transaction_id, buildium_lease_id, lease_id')
          .in('lease_id', leaseIds as any)
        collect(data)
      }
    } catch {}

    try {
      if (buildiumLeaseIds.length) {
        const { data } = await db
          .from('transactions')
          .select('id, date, total_amount, memo, transaction_type, buildium_transaction_id, buildium_lease_id, lease_id')
          .in('buildium_lease_id', buildiumLeaseIds as any)
        collect(data)
      }
    } catch {}

    transactions = Array.from(byId.values())
  }

  // Calculate unit-specific balance from the active lease
  // Prefer DB-maintained columns on the unit when present
  let unitBalance = typeof (unit as any)?.balance === 'number' ? Number((unit as any).balance) : 0
  let activeLeaseRent: number | null = null
  let activeLeaseId: string | null = null
  let depositsHeld = typeof (unit as any)?.deposits_held_balance === 'number' ? Number((unit as any).deposits_held_balance) : 0
  let prepayments = typeof (unit as any)?.prepayments_balance === 'number' ? Number((unit as any).prepayments_balance) : 0
  
  if (leases.length > 0) {
    // Get the most recent active lease
    const activeLease = leases.find(l => l.status?.toLowerCase() === 'active' || l.status?.toLowerCase() === 'current') || leases[0]
    activeLeaseRent = activeLease?.rent_amount || null
    activeLeaseId = activeLease?.id || null

    // If deposits weren't derived from unit columns, use lease metadata
    if (!depositsHeld) depositsHeld = Number((activeLease as any)?.security_deposit ?? 0) || 0

    const determineSignedAmount = (tx: any) => {
      const rawAmount = tx?.TotalAmount ?? tx?.total_amount ?? 0
      const amount = Number(rawAmount) || 0
      const type = String(tx?.TransactionTypeEnum || tx?.TransactionType || tx?.transaction_type || '').toLowerCase()
      if (!amount) return 0
      if (type.includes('payment') || type.includes('credit') || type.includes('refund') || type.includes('adjustment')) {
        return amount * -1
      }
      return amount
    }

    const relevantTransactions = Array.isArray(transactions)
      ? transactions.filter((tx) => {
          const leaseIdMatches = activeLease?.id != null && tx?.lease_id != null && String(tx.lease_id) === String(activeLease.id)
          const buildiumLeaseMatches = activeLease?.buildium_lease_id != null && tx?.buildium_lease_id != null && Number(tx.buildium_lease_id) === Number((activeLease as any).buildium_lease_id)
          return leaseIdMatches || buildiumLeaseMatches
        })
      : []

    const localBalance = relevantTransactions.length
      ? relevantTransactions.reduce((sum, tx) => sum + determineSignedAmount(tx), 0)
      : 0

    // Only override DB-maintained balance if it is missing (zero) and we have a local non-zero calculation
    if (!unitBalance && localBalance) unitBalance = localBalance

    // Supplement with transaction line analysis for prepayments / deposits and as a safety net for balance.
    let transactionLines: any[] = []
    try {
      const { data: lines } = await db
        .from('transaction_lines')
        .select('amount, posting_type, gl_account_id, gl_accounts(name, type, sub_type, is_bank_account, is_security_deposit_liability)')
        .eq('unit_id', unit.id)
      transactionLines = Array.isArray(lines) ? lines : []
    } catch {}

    if (!unitBalance && transactionLines.length) {
      let fallbackBalance = 0
      for (const line of transactionLines) {
        const amount = Number(line.amount) || 0
        const isDebit = line.posting_type === 'Debit'
        const subType = (line as any)?.gl_accounts?.sub_type
        if (subType === 'AccountsReceivable') {
          fallbackBalance += isDebit ? amount : -amount
        }
      }
      unitBalance = fallbackBalance
    }

    if (transactionLines.length) {
      let prepaymentBalance = 0
      let depositBalance = 0
      for (const line of transactionLines) {
        const amount = Number(line.amount) || 0
        if (!amount) continue
        const postingType = line.posting_type
        const account = (line as any).gl_accounts || {}
        const accountType = typeof account.type === 'string' ? account.type.toLowerCase() : null
        const accountName = typeof account.name === 'string' ? account.name.toLowerCase() : ''
        const subType = typeof account.sub_type === 'string' ? account.sub_type.toLowerCase() : ''
        const isCredit = postingType === 'Credit'
        const signed = isCredit ? amount : -amount

        const depositFlag = Boolean(account?.is_security_deposit_liability) || accountName.includes('deposit') || subType.includes('deposit')
        if (depositFlag) {
          depositBalance += signed
        }

        const prepayFlag = accountName.includes('prepay') || subType.includes('prepay') || (accountType === 'liability' && !depositFlag)
        if (prepayFlag) {
          prepaymentBalance += signed
        }
      }

      if (prepaymentBalance) prepayments = prepaymentBalance
      if (depositBalance) depositsHeld = depositBalance
    }
  }

  // Financial summary (unit-specific)
  const unitFin: Fin = {
    cash_balance: unitBalance,
    security_deposits: depositsHeld,
    reserve: 0,
    available_balance: unitBalance,
    as_of: new Date().toISOString().slice(0, 10)
  }

  const leaseItems = leases.map((l) => ({
    ...l,
    tenant_name: (tenantNamesByLease[String(l.id)] || []).join(', '),
  }))

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

          <LeaseSection leases={leaseItems} unit={unit} property={property} />

          <div className="space-y-6">
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
        </div>

        {/* Right rail: combined financial and services card */}
        <div className="space-y-6">
          <UnitFinancialServicesCard 
            fin={unitFin} 
            rent={activeLeaseRent} 
            prepayments={prepayments}
            property={property}
            unit={unit}
            leaseId={activeLeaseId}
          />
        </div>
      </div>

      {/* Bottom sections now live under the left column above */}
    </div>
  )
}
