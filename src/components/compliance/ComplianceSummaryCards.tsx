'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Clock, TrendingUp } from 'lucide-react'

interface ComplianceSummaryCardsProps {
  openViolations: number
  overdueItems: number
  itemsDueNext30Days: number
  averageRiskScore: number | null
}

export function ComplianceSummaryCards({
  openViolations,
  overdueItems,
  itemsDueNext30Days,
  averageRiskScore,
}: ComplianceSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Open Violations</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{openViolations}</div>
          <p className="text-xs text-muted-foreground">Active compliance violations</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overdue Items</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{overdueItems}</div>
          <p className="text-xs text-muted-foreground">Past due compliance items</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Due in Next 30 Days</CardTitle>
          <Clock className="h-4 w-4 text-warning" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{itemsDueNext30Days}</div>
          <p className="text-xs text-muted-foreground">Upcoming compliance deadlines</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Average Risk Score</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {averageRiskScore !== null ? Math.round(averageRiskScore) : '—'}
          </div>
          <p className="text-xs text-muted-foreground">
            {averageRiskScore !== null ? 'Portfolio risk level' : 'No data available'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
