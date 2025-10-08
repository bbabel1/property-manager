import { differenceInCalendarDays, isAfter, isBefore, isWithinInterval, startOfMonth, startOfYear, subDays } from 'date-fns'
import { logger } from '@/lib/logger'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

export type VendorRow = Database['public']['Tables']['vendors']['Row']
export type ContactRow = Database['public']['Tables']['contacts']['Row']
export type TransactionRow = Database['public']['Tables']['transactions']['Row']
export type WorkOrderRow = Database['public']['Tables']['work_orders']['Row']
export type PropertyRow = Database['public']['Tables']['properties']['Row']
export type VendorCategoryRow = Database['public']['Tables']['vendor_categories']['Row']

export interface VendorInsight {
  id: string
  displayName: string
  companyName?: string | null
  categoryName?: string | null
  buildiumVendorId?: number | null
  buildiumCategoryId?: number | null
  contactEmail?: string | null
  contactPhone?: string | null
  addressLine1?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
  isActive: boolean
  complianceStatus: 'ok' | 'expiring' | 'expired' | 'missing'
  insuranceExpirationDate?: string | null
  insuranceProvider?: string | null
  spendYtd: number
  spendLast30: number
  openInvoices: number
  overdueInvoices: number
  openWorkOrders: number
  scheduledVisits: number
  nextScheduledVisit?: string | null
  lastEngagement?: string | null
  reliabilityScore: number
  rating: number
  automationSuggestions: string[]
}

export interface VendorSpendInsight {
  vendorId: string
  vendorName: string
  spendYtd: number
  spendLastMonth: number
  openBalance: number
}

export interface QuotePipelineItem {
  transactionId: string
  vendorId: string
  vendorName: string
  amount: number
  dueDate?: string | null
  status: string
  propertyId?: string | null
  propertyName?: string | null
  buildiumBillId?: number | null
  memo?: string | null
  referenceNumber?: string | null
}

export interface ScheduleItem {
  workOrderId: string
  vendorId: string | null
  vendorName: string
  subject: string
  status: string | null
  priority: string | null
  scheduledDate: string | null
  propertyId: string | null
  propertyName?: string
  propertyAddress?: string
  buildiumWorkOrderId?: number | null
}

export interface ComplianceAlert {
  vendorId: string
  vendorName: string
  status: 'expired' | 'expiring' | 'missing'
  insuranceExpirationDate?: string | null
  daysUntilExpiration?: number
  notes: string
}

export interface AutomationSignal {
  vendorId: string
  vendorName: string
  signalType: 'follow_up' | 'schedule' | 'quote' | 'compliance'
  description: string
  suggestedAction: string
  priority: 'low' | 'medium' | 'high'
}

export interface VendorDashboardData {
  generatedAt: string
  summary: {
    totalVendors: number
    activeVendors: number
    flaggedCompliance: number
    pendingApprovals: number
    monthlySpend: number
    ytdSpend: number
  }
  vendors: VendorInsight[]
  spendByVendor: VendorSpendInsight[]
  quotePipeline: QuotePipelineItem[]
  schedule: ScheduleItem[]
  complianceAlerts: ComplianceAlert[]
  automationSignals: AutomationSignal[]
  aiSnapshot: {
    topVendors: VendorInsight[]
    highRiskVendors: VendorInsight[]
    totalOutstanding: number
    totalOpenWorkOrders: number
  }
}

type RawVendor = VendorRow & {
  contact: Pick<
    ContactRow,
    |
      'id'
      | 'display_name'
      | 'company_name'
      | 'first_name'
      | 'last_name'
      | 'primary_email'
      | 'primary_phone'
      | 'alt_phone'
      | 'primary_address_line_1'
      | 'primary_city'
      | 'primary_state'
      | 'primary_postal_code'
      | 'primary_country'
  > | null
  category: Pick<VendorCategoryRow, 'id' | 'name' | 'buildium_category_id'> | null
}

type RawTransaction = Pick<
  TransactionRow,
  | 'id'
  | 'vendor_id'
  | 'total_amount'
  | 'status'
  | 'date'
  | 'due_date'
  | 'category_id'
  | 'transaction_type'
  | 'buildium_bill_id'
  | 'memo'
  | 'reference_number'
>

type RawWorkOrder = Pick<
  WorkOrderRow,
  | 'id'
  | 'vendor_id'
  | 'subject'
  | 'status'
  | 'priority'
  | 'scheduled_date'
  | 'property_id'
  | 'buildium_work_order_id'
  | 'created_at'
  | 'updated_at'
>

const PENDING_STATUSES = new Set(['pending', 'awaiting_approval', 'review', 'submitted'])
const COMPLETED_STATUSES = new Set(['paid', 'completed'])
const ACTIVE_WORK_STATUSES = new Set(['open', 'in_progress'])
const HIGH_PRIORITY_LEVELS = new Set(['urgent', 'high'])

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toAmount(value: unknown): number {
  if (value == null) return 0
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function computeComplianceStatus(expiration: string | null): {
  status: 'ok' | 'expiring' | 'expired' | 'missing'
  daysUntilExpiration?: number
} {
  if (!expiration) {
    return { status: 'missing' }
  }
  const expDate = toDate(expiration)
  if (!expDate) {
    return { status: 'missing' }
  }
  const today = new Date()
  const diff = differenceInCalendarDays(expDate, today)
  if (diff < 0) {
    return { status: 'expired', daysUntilExpiration: diff }
  }
  if (diff <= 30) {
    return { status: 'expiring', daysUntilExpiration: diff }
  }
  return { status: 'ok', daysUntilExpiration: diff }
}

function buildAutomationSignals(
  vendor: VendorInsight,
  pendingInvoices: number,
  overdueInvoices: number
): AutomationSignal[] {
  const signals: AutomationSignal[] = []

  if (overdueInvoices > 0) {
    signals.push({
      vendorId: vendor.id,
      vendorName: vendor.displayName,
      signalType: 'quote',
      description: `${overdueInvoices} invoice${overdueInvoices === 1 ? '' : 's'} past due`,
      suggestedAction: 'Trigger payment reminder workflow and escalate to approvals team',
      priority: 'high',
    })
  } else if (pendingInvoices > 0) {
    signals.push({
      vendorId: vendor.id,
      vendorName: vendor.displayName,
      signalType: 'follow_up',
      description: `${pendingInvoices} invoice${pendingInvoices === 1 ? '' : 's'} awaiting approval`,
      suggestedAction: 'Auto-send approval nudges and schedule finance review',
      priority: 'medium',
    })
  }

  if (vendor.openWorkOrders > 0) {
    const highPriorityOrder = vendor.automationSuggestions.includes('High priority work order in progress')
    signals.push({
      vendorId: vendor.id,
      vendorName: vendor.displayName,
      signalType: 'schedule',
      description: highPriorityOrder
        ? 'High-priority work in progress—coordinate onsite access'
        : 'Active work orders need scheduling updates',
      suggestedAction: 'Sync vendor availability and auto-propose site visit windows',
      priority: highPriorityOrder ? 'high' : 'medium',
    })
  }

  if (vendor.complianceStatus === 'expiring' || vendor.complianceStatus === 'expired') {
    signals.push({
      vendorId: vendor.id,
      vendorName: vendor.displayName,
      signalType: 'compliance',
      description:
        vendor.complianceStatus === 'expired'
          ? 'Insurance/COI has expired'
          : 'Insurance/COI expiring within 30 days',
      suggestedAction: 'Auto-request updated COI and suspend new work orders until received',
      priority: 'high',
    })
  }

  return signals
}

export async function getVendorDashboardData(): Promise<VendorDashboardData> {
  const supabase = await getSupabaseServerClient()
  const now = new Date()
  const startOfCurrentMonth = startOfMonth(now)
  const startOfCurrentYear = startOfYear(now)
  const startOfCurrentYearIso = startOfCurrentYear.toISOString().slice(0, 10)
  const last30Boundary = subDays(now, 30)

  const { data: rawVendors, error: vendorError } = await (supabase as any)
    .from('vendors')
    .select(
      `
        id,
        buildium_vendor_id,
        buildium_category_id,
        vendor_category,
        is_active,
        insurance_expiration_date,
        insurance_provider,
        created_at,
        updated_at,
        contact:contacts!vendors_contact_id_fkey(
          id,
          display_name,
          company_name,
          first_name,
          last_name,
          primary_email,
          primary_phone,
          alt_phone,
          primary_address_line_1,
          primary_city,
          primary_state,
          primary_postal_code,
          primary_country
        ),
        category:vendor_categories!vendors_vendor_category_fkey(
          id,
          name,
          buildium_category_id
        )
      `
    )
    .order('updated_at', { ascending: false })
    .limit(120)

  if (vendorError) {
    logger.error({ vendorError }, 'Failed to load vendors for dashboard')
    throw vendorError
  }

  const vendorIds = (rawVendors as RawVendor[]).map((v) => v.id)

  let transactions: RawTransaction[] = []
  if (vendorIds.length > 0) {
    const { data, error } = await (supabase as any)
      .from('transactions')
      .select('id, vendor_id, total_amount, status, date, due_date, category_id, transaction_type, buildium_bill_id, memo, reference_number')
      .in('vendor_id', vendorIds)
      .gte('date', startOfCurrentYearIso)

    if (error) {
      logger.error({ error }, 'Failed to load vendor transactions')
    } else if (data) {
      transactions = data as RawTransaction[]
    }
  }

  let workOrders: RawWorkOrder[] = []
  if (vendorIds.length > 0) {
    const { data, error } = await (supabase as any)
      .from('work_orders')
      .select('id, vendor_id, subject, status, priority, scheduled_date, property_id, buildium_work_order_id, created_at, updated_at')
      .in('vendor_id', vendorIds)
      .order('scheduled_date', { ascending: true })

    if (error) {
      logger.error({ error }, 'Failed to load vendor work orders')
    } else if (data) {
      workOrders = data as RawWorkOrder[]
    }
  }

  const propertyIds = Array.from(
    new Set(workOrders.map((w) => w.property_id).filter((id): id is string => Boolean(id)))
  )
  const propertyMap = new Map<string, Pick<PropertyRow, 'id' | 'name' | 'address_line1' | 'city' | 'state' | 'postal_code' | 'buildium_property_id'>>()
  if (propertyIds.length > 0) {
    const { data, error } = await (supabase as any)
      .from('properties')
      .select('id, name, address_line1, city, state, postal_code, buildium_property_id')
      .in('id', propertyIds)

    if (error) {
      logger.error({ error }, 'Failed to load properties for vendor dashboard')
    } else if (data) {
      for (const prop of data as any[]) {
        propertyMap.set(prop.id, prop)
      }
    }
  }

  const txByVendor = new Map<string, RawTransaction[]>()
  for (const tx of transactions) {
    if (!tx.vendor_id) continue
    const list = txByVendor.get(tx.vendor_id) ?? []
    list.push(tx)
    txByVendor.set(tx.vendor_id, list)
  }

  const workOrdersByVendor = new Map<string, RawWorkOrder[]>()
  for (const wo of workOrders) {
    if (!wo.vendor_id) continue
    const list = workOrdersByVendor.get(wo.vendor_id) ?? []
    list.push(wo)
    workOrdersByVendor.set(wo.vendor_id, list)
  }

  const vendors: VendorInsight[] = []
  const complianceAlerts: ComplianceAlert[] = []
  const spendByVendor: VendorSpendInsight[] = []
  const automationSignals: AutomationSignal[] = []
  const quotePipeline: QuotePipelineItem[] = []
  const schedule: ScheduleItem[] = []

  let flaggedComplianceCount = 0
  let monthlySpend = 0
  let ytdSpend = 0
  let pendingApprovals = 0

  for (const raw of rawVendors as RawVendor[]) {
    const vendorTx = txByVendor.get(raw.id) ?? []
    const vendorWos = workOrdersByVendor.get(raw.id) ?? []

    let spendYtd = 0
    let spendLast30 = 0
    let openInvoices = 0
    let overdueInvoices = 0
    let lastEngagement: Date | null = null

    for (const tx of vendorTx) {
      const txDate = toDate(tx.date)
      const dueDate = toDate(tx.due_date)
      const amount = toAmount(tx.total_amount)

      if (txDate && !isBefore(txDate, startOfCurrentYear)) {
        spendYtd += amount
      }
      if (txDate && !isBefore(txDate, last30Boundary)) {
        spendLast30 += amount
      }
      if (txDate && !isBefore(txDate, startOfCurrentMonth)) {
        monthlySpend += amount
      }
      if (txDate && (!lastEngagement || isAfter(txDate, lastEngagement))) {
        lastEngagement = txDate
      }

      const status = (tx.status || '').toLowerCase()
      if (PENDING_STATUSES.has(status)) {
        pendingApprovals += 1
        openInvoices += 1
        if (dueDate && isBefore(dueDate, now)) {
          overdueInvoices += 1
        }
      }
      if (status === 'overdue') {
        openInvoices += 1
        overdueInvoices += 1
      }
      if (!status || COMPLETED_STATUSES.has(status)) {
        // nothing
      }

      ytdSpend += amount
    }

    const openWorkOrders = vendorWos.filter((w) => ACTIVE_WORK_STATUSES.has((w.status || '').toLowerCase()))
    const scheduledVisits = vendorWos.filter((w) => Boolean(w.scheduled_date)).length
    const nextVisit = vendorWos
      .map((w) => ({ w, date: toDate(w.scheduled_date) }))
      .filter((entry) => entry.date && isAfter(entry.date, subDays(now, 1)))
      .sort((a, b) => (a.date && b.date ? a.date.getTime() - b.date.getTime() : 0))[0]?.w.scheduled_date ?? null

    const compliance = computeComplianceStatus(raw.insurance_expiration_date as string | null)
    if (compliance.status === 'expiring' || compliance.status === 'expired') {
      flaggedComplianceCount += 1
      complianceAlerts.push({
        vendorId: raw.id,
        vendorName: raw.contact?.display_name || raw.contact?.company_name || 'Unknown vendor',
        status: compliance.status,
        insuranceExpirationDate: raw.insurance_expiration_date as string | null,
        daysUntilExpiration: compliance.daysUntilExpiration,
        notes:
          compliance.status === 'expired'
            ? 'Coverage expired—pause scheduling and auto-request COI renewal'
            : 'Coverage expiring soon—auto-remind vendor and require updated documentation',
      })
    } else if (compliance.status === 'missing') {
      flaggedComplianceCount += 1
      complianceAlerts.push({
        vendorId: raw.id,
        vendorName: raw.contact?.display_name || raw.contact?.company_name || 'Unknown vendor',
        status: 'missing',
        notes: 'No COI on file—initiate onboarding checklist and request documents',
      })
    }

    const reliabilityPenalty = openWorkOrders.length * 5 + overdueInvoices * 7
    const baseReliability = 92
    const reliabilityScore = Math.max(40, Math.min(98, baseReliability - reliabilityPenalty))
    const rating = Math.round((Math.max(2.5, Math.min(5, reliabilityScore / 20)) + Number.EPSILON) * 10) / 10

    const automationNotes: string[] = []
    if (overdueInvoices > 0) automationNotes.push('Overdue invoices detected')
    if (openWorkOrders.some((w) => HIGH_PRIORITY_LEVELS.has((w.priority || '').toLowerCase()))) {
      automationNotes.push('High priority work order in progress')
    }
    if (compliance.status === 'missing') automationNotes.push('Missing compliance documentation')
    if (compliance.status === 'expiring') automationNotes.push('Compliance expiring within 30 days')

    const insight: VendorInsight = {
      id: raw.id,
      displayName:
        raw.contact?.display_name ||
        raw.contact?.company_name ||
        [raw.contact?.first_name, raw.contact?.last_name].filter(Boolean).join(' ') ||
        `Vendor ${raw.buildium_vendor_id ?? ''}`.trim(),
      companyName: raw.contact?.company_name,
      categoryName: raw.category?.name,
      buildiumVendorId: raw.buildium_vendor_id ?? undefined,
      buildiumCategoryId: raw.category?.buildium_category_id ?? raw.buildium_category_id ?? undefined,
      contactEmail: raw.contact?.primary_email,
      contactPhone: raw.contact?.primary_phone || raw.contact?.alt_phone,
      addressLine1: raw.contact?.primary_address_line_1,
      city: raw.contact?.primary_city,
      state: raw.contact?.primary_state,
      postalCode: raw.contact?.primary_postal_code,
      country: raw.contact?.primary_country,
      isActive: Boolean(raw.is_active),
      complianceStatus: compliance.status,
      insuranceExpirationDate: (raw.insurance_expiration_date as string | null) ?? undefined,
      insuranceProvider: raw.insurance_provider ?? undefined,
      spendYtd,
      spendLast30,
      openInvoices,
      overdueInvoices,
      openWorkOrders: openWorkOrders.length,
      scheduledVisits,
      nextScheduledVisit: nextVisit,
      lastEngagement: lastEngagement ? lastEngagement.toISOString() : undefined,
      reliabilityScore,
      rating,
      automationSuggestions: automationNotes,
    }

    vendors.push(insight)
    spendByVendor.push({
      vendorId: insight.id,
      vendorName: insight.displayName,
      spendYtd,
      spendLastMonth: vendorTx
        .filter((tx) => {
          const txDate = toDate(tx.date)
          return txDate ? isWithinInterval(txDate, { start: startOfCurrentMonth, end: now }) : false
        })
        .reduce((sum, tx) => sum + toAmount(tx.total_amount), 0),
      openBalance: vendorTx
        .filter((tx) => PENDING_STATUSES.has((tx.status || '').toLowerCase()))
        .reduce((sum, tx) => sum + toAmount(tx.total_amount), 0),
    })

    automationSignals.push(...buildAutomationSignals(insight, openInvoices, overdueInvoices))

    for (const tx of vendorTx) {
      const status = (tx.status || '').toLowerCase()
      if (!PENDING_STATUSES.has(status)) continue
      quotePipeline.push({
        transactionId: tx.id,
        vendorId: insight.id,
        vendorName: insight.displayName,
        amount: toAmount(tx.total_amount),
        dueDate: tx.due_date ?? undefined,
        status: status || 'pending',
        propertyId: null,
        propertyName: undefined,
        buildiumBillId: tx.buildium_bill_id ?? undefined,
        memo: tx.memo ?? undefined,
        referenceNumber: tx.reference_number ?? undefined,
      })
    }

    for (const wo of vendorWos) {
      const property = wo.property_id ? propertyMap.get(wo.property_id) : null
      const addressParts = [property?.address_line1, property?.city, property?.state]
        .filter(Boolean)
        .join(', ')

      schedule.push({
        workOrderId: wo.id,
        vendorId: insight.id,
        vendorName: insight.displayName,
        subject: wo.subject,
        status: wo.status,
        priority: wo.priority,
        scheduledDate: wo.scheduled_date ?? null,
        propertyId: wo.property_id ?? null,
        propertyName: property?.name,
        propertyAddress: addressParts || undefined,
        buildiumWorkOrderId: wo.buildium_work_order_id ?? undefined,
      })
    }
  }

  const topVendors = [...vendors]
    .sort((a, b) => b.spendYtd - a.spendYtd)
    .slice(0, 5)
  const highRiskVendors = vendors
    .filter((v) => v.complianceStatus !== 'ok' || v.overdueInvoices > 0)
    .sort((a, b) => b.overdueInvoices - a.overdueInvoices || b.openWorkOrders - a.openWorkOrders)
    .slice(0, 5)
  const totalOutstanding = quotePipeline.reduce((sum, q) => sum + q.amount, 0)
  const totalOpenWorkOrders = vendors.reduce((sum, v) => sum + v.openWorkOrders, 0)

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalVendors: vendors.length,
      activeVendors: vendors.filter((v) => v.isActive).length,
      flaggedCompliance: flaggedComplianceCount,
      pendingApprovals,
      monthlySpend,
      ytdSpend,
    },
    vendors,
    spendByVendor: spendByVendor.sort((a, b) => b.spendYtd - a.spendYtd),
    quotePipeline: quotePipeline.sort((a, b) => {
      const dueA = toDate(a.dueDate || null)
      const dueB = toDate(b.dueDate || null)
      if (dueA && dueB) return dueA.getTime() - dueB.getTime()
      if (dueA) return -1
      if (dueB) return 1
      return b.amount - a.amount
    }),
    schedule: schedule.sort((a, b) => {
      const dateA = toDate(a.scheduledDate)
      const dateB = toDate(b.scheduledDate)
      if (dateA && dateB) return dateA.getTime() - dateB.getTime()
      if (dateA) return -1
      if (dateB) return 1
      return 0
    }),
    complianceAlerts,
    automationSignals,
    aiSnapshot: {
      topVendors,
      highRiskVendors,
      totalOutstanding,
      totalOpenWorkOrders,
    },
  }
}
