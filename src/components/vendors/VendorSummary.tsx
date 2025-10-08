import { ShieldAlert, Workflow, Users, CheckCircle, DollarSign } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { VendorDashboardData } from '@/lib/vendor-service'

interface VendorSummaryProps {
  data: VendorDashboardData
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value >= 1000 ? 0 : 2 }).format(value)

export function VendorSummary({ data }: VendorSummaryProps) {
  const cards = [
    {
      id: 'active',
      label: 'Active vendors',
      value: data.summary.activeVendors,
      helper: `${data.summary.totalVendors} total in network`,
      icon: Users,
    },
    {
      id: 'compliance',
      label: 'Compliance alerts',
      value: data.summary.flaggedCompliance,
      helper: 'Expiring or missing COIs',
      icon: ShieldAlert,
      variant: data.summary.flaggedCompliance > 0 ? 'destructive' : 'default',
    },
    {
      id: 'approvals',
      label: 'Pending approvals',
      value: data.summary.pendingApprovals,
      helper: 'Invoices awaiting finance review',
      icon: Workflow,
    },
    {
      id: 'monthly-spend',
      label: 'Spend this month',
      value: formatCurrency(data.summary.monthlySpend),
      helper: 'Connected to Buildium transactions',
      icon: DollarSign,
    },
    {
      id: 'ytd-spend',
      label: 'YTD spend',
      value: formatCurrency(data.summary.ytdSpend),
      helper: 'Across all properties',
      icon: CheckCircle,
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <Card
          key={card.id}
          className={card.variant === 'destructive' ? 'border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/20' : undefined}
        >
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              <CardDescription className="text-xs text-muted-foreground/80">{card.helper}</CardDescription>
            </div>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">
              {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default VendorSummary
