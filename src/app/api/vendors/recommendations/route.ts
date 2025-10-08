import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getVendorDashboardData } from '@/lib/vendor-service'

const requestSchema = z.object({
  propertyQuery: z.string().optional(),
  jobCategory: z.string().optional(),
  budget: z.number().optional(),
  notes: z.string().optional(),
  snapshot: z.any().optional(),
})

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  plumbing: ['plumbing', 'leak', 'pipe', 'water'],
  electrical: ['electrical', 'lighting', 'power'],
  hvac: ['hvac', 'vent', 'climate', 'ac', 'air'],
  landscaping: ['landscape', 'garden', 'grounds'],
  roofing: ['roof', 'gutter', 'shingle'],
  cleaning: ['clean', 'janitorial', 'turnover'],
  general: ['general', 'maintenance', 'repair'],
}

const safeText = (value?: string | null) => (value || '').toLowerCase()

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export async function POST(request: Request) {
  try {
    const raw = await request.json().catch(() => ({}))
    const parsed = requestSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const { propertyQuery, jobCategory = 'general', notes = '', budget } = parsed.data

    const dashboard = await getVendorDashboardData()

    const keywords = new Set<string>([
      jobCategory.toLowerCase(),
      ...(CATEGORY_KEYWORDS[jobCategory.toLowerCase()] ?? []),
      ...notes
        .split(/[^a-zA-Z]+/)
        .map((word) => word.toLowerCase())
        .filter((word) => word.length > 3),
    ])

    const locationTokens = propertyQuery
      ? propertyQuery
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((token) => token.length > 2)
      : []

    const recommendations = dashboard.vendors
      .map((vendor) => {
        const categoryMatch = vendor.categoryName ? safeText(vendor.categoryName).includes(jobCategory.toLowerCase()) : false
        const keywordsMatch = vendor.automationSuggestions.some((suggestion) => keywords.has(suggestion.toLowerCase()))

        const addressText = [vendor.city, vendor.state].filter(Boolean).map((value) => value!.toLowerCase())
        const locationScore = locationTokens.length
          ? locationTokens.some((token) => addressText.some((segment) => segment.includes(token)))
            ? 0.15
            : 0
          : 0

        const compliancePenalty = vendor.complianceStatus === 'ok' ? 0 : vendor.complianceStatus === 'expiring' ? -0.2 : -0.35
        const overduePenalty = vendor.overdueInvoices > 0 ? Math.min(0, -0.1 * vendor.overdueInvoices) : 0
        const workloadPenalty = vendor.openWorkOrders > 2 ? -0.1 : 0

        const budgetBase = vendor.spendLast30 || vendor.spendYtd
        const budgetScore = budget && budgetBase
          ? clamp(1 - budget / Math.max(budgetBase, budget, 1), -0.05, 0.1)
          : 0

        const baseScore = vendor.reliabilityScore / 100
        const categoryBoost = categoryMatch ? 0.25 : 0
        const suggestionBoost = keywordsMatch ? 0.1 : 0

        const confidence = clamp(
          baseScore + categoryBoost + suggestionBoost + locationScore + compliancePenalty + overduePenalty + workloadPenalty + budgetScore,
          0.1,
          0.99
        )

        const rationaleParts: string[] = []
        rationaleParts.push(`Reliability score ${vendor.reliabilityScore}`)
        if (categoryMatch) rationaleParts.push('Category experience matches request')
        if (locationScore > 0) rationaleParts.push('Local to requested property')
        if (vendor.complianceStatus !== 'ok') rationaleParts.push(`Compliance status: ${vendor.complianceStatus}`)
        if (vendor.overdueInvoices > 0) rationaleParts.push(`${vendor.overdueInvoices} overdue invoice(s) flagged`)
        if (vendor.openWorkOrders > 0) rationaleParts.push(`${vendor.openWorkOrders} active work orders`)

        return {
          vendorName: vendor.displayName,
          vendorId: vendor.id,
          confidence,
          category: vendor.categoryName,
          complianceStatus: vendor.complianceStatus,
          buildiumVendorId: vendor.buildiumVendorId ?? null,
          rationale: rationaleParts.join(' • '),
          source: 'internal' as const,
        }
      })
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)

    return NextResponse.json({ recommendations })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to generate vendor recommendations' }, { status: 500 })
  }
}

