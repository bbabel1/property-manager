import { Fragment } from 'react'
import { endOfMonth, startOfMonth } from 'date-fns'
import DateRangeControls from '@/components/DateRangeControls'
import LedgerFilters from '@/components/financials/LedgerFilters'
import BillsFilters from '@/components/financials/BillsFilters'
import ClearFiltersButton from '@/components/financials/ClearFiltersButton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { supabase, supabaseAdmin } from '@/lib/db'

export default async function FinancialsTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ from?: string; to?: string; unit?: string; gl?: string; range?: string }>
}) {
  const { id } = await params
  const sp = (await (searchParams || Promise.resolve({}))) as any

  const today = new Date()
  const hasRangeParam = typeof sp?.range === 'string'
  const hasExplicitDates = typeof sp?.from === 'string' || typeof sp?.to === 'string'

  const defaultTo = endOfMonth(today)
  const defaultFrom = startOfMonth(today)

  const to = sp?.to ? new Date(sp.to) : defaultTo
  const from = sp?.from ? new Date(sp.from) : defaultFrom
  const range = hasRangeParam ? sp.range : hasExplicitDates ? 'custom' : 'currentMonth'
  const db = supabaseAdmin || supabase

  const unitsParam = typeof sp?.units === 'string' ? sp.units : typeof sp?.unit === 'string' ? sp.unit : ''
  const glParam = typeof sp?.gl === 'string' ? sp.gl : ''

  const { data: propertyRow } = await (db as any)
    .from('properties')
    .select('org_id')
    .eq('id', id)
    .maybeSingle()
  const orgId = propertyRow?.org_id ?? null

  const fromStr = from.toISOString().slice(0, 10)
  const toStr = to.toISOString().slice(0, 10)

  type Line = {
    date: string
    amount: number
    posting_type: string
    memo: string | null
    gl_account_id: string
    ga_name: string
    ga_number: string | null
    ga_type: string | null
    unit_label: string | null
    transaction_type: string | null
    transaction_memo: string | null
    transaction_reference: string | null
    created_at: string | null
  }

  const qBase = () =>
    (db as any)
      .from('transaction_lines')
      .select(
        `date,
         amount,
         posting_type,
         memo,
         gl_account_id,
         created_at,
         gl_accounts(name, account_number, type),
         units(unit_number, unit_name),
         transactions(transaction_type, memo, reference_number)`
      )
      .eq('property_id', id)

  const mapRow = (r: any): Line => ({
    date: r.date,
    amount: Number(r.amount || 0),
    posting_type: r.posting_type,
    memo: r.memo || null,
    gl_account_id: String(r.gl_account_id),
    ga_name: r.gl_accounts?.name || 'Unknown account',
    ga_number: r.gl_accounts?.account_number || null,
    ga_type: r.gl_accounts?.type || null,
    unit_label: r.units?.unit_number || r.units?.unit_name || null,
    transaction_type: r.transactions?.transaction_type || null,
    transaction_memo: r.transactions?.memo || null,
    transaction_reference: r.transactions?.reference_number || null,
    created_at: r.created_at || null,
  })

  const unitsResponse = await (db as any)
    .from('units')
    .select('id, unit_number, unit_name')
    .eq('property_id', id)

  let accountsQuery = (db as any)
    .from('gl_accounts')
    .select('id, name, account_number, type')
    .order('type', { ascending: true })
    .order('name', { ascending: true })
  if (orgId) {
    accountsQuery = accountsQuery.eq('org_id', orgId)
  }
  const accountsResponse = await accountsQuery

  const unitOptions: { id: string; label: string }[] = (unitsResponse?.data || []).map((u: any) => ({
    id: String(u.id),
    label: u.unit_number || u.unit_name || 'Unit',
  })).sort((a, b) => a.label.localeCompare(b.label))

  const accountOptions = (accountsResponse?.data || []).map((acc: any) => ({
    value: String(acc.id),
    label: [acc.name, acc.account_number ? `(${acc.account_number})` : ''].filter(Boolean).join(' '),
    group: acc.type || 'Other',
    groupLabel: acc.type ? `${acc.type} accounts` : 'Other accounts',
  })).sort((a, b) => (a.group || 'Other').localeCompare(b.group || 'Other') || a.label.localeCompare(b.label))

  const allUnitIds = unitOptions.map((opt) => opt.id)
  const noUnitsSelected = unitsParam === 'none'

  let selectedUnitIds: string[]
  if (noUnitsSelected) {
    selectedUnitIds = []
  } else if (unitsParam) {
    selectedUnitIds = unitsParam
      .split(',')
      .map((id: string) => id.trim())
      .filter((id: string) => allUnitIds.includes(id))
  } else {
    selectedUnitIds = [...allUnitIds]
  }

  const unitFilterIds = noUnitsSelected
    ? []
    : selectedUnitIds.length === 0 || selectedUnitIds.length === allUnitIds.length
      ? null
      : selectedUnitIds

  const allAccountIds = accountOptions.map((opt) => opt.value)
  let selectedAccountIds = glParam
    ? glParam.split(',').map((id) => id.trim()).filter((id) => allAccountIds.includes(id))
    : [...allAccountIds]
  if (selectedAccountIds.length === 0) selectedAccountIds = [...allAccountIds]
  const accountFilterIds = selectedAccountIds.length === allAccountIds.length ? null : selectedAccountIds

  let periodLines: Line[] = []
  let priorLines: Line[] = []

  if (!noUnitsSelected) {
    let qPeriod = qBase().gte('date', fromStr).lte('date', toStr)
    if (unitFilterIds) qPeriod = qPeriod.in('unit_id', unitFilterIds)
    if (accountFilterIds) qPeriod = qPeriod.in('gl_account_id', accountFilterIds)
    const { data: periodData, error: periodError } = await qPeriod
    periodLines = periodError ? [] : (periodData || []).map(mapRow)

    let qPrior = qBase().lt('date', fromStr)
    if (unitFilterIds) qPrior = qPrior.in('unit_id', unitFilterIds)
    if (accountFilterIds) qPrior = qPrior.in('gl_account_id', accountFilterIds)
    const { data: priorData, error: priorError } = await qPrior
    priorLines = priorError ? [] : (priorData || []).map(mapRow)
  }

  type Group = {
    id: string
    name: string
    number: string | null
    type: string | null
    prior: number
    net: number
    lines: { line: Line; signed: number }[]
  }

  const groupMap = new Map<string, Group>()
  const ensureGroup = (line: Line): Group => {
    const key = line.gl_account_id
    const existing = groupMap.get(key)
    if (existing) return existing
    const created: Group = {
      id: key,
      name: line.ga_name,
      number: line.ga_number,
      type: line.ga_type,
      prior: 0,
      net: 0,
      lines: [],
    }
    groupMap.set(key, created)
    return created
  }

  const signedAmount = (line: Line) => ((line.posting_type || '').toLowerCase() === 'debit' ? line.amount : -line.amount)

  for (const line of priorLines) {
    const group = ensureGroup(line)
    group.prior += signedAmount(line)
  }

  for (const line of periodLines) {
    const group = ensureGroup(line)
    const signed = signedAmount(line)
    group.net += signed
    group.lines.push({ line, signed })
  }

  const groups = Array.from(groupMap.values()).sort((a, b) => {
    const typeA = a.type || 'Other'
    const typeB = b.type || 'Other'
    const typeCmp = typeA.localeCompare(typeB)
    if (typeCmp !== 0) return typeCmp
    return a.name.localeCompare(b.name)
  })

  const fmt = (n: number) => `$${Number(Math.abs(n || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtSigned = (n: number) => (n < 0 ? `(${fmt(n)})` : fmt(n))
  const dateFmt = new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  })

  const emptyStateMessage = noUnitsSelected
    ? 'Select at least one unit to view ledger activity.'
    : 'No activity for the selected period.'

  return (
    <div id="panel-financials" role="tabpanel" aria-labelledby="financials" className="space-y-6">
      <Tabs defaultValue="ledger" className="space-y-6">
        <TabsList className="bg-transparent p-0 border-b border-border rounded-none h-auto">
          <TabsTrigger value="ledger" className="rounded-none border-0 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary px-3 py-2 text-sm font-medium">
            Ledger
          </TabsTrigger>
          <TabsTrigger value="bills" className="rounded-none border-0 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary px-3 py-2 text-sm font-medium">
            Bills
          </TabsTrigger>
        </TabsList>
        <TabsContent value="ledger">
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <LedgerFilters
              defaultUnitIds={selectedUnitIds}
              defaultGlIds={selectedAccountIds}
              unitOptions={unitOptions}
              accountOptions={accountOptions}
              noUnitsSelected={noUnitsSelected}
            />
            <DateRangeControls defaultFrom={from} defaultTo={to} defaultRange={range} />
            <ClearFiltersButton />
          </div>
          <div className="border-t border-border" />
          <div className="rounded-lg border border-border shadow-sm overflow-hidden mt-4">
            <Table className="text-sm">
              <TableHeader className="bg-muted/60">
                <TableRow className="border-b border-border">
                  <TableHead className="w-[12rem] text-muted-foreground">Date (cash basis)</TableHead>
                  <TableHead className="w-[8rem] text-muted-foreground">Unit</TableHead>
                  <TableHead className="text-muted-foreground">Transaction</TableHead>
                  <TableHead className="text-muted-foreground">Memo</TableHead>
                  <TableHead className="text-right w-[10rem] text-muted-foreground">Amount</TableHead>
                  <TableHead className="text-right w-[10rem] text-muted-foreground">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border">
                {groups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                      {emptyStateMessage}
                    </TableCell>
                  </TableRow>
                ) : (
                  groups.map((group) => {
                    const detail = group.lines
                      .sort((a, b) => {
                        const dateCmp = a.line.date.localeCompare(b.line.date)
                        if (dateCmp !== 0) return dateCmp
                        return (a.line.created_at || '').localeCompare(b.line.created_at || '')
                      })

                    let running = group.prior

                    return (
                      <Fragment key={group.id}>
                        <TableRow className="bg-muted/40">
                          <TableCell colSpan={6} className="text-primary font-medium">
                            <span className="mr-2 text-muted-foreground">—</span>
                            {group.name}
                            {group.number ? (
                              <span className="ml-2 text-xs text-muted-foreground">{group.number}</span>
                            ) : null}
                            {group.type ? (
                              <span className="ml-3 text-xs uppercase text-muted-foreground">{group.type}</span>
                            ) : null}
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-background">
                          <TableCell colSpan={5} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Prior balance
                          </TableCell>
                          <TableCell className="text-right font-semibold text-muted-foreground">{fmtSigned(group.prior)}</TableCell>
                        </TableRow>
                        {detail.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-4 text-center text-sm text-muted-foreground">
                              No activity in selected period.
                            </TableCell>
                          </TableRow>
                        ) : (
                          detail.map(({ line, signed }, idx) => {
                            running += signed
                            const txnLabel = [
                              line.transaction_type || 'Transaction',
                              line.transaction_reference ? `#${line.transaction_reference}` : '',
                            ]
                              .filter(Boolean)
                              .join(' ')
                            const memo = line.memo || line.transaction_memo || '—'
                            return (
                              <TableRow key={`${group.id}-${line.date}-${idx}`}>
                                <TableCell>{dateFmt.format(new Date(line.date))}</TableCell>
                                <TableCell>{line.unit_label || '—'}</TableCell>
                                <TableCell>{txnLabel || '—'}</TableCell>
                                <TableCell>{memo}</TableCell>
                                <TableCell className={`text-right font-medium ${signed < 0 ? 'text-destructive' : ''}`}>
                                  {fmtSigned(signed)}
                                </TableCell>
                                <TableCell className="text-right font-medium">{fmtSigned(running)}</TableCell>
                              </TableRow>
                            )
                          })
                        )}
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={4} className="font-semibold">
                            Total {group.name}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-foreground">{fmtSigned(group.net)}</TableCell>
                          <TableCell className="text-right font-semibold text-foreground">
                            {fmtSigned(group.prior + group.net)}
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="bills" className="space-y-6">
          {/* Bills Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button">Record bill</Button>
            <Button type="button" variant="outline">Pay bills</Button>
            <Button type="button" variant="outline">Request owner contribution</Button>
            <Button type="button" variant="outline">Approve in bulk</Button>
          </div>

          {await (async () => {
            // Units for bills reuse unitOptions
            const unitIdsAll = unitOptions.map((u) => u.id)

            // Vendors options
            let vendorsQuery = (db as any)
              .from('vendors')
              .select('id, contact:contacts!vendors_contact_id_fkey(display_name, company_name, first_name, last_name)')
              .order('updated_at', { ascending: false })
              .limit(200)
            if (orgId) vendorsQuery = vendorsQuery.eq('org_id', orgId)
            const { data: vendorsData } = await vendorsQuery
            const nameOfVendor = (v: any) =>
              v?.contact?.display_name || v?.contact?.company_name || [v?.contact?.first_name, v?.contact?.last_name].filter(Boolean).join(' ') || 'Vendor'
            const vendorOptions = (vendorsData || []).map((v: any) => ({ id: String(v.id), label: nameOfVendor(v) }))
              .sort((a: any, b: any) => a.label.localeCompare(b.label))

            // Parse filters
            const spVendors = typeof sp?.vendors === 'string' ? sp.vendors : ''
            const spBStatus = typeof sp?.bstatus === 'string' ? sp.bstatus : ''

            let selectedUnitIdsBills: string[]
            if (unitsParam === 'none') selectedUnitIdsBills = []
            else if (unitsParam) selectedUnitIdsBills = unitsParam.split(',').map((s: string) => s.trim()).filter((s: string) => unitIdsAll.includes(s))
            else selectedUnitIdsBills = [...unitIdsAll]

            const allVendorIds = vendorOptions.map((v) => v.id)
            let selectedVendorIds = spVendors ? spVendors.split(',').map((s: string) => s.trim()).filter((s: string) => allVendorIds.includes(s)) : [...allVendorIds]
            if (selectedVendorIds.length === 0) selectedVendorIds = [...allVendorIds]

            const allStatuses = ['overdue','pending','partiallypaid','paid','cancelled']
            let selectedStatuses = spBStatus ? spBStatus.split(',').map((s: string) => s.trim().toLowerCase()).filter((s: string) => allStatuses.includes(s)) : ['overdue','pending','partiallypaid']
            if (selectedStatuses.length === 0) selectedStatuses = ['overdue','pending','partiallypaid']

            // Fetch matching transaction ids for this property (via lines)
            let qLine = (db as any).from('transaction_lines').select('transaction_id, unit_id').eq('property_id', id)
            if (selectedUnitIdsBills.length && selectedUnitIdsBills.length !== unitIdsAll.length) {
              qLine = qLine.in('unit_id', selectedUnitIdsBills)
            }
            const { data: linesData } = await qLine
            const txIds = Array.from(new Set((linesData || []).map((r: any) => r.transaction_id).filter(Boolean)))

            let billRows: any[] = []
            if (txIds.length) {
              let qTx = (db as any)
                .from('transactions')
                .select('id, date, due_date, total_amount, status, memo, reference_number, vendor_id, transaction_type')
                .in('id', txIds)
                .eq('transaction_type', 'Bill')
                .order('due_date', { ascending: true })

              if (selectedVendorIds.length && selectedVendorIds.length !== allVendorIds.length) {
                qTx = qTx.in('vendor_id', selectedVendorIds)
              }

              const { data: txData } = await qTx
              const todayIso = new Date().toISOString().slice(0, 10)
              billRows = (txData || []).filter((row: any) => {
                const status = String(row.status || '').toLowerCase()
                const isOverdue = (row.due_date || '') < todayIso && status !== 'paid' && status !== 'cancelled'
                const matchOverdue = selectedStatuses.includes('overdue') && isOverdue
                const matchExplicit = selectedStatuses.includes(status)
                return matchOverdue || matchExplicit
              })
            }

            const vendorMap = new Map<string, string>()
            for (const v of vendorOptions) vendorMap.set(v.id, v.label)

            const countLabel = `${billRows.length} match${billRows.length === 1 ? '' : 'es'}`

            const formatStatus = (value: any) => {
              if (!value) return '—'
              const normalized = String(value)
              return normalized
                .replace(/([a-z])([A-Z])/g, '$1 $2')
                .replace(/_/g, ' ')
                .toLowerCase()
                .replace(/\b\w/g, (char) => char.toUpperCase())
            }

            // Render
            return (
              <div className="space-y-4">
                <div className="mb-2 flex flex-wrap items-end gap-4">
                  <BillsFilters
                    defaultUnitIds={selectedUnitIdsBills}
                    defaultVendorIds={selectedVendorIds}
                    defaultStatuses={selectedStatuses}
                    unitOptions={unitOptions}
                    vendorOptions={vendorOptions}
                  />
                  <div className="pb-2 ml-auto text-sm text-muted-foreground">{countLabel}</div>
                </div>
                <div className="rounded-lg border border-border shadow-sm overflow-hidden">
                  <Table className="text-sm">
                    <TableHeader className="bg-muted/60">
                      <TableRow className="border-b border-border">
                        <TableHead className="w-[12rem] text-muted-foreground">Due date</TableHead>
                        <TableHead className="w-[10rem] text-muted-foreground">Status</TableHead>
                        <TableHead className="w-[16rem] text-muted-foreground">Vendors</TableHead>
                        <TableHead className="text-muted-foreground">Memo</TableHead>
                        <TableHead className="w-[10rem] text-muted-foreground">Ref No.</TableHead>
                        <TableHead className="w-[12rem] text-muted-foreground">Approval status</TableHead>
                        <TableHead className="text-right w-[10rem] text-muted-foreground">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-border">
                      {billRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                            We didn't find any bills. Maybe you don't have any or maybe you need to clear your filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        billRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{row.due_date ? new Date(row.due_date).toLocaleDateString() : '—'}</TableCell>
                            <TableCell>{formatStatus(row.status)}</TableCell>
                            <TableCell className="text-foreground">{vendorMap.get(String(row.vendor_id)) || '—'}</TableCell>
                            <TableCell className="text-foreground">{row.memo || '—'}</TableCell>
                            <TableCell>{row.reference_number || '—'}</TableCell>
                            <TableCell className="text-muted-foreground">—</TableCell>
                            <TableCell className="text-right">
                              {`$${Number(Math.abs(row.total_amount || 0)).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )
          })()}
        </TabsContent>
      </Tabs>
    </div>
  )
}
