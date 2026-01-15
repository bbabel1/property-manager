'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Body, Heading, Label } from '@/ui/typography'

type StatusChip = 'on_track' | 'at_risk' | 'non_compliant'

type KPI = {
  label: string
  value: string
  subtle?: string | null
}

interface ComplianceSummaryHeaderProps {
  propertyName: string
  addressLine1: string
  jurisdiction?: string
  status: StatusChip
  kpis: KPI[]
  onSync?: () => void
  actions?: React.ReactNode
}

const statusMap: Record<StatusChip, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  on_track: { label: 'On Track', variant: 'success' },
  at_risk: { label: 'At Risk', variant: 'warning' },
  non_compliant: { label: 'Non-compliant', variant: 'danger' },
}

export function ComplianceSummaryHeader({
  propertyName,
  addressLine1,
  jurisdiction = 'NYC – DOB / HPD / FDNY',
  status,
  kpis,
  onSync,
  actions,
}: ComplianceSummaryHeaderProps) {
  const statusInfo = statusMap[status]
  return (
    <Card className="border border-muted-200">
      <CardContent className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between py-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Heading as="div" size="h4" className="leading-tight text-foreground">
              {propertyName}
            </Heading>
            <Badge variant="outline" className="text-xs">{jurisdiction}</Badge>
            <Badge variant={statusInfo.variant} className="text-xs">{statusInfo.label}</Badge>
          </div>
          <Body as="div" size="sm" tone="muted">
            {addressLine1}
          </Body>
        </div>

        <div className="flex flex-col gap-3 items-start md:items-end w-full md:w-auto">
          {(actions || onSync) && (
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              {actions}
              {onSync && (
                <Button size="sm" variant="outline" onClick={onSync} className="whitespace-nowrap">
                  Sync now
                </Button>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="min-w-[120px]">
                <Label as="div" size="xs" tone="muted">
                  {kpi.label}
                </Label>
                <Heading as="div" size="h6" className="leading-tight">
                  {kpi.value}
                </Heading>
                {kpi.subtle && (
                  <Body as="div" size="xs" tone="muted">
                    {kpi.subtle}
                  </Body>
                )}
              </div>
            ))}
          </div>
          {onSync && (
            <Button size="sm" variant="outline" onClick={onSync} className="whitespace-nowrap">Sync now</Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
