'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import type { ComplianceViolationWithRelations } from '@/types/compliance'

interface ViolationsListProps {
  violations: ComplianceViolationWithRelations[]
  assetFilter?: string | null
  filterLabel?: string
  onClearFilter?: () => void
  statusFilter?: 'all' | 'open' | 'closed'
  onStatusChange?: (val: 'all' | 'open' | 'closed') => void
  onView?: (violation: ComplianceViolationWithRelations) => void
}

export function ViolationsList({
  violations,
  assetFilter,
  filterLabel,
  onClearFilter,
  statusFilter = 'all',
  onStatusChange,
  onView,
}: ViolationsListProps) {
  const [selectedViolation, setSelectedViolation] = useState<ComplianceViolationWithRelations | null>(null)
  const getAgencyBadge = (agency: string) => {
    const colors: Record<string, string> = {
      DOB: 'bg-blue-100 text-blue-700 border-blue-300',
      HPD: 'bg-green-100 text-green-700 border-green-300',
      FDNY: 'bg-red-100 text-red-700 border-red-300',
      DEP: 'bg-blue-100 text-blue-700 border-blue-300',
    }

    return (
      <Badge variant="outline" className={colors[agency] || ''}>
        {agency}
      </Badge>
    )
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
      open: 'destructive',
      in_progress: 'outline',
      cleared: 'default',
      closed: 'secondary',
    }

    return (
      <Badge variant={variants[status] || 'outline'} className="text-xs">
        {status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
      </Badge>
    )
  }

  const formatDate = (date: string | null) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const filteredViolations = useMemo(() => {
    let result = violations
    if (assetFilter) {
      result = result.filter((v) => v.asset_id === assetFilter)
    }
    if (statusFilter === 'open') {
      result = result.filter((v) => v.status === 'open' || v.status === 'in_progress')
    }
    if (statusFilter === 'closed') {
      result = result.filter((v) => v.status === 'closed' || v.status === 'cleared')
    }
    return result
  }, [assetFilter, statusFilter, violations])

  const renderAsset = (violation: ComplianceViolationWithRelations) => {
    const asset = violation.asset
    if (!asset) {
      return <span className="text-muted-foreground text-xs">Property</span>
    }
    return (
      <div className="flex items-center gap-2">
        <Link href={`/compliance/assets/${asset.id}`} className="text-primary hover:underline text-sm">
          {asset.external_source_id || asset.name || 'Asset'}
        </Link>
        {asset.asset_type ? (
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            {asset.asset_type}
          </Badge>
        ) : null}
      </div>
    )
  }

  const renderCategory = (category: string) => {
    const label = category.replace(/_/g, ' ')
    const variant = category === 'complaint' ? 'outline' : 'secondary'
    return (
      <Badge variant={variant} className="text-[10px] uppercase tracking-wide">
        {label}
      </Badge>
    )
  }

  return (
    <div className="rounded-md border">
      <div className="flex flex-col gap-2 px-4 py-3 border-b bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={statusFilter === 'all' ? 'secondary' : 'ghost'}
              onClick={() => onStatusChange?.('all')}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'open' ? 'secondary' : 'ghost'}
              onClick={() => onStatusChange?.('open')}
            >
              Open
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'closed' ? 'secondary' : 'ghost'}
              onClick={() => onStatusChange?.('closed')}
            >
              Closed
            </Button>
          </div>
        </div>
        {assetFilter ? (
          <div className="flex items-center gap-3">
            <div className="text-sm">
              Showing violations linked to{' '}
              <span className="font-semibold">{filterLabel || assetFilter}</span>
            </div>
            {onClearFilter ? (
              <Button variant="ghost" size="sm" onClick={onClearFilter}>
                Clear filter
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Violation Number</TableHead>
            <TableHead>Agency</TableHead>
            <TableHead>Asset</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Issued Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Cure By Date</TableHead>
            <TableHead>Work Order</TableHead>
            <TableHead className="text-right">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredViolations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                No violations found
              </TableCell>
            </TableRow>
          ) : (
            filteredViolations.map((violation) => (
              <TableRow key={violation.id} className="hover:bg-muted/40">
                <TableCell className="font-mono text-sm">{violation.violation_number}</TableCell>
                <TableCell>{getAgencyBadge(violation.agency)}</TableCell>
                <TableCell>{renderAsset(violation)}</TableCell>
                <TableCell>{renderCategory(violation.category)}</TableCell>
                <TableCell>{formatDate(violation.issue_date)}</TableCell>
                <TableCell className="max-w-md truncate">{violation.description}</TableCell>
                <TableCell>{getStatusBadge(violation.status)}</TableCell>
                <TableCell>
                  {violation.cure_by_date ? (
                    <span
                      className={
                        violation.status === 'open' && new Date(violation.cure_by_date) < new Date()
                          ? 'font-semibold text-destructive'
                          : ''
                      }
                    >
                      {formatDate(violation.cure_by_date)}
                    </span>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>
                  {violation.linked_work_order_id ? (
                    <Link
                      href={`/maintenance?workOrderId=${violation.linked_work_order_id}`}
                      className="text-primary hover:underline text-sm"
                    >
                      View Work Order
                    </Link>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => (onView ? onView(violation) : setSelectedViolation(violation))}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {onView ? null : selectedViolation ? (
        <div className="border-t px-4 py-3 bg-background">
          <ViolationDetail
            violation={selectedViolation}
            onClose={() => setSelectedViolation(null)}
            formatDate={formatDate}
            getStatusBadge={getStatusBadge}
            getAgencyBadge={getAgencyBadge}
          />
        </div>
      ) : null}
    </div>
  )
}

function ViolationDetail({
  violation,
  onClose,
  formatDate,
  getStatusBadge,
  getAgencyBadge,
}: {
  violation: ComplianceViolationWithRelations
  onClose: () => void
  formatDate: (date: string | null) => string
  getStatusBadge: (status: string) => React.ReactNode
  getAgencyBadge: (agency: string) => React.ReactNode
}) {
  const metaEntries = Object.entries(violation.metadata || {}).slice(0, 24)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="font-mono text-sm">{violation.violation_number}</div>
          {getAgencyBadge(violation.agency)}
          {getStatusBadge(violation.status)}
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            {violation.category}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-muted-foreground text-xs uppercase">Issued</div>
          <div>{formatDate(violation.issue_date)}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs uppercase">Cure by</div>
          <div>{formatDate(violation.cure_by_date)}</div>
        </div>
        <div className="col-span-2">
          <div className="text-muted-foreground text-xs uppercase">Description</div>
          <div className="mt-1 leading-snug">{violation.description}</div>
        </div>
        <div className="col-span-2">
          <div className="text-muted-foreground text-xs uppercase">Asset</div>
          {violation.asset ? (
            <Link
              href={`/compliance/assets/${violation.asset.id}`}
              className="text-primary hover:underline"
            >
              {violation.asset.external_source_id || violation.asset.name || violation.asset.id}
            </Link>
          ) : (
            <span className="text-muted-foreground">Property-level</span>
          )}
        </div>
      </div>
      {metaEntries.length ? (
        <div className="border rounded-md p-3 bg-muted/40">
          <div className="text-xs uppercase text-muted-foreground mb-2">Metadata (sample)</div>
          <div className="text-xs space-y-1 max-h-48 overflow-auto">
            {metaEntries.map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <span className="font-mono text-[11px] text-muted-foreground">{key}:</span>
                <span className="truncate text-[11px]">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
