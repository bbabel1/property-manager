"use client"

import { useMemo, useState, useTransition } from 'react'
import type { VendorDashboardData } from '@/lib/vendor-service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, MessageCircle, SendHorizontal, Sparkles } from 'lucide-react'
import { cn } from '@/components/ui/utils'

interface VendorAiPanelProps {
  snapshot: VendorDashboardData['aiSnapshot']
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

const QUICK_PROMPTS = [
  'Draft a multi-vendor RFQ email for upcoming HVAC maintenance at our highest-risk properties.',
  'Compare the top three plumbing vendors and highlight any compliance gaps before approvals.',
  'Suggest vendors for an emergency roof repair at 145 Beacon Street and draft outreach.',
]

export function VendorAiPanel({ snapshot }: VendorAiPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const intro = buildIntroMessage(snapshot)
    return intro ? [{ role: 'assistant', content: intro, timestamp: Date.now() }] : []
  })
  const [input, setInput] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const quickSummary = useMemo(() => buildOverview(snapshot), [snapshot])

  const sendMessage = (prompt: string) => {
    if (!prompt.trim()) {
      return
    }
    const userMessage: ChatMessage = { role: 'user', content: prompt.trim(), timestamp: Date.now() }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setError(null)

    startTransition(async () => {
      try {
        const response = await fetch('/api/vendors/ai/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, snapshot }),
        })
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload?.error || 'AI assistant failed')
        }
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: payload.answer as string,
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, assistantMessage])
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unexpected error'
        setError(message)
      }
    })
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">AI vendor copilots</CardTitle>
            <CardDescription>Generate outreach, compare quotes, and resolve bottlenecks instantly.</CardDescription>
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            {snapshot.totalOpenWorkOrders} active work orders
          </Badge>
        </div>
        {quickSummary ? (
          <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-xs text-primary">
            {quickSummary}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <ScrollArea className="flex-1 rounded-lg border">
          <div className="space-y-3 p-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  'flex w-full flex-col gap-1',
                  message.role === 'assistant' ? 'items-start' : 'items-end'
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm',
                    message.role === 'assistant'
                      ? 'bg-muted text-foreground'
                      : 'bg-primary text-primary-foreground'
                  )}
                >
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide">
                    {message.role === 'assistant' ? <Sparkles className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />}
                    {message.role === 'assistant' ? 'AI assistant' : 'You'}
                  </div>
                  <div className="mt-1 whitespace-pre-wrap leading-relaxed">{message.content}</div>
                </div>
              </div>
            ))}
            {messages.length === 0 ? (
              <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-5 w-5 text-primary" />
                Ask the assistant to source vendors, compare quotes, or draft communications.
              </div>
            ) : null}
          </div>
        </ScrollArea>
        {error ? <div className="text-xs text-red-600">{error}</div> : null}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            {QUICK_PROMPTS.map((prompt) => (
              <Button key={prompt} type="button" variant="outline" size="sm" onClick={() => sendMessage(prompt)}>
                {prompt}
              </Button>
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              sendMessage(input)
            }}
            className="flex flex-col gap-2"
          >
            <Textarea
              placeholder="Ask anything about vendors, quotes, schedules, or compliance..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={3}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Includes property, transaction, and compliance context automatically.</span>
              <Button type="submit" size="sm" disabled={isPending || !input.trim()} className="gap-2">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                Send
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}

function buildIntroMessage(snapshot: VendorDashboardData['aiSnapshot']) {
  if (!snapshot.topVendors?.length) return ''
  const top = snapshot.topVendors.slice(0, 3)
  const vendorText = top.map((vendor) => `${vendor.displayName} (${vendor.categoryName ?? 'General'})`).join(', ')
  return `Loaded vendor intelligence. Top performers right now: ${vendorText}. Outstanding approvals total ${formatCurrency(
    snapshot.totalOutstanding
  )}.`
}

function buildOverview(snapshot: VendorDashboardData['aiSnapshot']) {
  const highRisk = snapshot.highRiskVendors.filter((vendor) => vendor.complianceStatus !== 'ok')
  if (!highRisk.length) {
    return 'All vendors are compliant. Automation is monitoring open invoices and work orders in real-time.'
  }
  const detail = highRisk
    .slice(0, 2)
    .map((vendor) => `${vendor.displayName} (${vendor.complianceStatus}${vendor.overdueInvoices ? `, ${vendor.overdueInvoices} overdue invoice${vendor.overdueInvoices > 1 ? 's' : ''}` : ''})`)
    .join('; ')
  return `Heads up: ${detail}. Consider triggering compliance automation before scheduling new work.`
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)

export default VendorAiPanel
