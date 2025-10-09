import Link from 'next/link'
import { randomUUID } from 'crypto'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import TenantMoveInEditor from '@/components/leases/TenantMoveInEditor'
import AddTenantButton from '@/components/leases/AddTenantButton'
import RemoveLeaseContactButton from '@/components/leases/RemoveLeaseContactButton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import LeaseHeaderMeta from '@/components/leases/LeaseHeaderMeta'
import InfoCard from '@/components/layout/InfoCard'
import { supabaseAdmin, supabase as supaClient } from '@/lib/db'
import RentTabInteractive from '@/components/leases/RentTabInteractive'
import RecurringTransactionsPanel from '@/components/leases/RecurringTransactionsPanel'
import LeaseLedgerPanel from '@/components/leases/LeaseLedgerPanel'
import { RentCycleEnumDb, RentScheduleStatusEnumDb } from '@/schemas/lease-api'
import { ArrowRight, ExternalLink, Mail, MoreHorizontal, Phone, Trash2 } from 'lucide-react'
import type { LeaseAccountOption } from '@/components/leases/types'

type LeaseDetailsPageParams = { id: string }

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : '—')
const fmtUsd = (n?: number | null) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)

export default async function LeaseDetailsPage({ params, searchParams }: { params: Promise<LeaseDetailsPageParams>, searchParams?: Promise<{ tab?: string }> }) {
  const { id } = await params
  const sp = searchParams ? await searchParams : undefined
  const initialTab = sp?.tab === 'financials' ? 'financials' : 'summary'
  // Use admin when available to avoid RLS mismatches between source pages and details page
  const supabase = supabaseAdmin || supaClient

  // Step 1: Load the base lease row first (avoid nested join issues)
  const numericId = Number(id)
  let lease: any = null
  let error: any = null
  try {
    const { data, error: e } = await (supabase as any)
      .from('lease')
      .select('id, status, lease_from_date, lease_to_date, lease_type, term_type, payment_due_day, rent_amount, security_deposit, buildium_lease_id, buildium_property_id, buildium_unit_id, property_id, unit_id')
      .eq('id', Number.isFinite(numericId) ? numericId : (id as any))
      .maybeSingle()
    lease = data
    error = e || null
    if (!lease && Number.isFinite(numericId)) {
      // Fallback: try string equality just in case of type coercion quirks
      const { data: data2 } = await (supabase as any)
        .from('lease')
        .select('id, status, lease_from_date, lease_to_date, lease_type, term_type, payment_due_day, rent_amount, security_deposit, buildium_lease_id, buildium_property_id, buildium_unit_id, property_id, unit_id')
        .eq('id', id as any)
        .maybeSingle()
      lease = data2
    }
  } catch (e: any) {
    error = e
  }

  if (!lease) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Lease not found.</CardContent>
        </Card>
      </div>
    )
  }

  // Step 2: Load related property + unit separately to avoid join failures
  let property: any = null
  let unit: any = null
  try {
    if (lease.property_id) {
      const { data: p } = await (supabase as any)
        .from('properties')
        .select('id, name, address_line1, city, state, postal_code, buildium_property_id')
        .eq('id', lease.property_id)
        .maybeSingle()
      property = p
    }
  } catch {}
  try {
    if (lease.unit_id) {
      const { data: u } = await (supabase as any)
        .from('units')
        .select('id, unit_number, status')
        .eq('id', lease.unit_id)
        .maybeSingle()
      unit = u
    }
  } catch {}

  // Step 3: Fetch contacts for header (tenant names)
  let contacts: any[] = []
  try {
    const { data: lc } = await (supabase as any)
      .from('lease_contacts')
      .select('id, role, status, move_in_date, tenant_id, tenants( id, contact:contacts(display_name, first_name, last_name, company_name, is_company, primary_email, alt_email, primary_phone, alt_phone) )')
      .eq('lease_id', lease.id)
    contacts = Array.isArray(lc) ? lc : []
  } catch {}

  // Step 4: Fetch rent schedules for rent tab
  let rentSchedules: any[] = []
  try {
    const { data: schedules } = await (supabase as any)
      .from('rent_schedules')
      .select('id, status, start_date, end_date, rent_cycle, total_amount, backdate_charges')
      .eq('lease_id', lease.id)
      .order('start_date', { ascending: true })
    rentSchedules = Array.isArray(schedules) ? schedules : []
  } catch {}

  let recurringTemplates: any[] = []
  try {
    const { data: recurs } = await (supabase as any)
      .from('recurring_transactions')
      .select('id, type, memo, amount, frequency, start_date, end_date, posting_day, posting_type, posting_days_in_advance, gl_account_id, gl_accounts ( name ), duration')
      .eq('lease_id', lease.id)
      .order('start_date', { ascending: true })
    recurringTemplates = Array.isArray(recurs) ? recurs : []
  } catch {}

  let glAccounts: any[] = []
  try {
    const { data: accounts } = await (supabase as any)
      .from('gl_accounts')
      .select('id, name, type')
      .order('name', { ascending: true })
    glAccounts = Array.isArray(accounts) ? accounts : []
  } catch {}

  let bankAccounts: any[] = []
  try {
    const { data: banks } = await (supabase as any)
      .from('bank_accounts')
      .select('id, name')
      .order('name', { ascending: true })
    bankAccounts = Array.isArray(banks) ? banks : []
  } catch {}

  // Step 5: Fetch ledger transactions from local store (if available)
  let transactions: any[] = []
  let transactionsError: string | null = null
  try {
    const { data: txRows, error: txError } = await (supabase as any)
      .from('transactions')
      .select(`
        id,
        buildium_transaction_id,
        date,
        transaction_type,
        total_amount,
        memo,
        check_number,
        reference_number,
        transaction_lines (
          amount,
          memo,
          gl_account_id,
          gl_accounts ( id, name )
        )
      `)
      .eq('lease_id', lease.id)
      .order('date', { ascending: false })
      .limit(50)

    if (txError) throw txError
    transactions = Array.isArray(txRows) ? txRows : []
  } catch (e: any) {
    transactionsError = e?.message || 'Failed to load transactions'
  }

  // Fetch property owners (primary owner) for header card
  let primaryOwner: { id?: string; name?: string } | null = null
  try {
    if (lease.property_id) {
      const res = await fetch(`/api/properties/${lease.property_id}/details`, { next: { revalidate: 60, tags: [`property-details:${lease.property_id}`] } })
      if (res.ok) {
        const data = await res.json()
        const owners = Array.isArray(data?.owners) ? data.owners : []
        const po = owners.find((o: any) => o.primary) || owners[0]
        if (po) {
          const name = po.display_name || po.company_name || [po.first_name, po.last_name].filter(Boolean).join(' ').trim() || 'Owner'
          primaryOwner = { id: String(po.owner_id || po.id || ''), name }
        } else if (data?.primary_owner_name) {
          primaryOwner = { name: String(data.primary_owner_name) }
        }
      }
      // Fallback to PropertyService when cache/API lacks owners
      if (!primaryOwner) {
        try {
          const { PropertyService } = await import('@/lib/property-service')
          const svc = await PropertyService.getPropertyById(String(lease.property_id))
          if (svc) {
            const owners2 = Array.isArray((svc as any).owners) ? (svc as any).owners : []
            const po2 = owners2.find((o: any) => o.primary) || owners2[0]
            if (po2) {
              const name2 = po2.display_name || po2.company_name || [po2.first_name, po2.last_name].filter(Boolean).join(' ').trim() || 'Owner'
              primaryOwner = { id: String(po2.owner_id || po2.id || ''), name: name2 }
            } else if ((svc as any).primary_owner_name) {
              primaryOwner = { name: String((svc as any).primary_owner_name) }
            }
          }
        } catch {}
      }
      // Final fallback: query cache table directly (server/admin)
      if (!primaryOwner) {
        try {
          const { data: poc } = await (supabase as any)
            .from('property_ownerships_cache')
            .select('owner_id, display_name, primary')
            .eq('property_id', lease.property_id)
          const list = Array.isArray(poc) ? poc : []
          if (list.length) {
            const po3 = list.find((o: any) => o.primary) || list[0]
            const name3 = po3?.display_name || 'Owner'
            primaryOwner = { id: String(po3?.owner_id || ''), name: name3 }
          }
        } catch {}
      }
      // Deep fallback: join ownerships → owners → contacts for display name
      if (!primaryOwner) {
        try {
          const { data: own } = await (supabase as any)
            .from('ownerships')
            .select('primary, owner_id, owners ( contact_id, contacts ( display_name, first_name, last_name, company_name ) )')
            .eq('property_id', lease.property_id)
          const list = Array.isArray(own) ? own : []
          if (list.length) {
            const po4 = list.find((o: any) => o.primary) || list[0]
            const c = (po4?.owners as any)?.contacts as any
            const name4 = c?.display_name || c?.company_name || [c?.first_name, c?.last_name].filter(Boolean).join(' ').trim() || 'Owner'
            primaryOwner = { id: String(po4?.owner_id || ''), name: name4 }
          }
        } catch {}
      }
    }
  } catch {}

  // Outstanding balances from Buildium
  let balances: { balance: number; prepayments: number; depositsHeld: number } = { balance: 0, prepayments: 0, depositsHeld: 0 }
  try {
    if (lease.buildium_lease_id) {
      const res = await fetch(`/api/buildium/leases/${lease.buildium_lease_id}/transactions/outstanding-balances`, { cache: 'no-store' })
      const j = await res.json().catch(() => null as any)
      const d = j?.data || j || {}
      const toNum = (v: any) => (v == null ? 0 : Number(v))
      balances = {
        balance: toNum(d.Balance ?? d.balance ?? d.TotalBalance ?? d.OutstandingBalance),
        prepayments: toNum(d.Prepayments ?? d.prepayments ?? d.PrepaymentBalance),
        depositsHeld: toNum(d.DepositsHeld ?? d.depositsHeld ?? d.Deposits),
      }
    }
  } catch {}

  const tenantNames: string[] = Array.isArray(contacts)
    ? (contacts as any[]).map((lc) => {
        const c = lc?.tenants?.contact
        return (
          c?.display_name || c?.company_name || [c?.first_name, c?.last_name].filter(Boolean).join(' ').trim() || 'Tenant'
        )
      }).filter(Boolean)
    : []

  const toTitleCase = (input?: string | null) =>
    input
      ? input
          .toLowerCase()
          .split(/[_\s]+/)
          .filter(Boolean)
          .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
          .join(' ')
      : null

  const formatRentCycleLabel = (value?: string | null) => {
    if (!value) return '—'
    const spaced = String(value)
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/(\d+)/g, ' $1 ')
    return toTitleCase(spaced.trim()) || spaced.trim()
  }

  const formatScheduleDate = (value?: string | null) => {
    if (!value) return 'No end date'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return '—'
    return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const summarizeScheduleRange = (schedule?: { start_date?: string | null; end_date?: string | null } | null) => {
    if (!schedule) return '—'
    const start = schedule.start_date ? formatScheduleDate(schedule.start_date) : 'Start date not set'
    const end = schedule.end_date ? formatScheduleDate(schedule.end_date) : 'No end date'
    return `${start} – ${end}`
  }

  const formatOrdinalDay = (value?: number | string | null) => {
    if (value === null || value === undefined) return null
    const day = Number(value)
    if (!Number.isFinite(day) || day <= 0) return null
    const remainderTen = day % 10
    const remainderHundred = day % 100
    let suffix = 'th'
    if (remainderHundred < 11 || remainderHundred > 13) {
      if (remainderTen === 1) suffix = 'st'
      else if (remainderTen === 2) suffix = 'nd'
      else if (remainderTen === 3) suffix = 'rd'
    }
    return `${day}${suffix}`
  }

  const normalizePhone = (value?: string | null) => {
    if (!value) return null
    const trimmed = String(value).trim()
    if (!trimmed) return null
    return trimmed
  }

  const computeInitials = (value: string) => {
    const parts = value.split(/\s+/).filter(Boolean)
    if (!parts.length) return '??'
    const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase())
    return initials.join('') || '??'
  }

  const contactRows = Array.isArray(contacts)
    ? (contacts as any[])
        .map((lc) => {
          const contact = lc?.tenants?.contact
          if (!contact) return null
          const name =
            contact.display_name ||
            contact.company_name ||
            [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() ||
            'Tenant'
          const email = contact.primary_email || contact.alt_email || null
          const role = toTitleCase(lc?.role) || 'Tenant'
          const moveIn = fmtDate(lc?.move_in_date || undefined)
          const phones = [contact.primary_phone, contact.alt_phone]
            .map((phone) => normalizePhone(phone))
            .filter(Boolean)
            .map((number) => ({ number: number as string }))
          return {
            id: lc?.id ?? name,
            name,
            role,
            email,
            moveIn,
            tenantId: lc?.tenant_id,
            initials: computeInitials(name),
            phones,
            roleKey: String(lc?.role || 'Tenant').toLowerCase(),
          }
        })
        .filter(Boolean)
    : []

  const tenantOptionMap = new Map<string, string>()
  for (const row of contactRows) {
    const optionId = row?.tenantId ? String(row.tenantId) : row?.id ? String(row.id) : null
    if (optionId) tenantOptionMap.set(optionId, row.name)
  }
  const recurringTenantOptions = Array.from(tenantOptionMap.entries()).map(([id, name]) => ({ id, name }))

  // Resolve first tenant id for summary link
  const firstTenantRow = contactRows.find((row) => !String(row.roleKey || '').includes('cosigner'))
  const firstTenantId = firstTenantRow?.tenantId ? String(firstTenantRow.tenantId) : null

  type TenantCardInfo = {
    id: string
    name: string
    initials: string
    moveIn: string | null
    email: string | null
    phones: { number: string; action?: { label: string; href: string } }[]
    roleLabel: string
  }

  const tenantsByRole = contactRows.reduce(
    (acc, row) => {
      const info: TenantCardInfo = {
        id: String(row.id),
        name: row.name,
        initials: row.initials,
        moveIn: row.moveIn && row.moveIn !== '—' ? row.moveIn : null,
        email: row.email,
        phones: row.phones,
        roleLabel: row.role,
      }
      const bucket = row.roleKey.includes('cosigner') ? 'cosigners' : 'tenants'
      acc[bucket].push(info)
      return acc
    },
    { tenants: [] as TenantCardInfo[], cosigners: [] as TenantCardInfo[] }
  )

  type RentScheduleEntry = {
    id: string
    status: string
    start_date: string | null
    end_date: string | null
    rent_cycle: string | null
    total_amount: number
    backdate_charges: boolean
    statusLabel: string
    statusVariant: 'default' | 'secondary' | 'outline'
  }

  const rentScheduleEntries: RentScheduleEntry[] = rentSchedules
    .filter(Boolean)
    .map((schedule) => {
      const status = String(schedule?.status ?? 'Future')
      const statusLower = status.toLowerCase()
      const variant: 'default' | 'secondary' | 'outline' =
        statusLower === 'current' ? 'default' : statusLower === 'future' ? 'secondary' : 'outline'

      return {
        id: String(schedule?.id ?? randomUUID()),
        status,
        start_date: schedule?.start_date ?? null,
        end_date: schedule?.end_date ?? null,
        rent_cycle: schedule?.rent_cycle ?? null,
        total_amount: Number(schedule?.total_amount ?? 0) || 0,
        backdate_charges: Boolean(schedule?.backdate_charges),
        statusLabel: status.toUpperCase(),
        statusVariant: variant,
      }
    })
    .sort((a, b) => {
      const aDate = a.start_date ? new Date(a.start_date).getTime() : 0
      const bDate = b.start_date ? new Date(b.start_date).getTime() : 0
      return bDate - aDate
    })

  const currentSchedule = rentScheduleEntries.find((entry) => entry.status.toLowerCase() === 'current') || null
  const upcomingSchedule = rentScheduleEntries
    .filter((entry) => entry.status.toLowerCase() === 'future')
    .sort((a, b) => {
      const aDate = a.start_date ? new Date(a.start_date).getTime() : Number.POSITIVE_INFINITY
      const bDate = b.start_date ? new Date(b.start_date).getTime() : Number.POSITIVE_INFINITY
      return aDate - bDate
    })[0] || null
  const paymentDueDayLabel = formatOrdinalDay(lease?.payment_due_day)
  const currentCycleLabel = currentSchedule ? formatRentCycleLabel(currentSchedule.rent_cycle) : null
  const upcomingCycleLabel = upcomingSchedule ? formatRentCycleLabel(upcomingSchedule.rent_cycle) : null
  const rentLogDisplay = rentScheduleEntries.map((row) => ({
    id: row.id,
    statusLabel: row.statusLabel,
    statusVariant: row.statusVariant,
    startLabel: row.start_date ? formatScheduleDate(row.start_date) : '—',
    endLabel: row.end_date ? formatScheduleDate(row.end_date) : 'No end date',
    cycleLabel: formatRentCycleLabel(row.rent_cycle),
    amountLabel: fmtUsd(row.total_amount),
  }))
  const currentCard = currentSchedule
    ? {
        rangeLabel: summarizeScheduleRange(currentSchedule),
        amountLabel: fmtUsd(currentSchedule.total_amount),
        cycleLabel: currentCycleLabel,
        chargeLabel: paymentDueDayLabel ? `Charged on the ${paymentDueDayLabel}` : 'Charge day not set',
      }
    : null
  const upcomingCard = upcomingSchedule
    ? {
        rangeLabel: summarizeScheduleRange(upcomingSchedule),
        amountLabel: fmtUsd(upcomingSchedule.total_amount),
        cycleLabel: upcomingCycleLabel,
      }
    : null
  const rentCycleOptions = RentCycleEnumDb.options
  const rentStatusOptions = RentScheduleStatusEnumDb.options
  const rentFormDefaults = {
    start_date: upcomingSchedule?.start_date ?? null,
    end_date: upcomingSchedule?.end_date ?? null,
    rent_cycle: upcomingSchedule?.rent_cycle ?? currentSchedule?.rent_cycle ?? rentCycleOptions[0],
    total_amount: upcomingSchedule?.total_amount ?? currentSchedule?.total_amount ?? null,
    status: 'Future',
  }
  const leaseRangeLabel = lease?.lease_from_date || lease?.lease_to_date
    ? `${lease?.lease_from_date ? formatScheduleDate(lease.lease_from_date) : 'Start date not set'} – ${lease?.lease_to_date ? formatScheduleDate(lease.lease_to_date) : 'No end date'}`
    : null
  const propertyUnitLabel = property?.name
    ? unit?.unit_number
      ? `${property.name} • ${unit.unit_number}`
      : property.name
    : unit?.unit_number
      ? `Unit ${unit.unit_number}`
      : null
  const leaseSummaryInfo = {
    leaseType: toTitleCase(lease?.lease_type) || null,
    leaseRange: leaseRangeLabel,
    tenants: tenantNames.length ? tenantNames.join(', ') : null,
    propertyUnit: propertyUnitLabel,
    currentMarketRent: currentCard?.amountLabel ?? (lease?.rent_amount != null ? fmtUsd(lease.rent_amount) : null),
  }

  const recurringAccountOptions: LeaseAccountOption[] = glAccounts
    .filter((account) => account && account.id != null)
    .map((account) => ({
      id: String(account.id),
      name: account.name || 'Account',
      type: account.type || null,
    }))

  const recurringTenantLabel = tenantNames.length ? tenantNames.join(', ') : null
  const bankAccountOptions = bankAccounts
    .filter((account) => account && account.id != null)
    .map((account) => ({ id: String(account.id), name: account.name || 'Bank account' }))

  const recurringRows = recurringTemplates
    .filter(Boolean)
    .map((row: any) => {
      const nextDate = row?.start_date ? formatScheduleDate(row.start_date) : '—'
      const frequencyLabel = formatRentCycleLabel(row?.frequency) || '—'
      const durationLabel = row?.duration ? toTitleCase(row.duration) : '—'
      const postingDescription = (() => {
        if (typeof row?.posting_days_in_advance === 'number' && row.posting_days_in_advance !== 0) {
          const days = Math.abs(row.posting_days_in_advance)
          const suffix = days === 1 ? 'day' : 'days'
          const direction = row.posting_days_in_advance > 0 ? 'in advance' : 'after'
          return `Post ${days} ${suffix} ${direction}`
        }
        if (row?.posting_day) {
          return `Post on day ${row.posting_day}`
        }
        return 'Post on due date'
      })()
      const accountName = row?.gl_accounts?.name || row?.gl_account_name || '—'
      const typeLabel = toTitleCase(row?.type) || 'Transaction'
      return {
        id: String(row?.id ?? randomUUID()),
        nextDate,
        type: typeLabel,
        account: accountName,
        memo: row?.memo || '—',
        frequency: frequencyLabel,
        duration: durationLabel,
        posting: postingDescription,
        amount: fmtUsd(Number(row?.amount ?? 0)),
      }
    })

  const formatLedgerDate = (date?: string | null) => {
    if (!date) return '—'
    try {
      const d = new Date(date)
      if (Number.isNaN(d.getTime())) return '—'
      return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' })
    } catch {
      return '—'
    }
  }

  const determineSignedAmount = (tx: any) => {
    const amount = Number(tx?.TotalAmount ?? tx?.total_amount ?? 0) || 0
    const type: string = String(
      tx?.TransactionTypeEnum || tx?.TransactionType || tx?.transaction_type || ''
    ).toLowerCase()
    if (!amount) return 0
    if (type.includes('payment') || type.includes('credit') || type.includes('refund') || type.includes('adjustment')) {
      return amount * -1
    }
    return amount
  }

  // If Buildium balances are unavailable or zero, fall back to local
  // transactions to compute a current balance so the UI reflects
  // newly entered charges immediately.
  try {
    const currentOutstanding = Number(balances.balance ?? 0)
    if (!currentOutstanding && Array.isArray(transactions) && transactions.length) {
      const localBalance = transactions.reduce((sum, tx) => sum + determineSignedAmount(tx), 0)
      balances = { ...balances, balance: localBalance }
    }
  } catch {}

  const ledgerRows = Array.isArray(transactions)
    ? transactions
        .filter(Boolean)
        .map((tx) => {
          const lines = Array.isArray(tx?.transaction_lines) && tx.transaction_lines.length
            ? tx.transaction_lines
            : Array.isArray(tx?.Lines) && tx.Lines.length
              ? tx.Lines
              : Array.isArray(tx?.Journal?.Lines)
                ? tx.Journal.Lines
                : []
          const primaryLine = lines?.[0] || null
          const accountName =
            (primaryLine?.gl_accounts && typeof primaryLine.gl_accounts === 'object' && 'name' in primaryLine.gl_accounts
              ? (primaryLine.gl_accounts as any).name
              : undefined) ||
            (primaryLine?.GLAccount && typeof primaryLine.GLAccount === 'object' && 'Name' in primaryLine.GLAccount
              ? primaryLine.GLAccount.Name
              : undefined) ||
            primaryLine?.GLAccountName ||
            '—'
          const memo =
            primaryLine?.memo ||
            primaryLine?.Memo ||
            tx?.memo ||
            tx?.Memo ||
            tx?.Description ||
            null
          const buildiumIdRaw = tx?.Id ?? tx?.buildium_transaction_id
          const buildiumId = buildiumIdRaw != null && !Number.isNaN(Number(buildiumIdRaw)) ? Number(buildiumIdRaw) : null
          const localId = tx?.id ?? tx?.Id ?? randomUUID()
          // Invoice column should be blank unless an explicit invoice
          // reference exists. Do not fabricate labels from IDs.
          const invoiceLabel =
            tx?.CheckNumber ||
            tx?.check_number ||
            tx?.ReferenceNumber ||
            tx?.reference_number ||
            ''
          const typeLabel = tx?.TransactionTypeEnum || tx?.TransactionType || tx?.transaction_type || 'Transaction'
          return {
            id: String(localId),
            date: formatLedgerDate(tx?.Date ?? tx?.date),
            invoice: invoiceLabel,
            account: accountName,
            type: typeLabel,
            memo,
            amount: Number(tx?.TotalAmount ?? tx?.total_amount ?? 0) || 0,
            signedAmount: determineSignedAmount(tx),
            transactionId: buildiumId,
          }
        })
    : []

  // Compute running balance (newest first, assume charges increase balance)
  let runningBalance = Number(balances.balance ?? 0) || 0
  const ledgerRowsWithBalance = ledgerRows.map((row) => {
    const balanceForRow = fmtUsd(runningBalance)
    const amountAbs = Math.abs(row.signedAmount)
    const amountFormatted = fmtUsd(amountAbs)
    const displayAmount = row.signedAmount < 0 ? `-${amountFormatted}` : amountFormatted
    runningBalance -= row.signedAmount
    return {
      ...row,
      displayAmount,
      balance: balanceForRow,
      transactionId: row.transactionId ?? row.id,
      amountRaw: row.amount,
    }
  })

  const ledgerRowsForPanel = ledgerRowsWithBalance.map((row) => ({
    id: row.id,
    date: row.date,
    invoice: row.invoice,
    account: row.account,
    type: row.type,
    memo: row.memo,
    displayAmount: row.displayAmount,
    balance: row.balance,
    transactionId: row.transactionId,
    amountRaw: row.amountRaw,
    signedAmount: row.signedAmount,
  }))


  const depositsHeldTotal = Number(balances.depositsHeld ?? 0) || 0
  const prepaymentsTotal = Number(balances.prepayments ?? 0) || 0
  const depositsTableRows: Array<{ id: string; account: string; date?: string; invoice?: string; type?: string; memo?: string; amount: number; balance: number }> = []
  if (depositsHeldTotal > 0) {
    depositsTableRows.push({
      id: 'deposit-summary',
      account: 'Security Deposit Liability',
      date: undefined,
      invoice: undefined,
      type: 'Credit',
      memo: 'Opening balance: Security deposit',
      amount: depositsHeldTotal,
      balance: depositsHeldTotal,
    })
  }
  if (prepaymentsTotal > 0) {
    depositsTableRows.push({
      id: 'prepayment-summary',
      account: 'Prepayments',
      date: undefined,
      invoice: undefined,
      type: 'Credit',
      memo: 'Prepayment balance',
      amount: prepaymentsTotal,
      balance: prepaymentsTotal,
    })
  }
  const ledgerMatchesLabel = transactionsError
    ? 'Unable to load ledger'
    : ledgerRowsWithBalance.length
      ? `${ledgerRowsWithBalance.length} match${ledgerRowsWithBalance.length === 1 ? '' : 'es'}`
      : 'No ledger entries'

  return (
    <Tabs defaultValue={initialTab} className="space-y-6">
      <div className="p-6 pb-0 space-y-2">
        <LeaseHeaderMeta
          leaseId={lease.id}
          buildiumLeaseId={lease.buildium_lease_id}
          status={lease.status}
          leaseType={lease.lease_type}
          termType={lease.term_type}
          startDate={lease.lease_from_date}
          endDate={lease.lease_to_date}
          unitDisplay={property?.name ? `${property.name} - ${unit?.unit_number ?? ''}` : unit?.unit_number ? `Unit ${unit.unit_number}` : ''}
          titleText={`${property?.name || 'Property'}${unit?.unit_number ? ` - ${unit.unit_number}` : ''}${tenantNames.length ? ` • ${tenantNames.join(', ')}` : ''}`}
          backHref={`/properties/${property?.id ?? ''}/units/${unit?.id ?? ''}`}
        />
        <div className="mt-4 border-b border-border">
          <TabsList className="flex items-center space-x-8 bg-transparent p-0 text-muted-foreground h-auto rounded-none">
            <TabsTrigger
              value="summary"
              className="flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pb-3 pt-2 text-sm font-medium transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none hover:border-muted-foreground hover:text-foreground"
            >
              Summary
            </TabsTrigger>
            <TabsTrigger
              value="financials"
              className="flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pb-3 pt-2 text-sm font-medium transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none hover:border-muted-foreground hover:text-foreground"
            >
              Financials
            </TabsTrigger>
            <TabsTrigger
              value="tenants"
              className="flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pb-3 pt-2 text-sm font-medium transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none hover:border-muted-foreground hover:text-foreground"
            >
              Tenants
            </TabsTrigger>
            <TabsTrigger
              value="communications"
              className="flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pb-3 pt-2 text-sm font-medium transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none hover:border-muted-foreground hover:text-foreground"
            >
              Communications
            </TabsTrigger>
            <TabsTrigger
              value="tasks"
              className="flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pb-3 pt-2 text-sm font-medium transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none hover:border-muted-foreground hover:text-foreground"
            >
              Tasks
            </TabsTrigger>
            <TabsTrigger
              value="files"
              className="flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pb-3 pt-2 text-sm font-medium transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none hover:border-muted-foreground hover:text-foreground"
            >
              Files
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      <TabsContent value="summary" className="space-y-6 px-6 pb-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <InfoCard title="Lease details">
              <div className="grid grid-cols-1 gap-6 text-sm sm:grid-cols-3">
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">UNIT</div>
                  <Link
                    href={`/properties/${property?.id ?? ''}/units/${unit?.id ?? ''}`}
                    className="text-primary hover:underline"
                  >
                    {property?.name ? `${property.name} - ${unit?.unit_number ?? ''}` : unit?.unit_number ? `Unit ${unit.unit_number}` : '—'}
                  </Link>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">RENTAL OWNER</div>
                  {primaryOwner?.name ? (
                    primaryOwner?.id ? (
                      <Link href={`/owners/${primaryOwner.id}`} className="text-primary hover:underline">{primaryOwner.name}</Link>
                    ) : (
                      <span>{primaryOwner.name}</span>
                    )
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">TENANT</div>
                  {tenantNames.length ? (
                    firstTenantId ? (
                      <Link href={`/tenants/${firstTenantId}`} className="text-primary hover:underline">{tenantNames[0]}</Link>
                    ) : (
                      <span className="text-foreground">{tenantNames[0]}</span>
                    )
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            </InfoCard>
          </div>
          <div>
            <div className="rounded-lg bg-primary/5 p-6 text-sm">
              <div className="mb-3 flex items-center justify-between font-medium"><span>Balance:</span><span>{fmtUsd(balances.balance)}</span></div>
              <div className="mb-2 flex items-center justify-between"><span>Prepayments:</span><span className="font-medium">{fmtUsd(balances.prepayments)}</span></div>
              <div className="mb-2 flex items-center justify-between"><span>Deposits held:</span><span className="font-medium">{fmtUsd(balances.depositsHeld)}</span></div>
              <div className="flex items-center justify-between"><span>Rent:</span><span className="font-medium">{fmtUsd(lease.rent_amount)}</span></div>
            </div>
          </div>
        </div>

      </TabsContent>

      <TabsContent value="financials" className="space-y-6 px-6 pb-6">
        <div className="border-b border-border">
          <Tabs defaultValue="ledger" className="relative space-y-4">
            <TabsList className="flex w-fit items-center gap-8 bg-transparent p-0 text-muted-foreground h-auto rounded-none">
              {[
                { value: 'ledger', label: 'Ledger' },
                { value: 'deposits', label: 'Deposits & Prepayments' },
                { value: 'rent', label: 'Rent' },
                { value: 'recurring', label: 'Recurring transactions' }
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pb-3 pt-2 text-sm font-medium transition-colors data-[state=active]:border-primary data-[state=active]:text-primary"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="ledger" className="space-y-6">
              <LeaseLedgerPanel
                leaseId={lease.id}
                rows={ledgerRowsForPanel}
                ledgerMatchesLabel={ledgerMatchesLabel}
                balances={balances}
                tenantOptions={recurringTenantOptions}
                accountOptions={recurringAccountOptions}
                leaseSummary={{ propertyUnit: leaseSummaryInfo.propertyUnit, tenants: recurringTenantLabel }}
                errorMessage={transactionsError}
                bankAccountOptions={bankAccountOptions}
              />
            </TabsContent>


<TabsContent value="deposits" className="space-y-6">
  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
    <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-border bg-card px-5 py-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Deposits held</div>
        <div className="mt-1 text-2xl font-semibold text-foreground">{fmtUsd(depositsHeldTotal)}</div>
      </div>
      <div className="rounded-lg border border-border bg-card px-5 py-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prepayments</div>
        <div className="mt-1 text-2xl font-semibold text-foreground">{fmtUsd(prepaymentsTotal)}</div>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <Button disabled>Receive payment</Button>
      <Button variant="outline" disabled>Enter charge</Button>
      <Button variant="action" size="icon" className="h-8 w-8" aria-label="More actions" disabled>
        <MoreHorizontal className="h-5 w-5" />
      </Button>
    </div>
  </div>
  <div className="overflow-hidden rounded-lg border border-border">
    <Table className="min-w-full divide-y divide-border">
      <TableHeader className="bg-muted">
        <TableRow>
          <TableHead className="w-28">Date</TableHead>
          <TableHead>Invoice</TableHead>
          <TableHead>Transaction</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Balance</TableHead>
          <TableHead className="w-16 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="divide-y divide-border bg-card">
        {depositsTableRows.length ? (
          <>
            {depositsTableRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-sm text-foreground">{row.date || '—'}</TableCell>
                <TableCell className="text-sm text-foreground">{row.invoice || '—'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="font-medium">{row.type || 'Transaction'}</span>
                      {row.memo ? <span className="text-xs text-muted-foreground">{row.memo}</span> : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-foreground">{fmtUsd(row.amount)}</TableCell>
                <TableCell className="text-sm text-foreground">{fmtUsd(row.balance)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="action" size="icon" className="h-8 w-8" aria-label="Deposit actions">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/40 font-medium">
              <TableCell colSpan={3}>Total</TableCell>
              <TableCell>{fmtUsd(depositsTableRows.reduce((sum, row) => sum + row.amount, 0))}</TableCell>
              <TableCell>{fmtUsd(depositsTableRows.reduce((sum, row) => sum + row.balance, 0))}</TableCell>
              <TableCell />
            </TableRow>
          </>
        ) : (
          <TableRow>
            <TableCell colSpan={6} className="text-sm text-muted-foreground">
              No deposits or prepayments recorded yet.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  </div>
</TabsContent>
            <TabsContent value="rent" id="rent" className="relative min-h-[600px] space-y-6">
              <RentTabInteractive
                leaseId={lease.id}
                currentCard={currentCard}
                upcomingCard={upcomingCard}
                rentLog={rentLogDisplay}
                rentCycleOptions={rentCycleOptions}
                rentStatusOptions={rentStatusOptions}
                leaseSummary={leaseSummaryInfo}
                defaults={rentFormDefaults}
              />
            </TabsContent>
            <TabsContent value="recurring" className="space-y-6">
              <RecurringTransactionsPanel
                leaseId={lease.id}
                rows={recurringRows}
                accounts={recurringAccountOptions}
                leaseSummary={{ propertyUnit: leaseSummaryInfo.propertyUnit, tenants: recurringTenantLabel }}
                tenants={recurringTenantOptions}
              />
            </TabsContent>
          </Tabs>
        </div>
      </TabsContent>

      <TabsContent value="tenants" className="space-y-6 px-6 pb-6">
        <div className="flex w-full md:w-[70%] max-w-4xl items-center justify-end">
          <AddTenantButton />
        </div>

        <div className="w-full md:w-[70%] max-w-4xl space-y-8">
          {tenantsByRole.tenants.length ? (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground tracking-wide">TENANTS</h3>
              <div className="flex flex-col gap-4">
                {tenantsByRole.tenants.map((tenant) => (
                  <Card key={tenant.id} className="rounded-xl border border-border/60 shadow-sm">
                    <CardContent className="flex flex-col gap-5 px-6 py-5 sm:flex-row sm:items-start">
                      <div className="flex flex-1 items-start gap-5">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                            {tenant.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          {tenant.tenantId ? (
                            <Link href={`/tenants/${tenant.tenantId}`} className="text-base font-medium text-foreground hover:text-primary hover:underline">
                              {tenant.name}
                            </Link>
                          ) : (
                            <p className="text-base font-medium text-foreground">{tenant.name}</p>
                          )}
                          <div className="mt-1">
                            <TenantMoveInEditor contactId={tenant.id} value={tenant.moveIn} />
                          </div>
                          <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground">
                            {tenant.phones.map((phone, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-foreground">{phone.number}</span>
                                {phone.action && (
                                  <Button variant="link" className="h-auto p-0 text-xs" asChild>
                                    <Link href={phone.action.href}>{phone.action.label}</Link>
                                  </Button>
                                )}
                              </div>
                            ))}
                            {tenant.email && (
                              <div className="flex items-center gap-2 text-foreground">
                                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{tenant.email}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex w-full sm:w-auto items-center justify-end gap-3">
                        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                          <ExternalLink className="h-3.5 w-3.5" />
                          Move out
                        </Button>
                        <RemoveLeaseContactButton
                          contactId={tenant.id}
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          confirmationMessage="Remove this tenant from the lease?"
                        >
                          <Trash2 className="h-4 w-4" />
                        </RemoveLeaseContactButton>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}

          {tenantsByRole.cosigners.length ? (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground tracking-wide">COSIGNERS</h3>
              <div className="flex flex-col gap-4">
                {tenantsByRole.cosigners.map((tenant) => (
                  <Card key={tenant.id} className="rounded-xl border border-border/60 shadow-sm">
                    <CardContent className="flex flex-col gap-5 px-6 py-5 sm:flex-row sm:items-start">
                      <div className="flex flex-1 items-start gap-5">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                            {tenant.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          {tenant.tenantId ? (
                            <Link href={`/tenants/${tenant.tenantId}`} className="text-base font-medium text-foreground hover:text-primary hover:underline">
                              {tenant.name}
                            </Link>
                          ) : (
                            <p className="text-base font-medium text-foreground">{tenant.name}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{tenant.roleLabel}</p>
                          <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                            {tenant.phones.map((phone, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-foreground">{phone.number}</span>
                              </div>
                            ))}
                            {tenant.email && (
                              <div className="flex items-center gap-2 text-foreground">
                                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{tenant.email}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                        <RemoveLeaseContactButton
                          contactId={tenant.id}
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-muted-foreground hover:text-foreground"
                          confirmationMessage="Remove this cosigner from the lease?"
                        >
                          Remove
                          <Trash2 className="h-3.5 w-3.5" />
                        </RemoveLeaseContactButton>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}

          {!tenantsByRole.tenants.length && !tenantsByRole.cosigners.length ? (
            <Card>
              <CardContent className="py-8 text-sm text-muted-foreground">No tenants or cosigners on this lease yet.</CardContent>
            </Card>
          ) : null}
        </div>
      </TabsContent>

      <TabsContent value="communications" className="space-y-6 px-6 pb-6">
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">Communications timeline coming soon.</CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="tasks" className="space-y-6 px-6 pb-6">
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">Tasks for this lease will appear here.</CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="files" className="space-y-6 px-6 pb-6">
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">Files and documents will appear here.</CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}

function PlaceholderPanel({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-6 py-20 text-center text-sm text-muted-foreground">
      {label} coming soon.
    </div>
  )
}
