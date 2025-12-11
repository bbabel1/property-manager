'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

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

const statusMap: Record<StatusChip, { label: string; className: string }> = {
  on_track: { label: 'On Track', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  at_risk: { label: 'At Risk', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  non_compliant: { label: 'Non-compliant', className: 'bg-rose-50 text-rose-700 border-rose-200' },
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
            <div className="text-lg font-semibold leading-tight">{propertyName}</div>
            <Badge variant="outline" className="text-xs">{jurisdiction}</Badge>
            <Badge variant="outline" className={cn('text-xs', statusInfo.className)}>{statusInfo.label}</Badge>
          </div>
          <div className="text-sm text-muted-foreground">{addressLine1}</div>
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
                <div className="text-xs text-muted-foreground">{kpi.label}</div>
                <div className="text-base font-semibold leading-tight">{kpi.value}</div>
                {kpi.subtle && <div className="text-[11px] text-muted-foreground">{kpi.subtle}</div>}
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
