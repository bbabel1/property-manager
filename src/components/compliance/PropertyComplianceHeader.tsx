'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { Body, Heading } from '@/ui/typography'

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
          <Heading as="h2" size="h4">
            {propertyName}
          </Heading>
          <Body as="p" size="sm" tone="muted">
            {addressLine1}
          </Body>
          <div className="mt-2 flex items-center gap-2 text-muted-foreground">
            {borough && (
              <Body as="span" size="sm" tone="muted">
                {borough}
              </Body>
            )}
            {bin && (
              <>
                {borough && (
                  <Body as="span" size="sm" tone="muted">
                    •
                  </Body>
                )}
                <Body as="span" size="sm" tone="muted">
                  BIN: {bin}
                </Body>
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
          <Badge variant="danger">
            {openViolations} Open Violation{openViolations !== 1 ? 's' : ''}
          </Badge>
        )}
        {overdueItems > 0 && (
          <Badge variant="danger">
            {overdueItems} Overdue Item{overdueItems !== 1 ? 's' : ''}
          </Badge>
        )}
        {itemsDueNext30Days > 0 && (
          <Badge variant="warning">
            {itemsDueNext30Days} Due in Next 30 Days
          </Badge>
        )}
        {openViolations === 0 && overdueItems === 0 && itemsDueNext30Days === 0 && (
          <Badge variant="success">
            All Clear
          </Badge>
        )}
      </div>
    </div>
  )
}
