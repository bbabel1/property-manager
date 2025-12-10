'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

interface PropertyComplianceHeaderProps {
  propertyName: string
  addressLine1: string
  borough: string | null
  bin: string | null
  openViolations: number
  overdueItems: number
  itemsDueNext30Days: number
  onExportPDF?: () => void
}

export function PropertyComplianceHeader({
  propertyName,
  addressLine1,
  borough,
  bin,
  openViolations,
  overdueItems,
  itemsDueNext30Days,
  onExportPDF,
}: PropertyComplianceHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">{propertyName}</h2>
          <p className="text-sm text-muted-foreground">{addressLine1}</p>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            {borough && <span>{borough}</span>}
            {bin && (
              <>
                {borough && <span>•</span>}
                <span>BIN: {bin}</span>
              </>
            )}
          </div>
        </div>
        {onExportPDF && (
          <Button variant="outline" size="sm" onClick={onExportPDF}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {openViolations > 0 && (
          <Badge variant="destructive">
            {openViolations} Open Violation{openViolations !== 1 ? 's' : ''}
          </Badge>
        )}
        {overdueItems > 0 && (
          <Badge variant="destructive">
            {overdueItems} Overdue Item{overdueItems !== 1 ? 's' : ''}
          </Badge>
        )}
        {itemsDueNext30Days > 0 && (
          <Badge variant="outline" className="border-warning text-warning">
            {itemsDueNext30Days} Due in Next 30 Days
          </Badge>
        )}
        {openViolations === 0 && overdueItems === 0 && itemsDueNext30Days === 0 && (
          <Badge variant="outline" className="border-success text-success">
            All Clear
          </Badge>
        )}
      </div>
    </div>
  )
}

