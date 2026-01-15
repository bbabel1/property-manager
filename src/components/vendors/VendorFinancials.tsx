"use client"

import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import type { QuotePipelineItem, VendorDashboardData, VendorSpendInsight } from '@/lib/vendor-service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, FileText, RefreshCcw } from 'lucide-react'
import { Body, Heading, Label } from '@/ui/typography'

interface VendorFinancialsProps {
  spend: VendorSpendInsight[]
  quotePipeline: QuotePipelineItem[]
  summary: VendorDashboardData['summary']
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)

const statusCopy: Record<string, { label: string; tone: 'default' | 'warning' | 'danger' }> = {
  pending: { label: 'Pending approval', tone: 'warning' },
  awaiting_approval: { label: 'Awaiting approval', tone: 'warning' },
  review: { label: 'In review', tone: 'warning' },
  submitted: { label: 'Submitted', tone: 'default' },
  overdue: { label: 'Overdue', tone: 'danger' },
}

function statusBadge(status: string) {
  const meta = statusCopy[status] ?? { label: status, tone: 'default' as const }
  if (meta.tone === 'warning') {
    return <Badge className="bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">{meta.label}</Badge>
  }
  if (meta.tone === 'danger') {
    return <Badge className="bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-200">{meta.label}</Badge>
  }
  return <Badge variant="outline">{meta.label}</Badge>
}

export function VendorFinancials({ spend, quotePipeline, summary }: VendorFinancialsProps) {
  const topSpend = useMemo(() => spend.slice(0, 6), [spend])
  const chartData = useMemo(
    () =>
      topSpend.map((vendor) => ({
        vendor: vendor.vendorName,
        ytd: Math.round(vendor.spendYtd),
        monthly: Math.round(vendor.spendLastMonth),
        open: Math.round(vendor.openBalance),
      })),
    [topSpend]
  )

  const outstanding = useMemo(
    () => quotePipeline.reduce((sum, quote) => sum + quote.amount, 0),
    [quotePipeline]
  )

  const chartConfig = {
    ytd: {
      label: 'YTD spend',
      color: 'hsl(222.2 47.4% 11.2%)',
    },
    monthly: {
      label: 'Last 30 days',
      color: 'hsl(221.2 83.2% 53.3%)',
    },
    open: {
      label: 'Open balance',
      color: 'hsl(47.9 95.8% 53.1%)',
    },
  }
  const ytdColor = chartConfig.ytd.color || 'hsl(222.2 47.4% 11.2%)'
  const monthlyColor = chartConfig.monthly.color || 'hsl(221.2 83.2% 53.3%)'
  const openColor = chartConfig.open.color || 'hsl(47.9 95.8% 53.1%)'

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle headingSize="h5">Spend by vendor</CardTitle>
              <CardDescription>Live Buildium transactions with automation-ready insights.</CardDescription>
            </div>
            <Button size="sm" variant="outline" className="gap-2">
              <RefreshCcw className="h-4 w-4" /> Sync Buildium
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
              <Label as="p" size="xs" tone="muted">
                Monthly spend
              </Label>
              <Heading as="p" size="h5" className="text-foreground">
                {formatCurrency(summary.monthlySpend)}
              </Heading>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
              <Label as="p" size="xs" tone="muted">
                YTD spend
              </Label>
              <Heading as="p" size="h5" className="text-foreground">
                {formatCurrency(summary.ytdSpend)}
              </Heading>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
              <Label as="p" size="xs" tone="muted">
                Outstanding quotes
              </Label>
              <Heading as="p" size="h5" className="text-foreground">
                {formatCurrency(outstanding)}
              </Heading>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ChartContainer className="h-[300px]" config={chartConfig}>
              <BarChart data={chartData} margin={{ top: 10, left: 10, right: 10, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="vendor" tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} width={60} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="ytd" fill={ytdColor} radius={4} />
                <Bar dataKey="monthly" fill={monthlyColor} radius={4} />
                <Bar dataKey="open" fill={openColor} radius={4} />
              </BarChart>
            </ChartContainer>
          ) : (
            <Body
              as="div"
              size="sm"
              tone="muted"
              className="flex h-[300px] items-center justify-center rounded-md border border-dashed border-border/70 text-center"
            >
              No vendor spend data available yet.
            </Body>
          )}
        </CardContent>
      </Card>
      <Card className="flex flex-col">
        <CardHeader className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle headingSize="h5">Quotes & approvals</CardTitle>
              <CardDescription>Auto-organized by status with full approval audit trail.</CardDescription>
            </div>
            <Button size="sm" variant="outline" className="gap-2">
              <FileText className="h-4 w-4" /> Export summary
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <Body
            as="div"
            size="xs"
            tone="muted"
            className="mb-3 flex items-center justify-between"
          >
            <span>{quotePipeline.length} open quotes</span>
            <span>Last sync {new Date().toLocaleString()}</span>
          </Body>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="w-[32%]">
                    <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                      Vendor
                    </Label>
                  </TableHead>
                  <TableHead className="w-[18%]">
                    <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                      Amount
                    </Label>
                  </TableHead>
                  <TableHead className="w-[18%]">
                    <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                      Due date
                    </Label>
                  </TableHead>
                  <TableHead className="w-[18%]">
                    <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                      Status
                    </Label>
                  </TableHead>
                  <TableHead className="w-[14%] text-right">
                    <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                      Actions
                    </Label>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotePipeline.slice(0, 8).map((quote) => (
                  <TableRow key={quote.transactionId} className="align-top">
                    <TableCell>
                      <div className="flex flex-col">
                        <Label as="span">{quote.vendorName}</Label>
                        {quote.memo ? (
                          <Body as="span" size="xs" tone="muted">
                            {quote.memo}
                          </Body>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(quote.amount)}</TableCell>
                    <TableCell>{quote.dueDate ? new Date(quote.dueDate).toLocaleDateString() : '—'}</TableCell>
                    <TableCell>{statusBadge(quote.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="gap-1 text-primary">
                        View <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {quotePipeline.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center">
                      <Body as="div" size="sm" tone="muted">
                        All caught up—no quotes pending approval right now.
                      </Body>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default VendorFinancials
