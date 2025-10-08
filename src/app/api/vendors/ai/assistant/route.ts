import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { VendorDashboardData, VendorInsight } from '@/lib/vendor-service'

const requestSchema = z.object({
  prompt: z.string().min(3),
  snapshot: z
    .object({
      topVendors: z.array(z.any()).optional(),
      highRiskVendors: z.array(z.any()).optional(),
      totalOutstanding: z.number().optional(),
      totalOpenWorkOrders: z.number().optional(),
    })
    .optional(),
})

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = 'gpt-4.1-mini'

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null)
  const parsed = requestSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { prompt, snapshot } = parsed.data
  const context = buildContext(snapshot)

  if (!process.env.OPENAI_API_KEY) {
    const fallback = buildHeuristicResponse(prompt, snapshot)
    return NextResponse.json({ answer: fallback, usedModel: 'heuristic' })
  }

  try {
    const body = JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are Ora Property Management\'s vendor operations copilot. Provide structured advice, actionable next steps, and reference Buildium-integrated workflows. Keep responses concise but detailed. Include bullet points where helpful.',
        },
        {
          role: 'user',
          content: `Context:\n${context}\n\nRequest:\n${prompt}`,
        },
      ],
    })

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body,
    })

    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload?.error?.message || 'OpenAI API error')
    }

    const answer = payload?.choices?.[0]?.message?.content || buildHeuristicResponse(prompt, snapshot)
    return NextResponse.json({ answer, usedModel: OPENAI_MODEL })
  } catch (error) {
    console.error('[vendors.ai.assistant] failed', error)
    const fallback = buildHeuristicResponse(prompt, snapshot)
    return NextResponse.json({ answer: fallback, usedModel: 'heuristic', warning: 'OpenAI request failed' })
  }
}

function buildContext(snapshot?: VendorDashboardData['aiSnapshot']) {
  if (!snapshot) return 'No snapshot data provided.'

  const topVendors = formatVendorList(snapshot.topVendors ?? [], 'Top vendors')
  const riskVendors = formatVendorList(snapshot.highRiskVendors ?? [], 'High-risk vendors')
  const totals = `Outstanding approvals: $${Math.round(snapshot.totalOutstanding ?? 0).toLocaleString()}\nOpen work orders: ${snapshot.totalOpenWorkOrders ?? 0}`

  return [topVendors, riskVendors, totals].filter(Boolean).join('\n\n')
}

function formatVendorList(vendors: VendorInsight[], title: string) {
  if (!vendors.length) return ''
  const lines = vendors.slice(0, 5).map((vendor) => {
    const compliance = vendor.complianceStatus === 'ok' ? 'compliant' : vendor.complianceStatus
    return `- ${vendor.displayName} • ${vendor.categoryName ?? 'General'} • Reliability ${vendor.reliabilityScore}/100 • Compliance ${compliance}`
  })
  return `${title}:\n${lines.join('\n')}`
}

function buildHeuristicResponse(prompt: string, snapshot?: VendorDashboardData['aiSnapshot']) {
  const lower = prompt.toLowerCase()
  const baseIntro = snapshot
    ? `Working with ${snapshot.topVendors?.length ?? 0} active vendors (${snapshot.totalOpenWorkOrders ?? 0} work orders open).`
    : 'Working with vendor intelligence loaded.'

  if (['compare', 'comparison', 'vs'].some((term) => lower.includes(term)) && snapshot?.topVendors?.length) {
    const rows = snapshot.topVendors.slice(0, 3).map((vendor) => {
      const compliance = vendor.complianceStatus === 'ok' ? 'In good standing' : `Compliance: ${vendor.complianceStatus}`
      return `• ${vendor.displayName} — Reliability ${vendor.reliabilityScore}/100, ${vendor.overdueInvoices} overdue invoices, ${compliance}.`
    })
    return `${baseIntro}\n\nComparison summary:\n${rows.join('\n')}\n\nRecommended next step: request refreshed quotes from the top two vendors and route approvals through the automated workflow.`
  }

  if (['email', 'outreach', 'draft', 'message'].some((term) => lower.includes(term))) {
    const target = snapshot?.highRiskVendors?.[0] || snapshot?.topVendors?.[0]
    const vendorName = target?.displayName ?? 'your selected vendor'
    return `${baseIntro}\n\nSubject: Quote Request for Upcoming Work\n\nHi ${vendorName},\n\nWe have an upcoming service need and would love to invite you to submit a quote. Key details:\n- Timeline: Next 7-10 days\n- Scope: ${prompt}\n- Budget guidance: aligned with recent jobs\n\nPlease reply with availability, updated COI (if due), and any questions.\n\nThanks,\nOra Property Management`
  }

  if (['schedule', 'availability', 'calendar'].some((term) => lower.includes(term))) {
    return `${baseIntro}\n\nScheduling guidance:\n- Identify top vendors with open work orders and provide them with three auto-generated time slots.\n- Sync confirmed slots to both Google Calendar and Buildium.\n- Flag conflicts for property managers so tenants receive consistent notifications.`
  }

  return `${baseIntro}\n\nRecommended focus areas:\n- Address compliance for ${snapshot?.highRiskVendors?.length ?? 0} flagged vendors via automated COI workflow.\n- Review ${snapshot?.totalOutstanding ? `$${Math.round(snapshot.totalOutstanding).toLocaleString()} outstanding approvals` : 'pending approvals'} before next disbursement run.\n- Use the automation panel to trigger reminders for overdue invoices and high-priority work orders.`
}

