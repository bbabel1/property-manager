'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ExternalLink, Eye } from 'lucide-react'
import type { ComplianceItemWithRelations } from '@/types/compliance'

interface ComplianceChecklistTableProps {
  items: ComplianceItemWithRelations[]
  onViewItem?: (itemId: string) => void
}

export function ComplianceChecklistTable({
  items,
  onViewItem,
}: ComplianceChecklistTableProps) {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
      overdue: 'destructive',
      failed: 'destructive',
      accepted_with_defects: 'outline',
      accepted: 'default',
      scheduled: 'outline',
      not_started: 'secondary',
      in_progress: 'outline',
    }

    return (
      <Badge variant={variants[status] || 'outline'} className="text-xs">
        {status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
      </Badge>
    )
  }

  const formatDate = (date: string) => {
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
            <TableHead>Program</TableHead>
            <TableHead>Asset</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Event</TableHead>
            <TableHead>Next Action</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                No compliance items found
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  {item.program?.name || 'Unknown Program'}
                </TableCell>
                <TableCell>
                  {item.asset ? (
                    <Link
                      href={`/compliance/assets/${item.asset.id}`}
                      className="text-primary hover:underline"
                    >
                      {item.asset.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Building-wide</span>
                  )}
                </TableCell>
                <TableCell>
                  {formatDate(item.period_start)} - {formatDate(item.period_end)}
                </TableCell>
                <TableCell>
                  <span
                    className={
                      item.status === 'overdue'
                        ? 'font-semibold text-destructive'
                        : item.status === 'scheduled' || item.status === 'not_started'
                        ? 'text-warning'
                        : ''
                    }
                  >
                    {formatDate(item.due_date)}
                  </span>
                </TableCell>
                <TableCell>{getStatusBadge(item.status)}</TableCell>
                <TableCell>
                  {item.events && item.events.length > 0 ? (
                    <div className="text-sm">
                      <div>{formatDate(item.events[0].inspection_date || item.events[0].created_at)}</div>
                      <div className="text-muted-foreground">{item.events[0].compliance_status || '—'}</div>
                    </div>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {item.next_action || '—'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {onViewItem && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewItem(item.id)}
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    {item.external_tracking_number && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        title="View in DOB NOW"
                      >
                        <a
                          href={`https://a810-bisweb.nyc.gov/bisweb/`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

