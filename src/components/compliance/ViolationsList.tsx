'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ComplianceViolationWithRelations } from '@/types/compliance'

interface ViolationsListProps {
  violations: ComplianceViolationWithRelations[]
}

export function ViolationsList({ violations }: ViolationsListProps) {
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

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Violation Number</TableHead>
            <TableHead>Agency</TableHead>
            <TableHead>Issued Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Cure By Date</TableHead>
            <TableHead>Work Order</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {violations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No violations found
              </TableCell>
            </TableRow>
          ) : (
            violations.map((violation) => (
              <TableRow key={violation.id}>
                <TableCell className="font-mono text-sm">{violation.violation_number}</TableCell>
                <TableCell>{getAgencyBadge(violation.agency)}</TableCell>
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
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

