'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Violation = {
  id: string
  violation_number: string
  agency: string
  category?: 'violation' | 'complaint'
  device?: string | null
  issue_date: string
  status: string
  description?: string | null
}

const statusMap: Record<string, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  in_progress: { label: 'In progress', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  cleared: { label: 'Cleared', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  closed: { label: 'Closed', className: 'bg-slate-100 text-slate-700 border-slate-200' },
}

function StatusPill({ value }: { value: string }) {
  const key = value.toLowerCase()
  const info = statusMap[key] || { label: value, className: 'bg-muted text-foreground border-muted-foreground/20' }
  return <Badge variant="outline" className={info.className + ' text-xs'}>{info.label}</Badge>
}

export function ComplianceViolationsPanel({ violations }: { violations: Violation[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Violations & Issues</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Violation #</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {violations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                    No open violations. You're in good standing.
                  </TableCell>
                </TableRow>
              )}
              {violations.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.violation_number}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{v.agency}</TableCell>
                  <TableCell className="text-sm">
                    <Badge variant="secondary" className="text-xs">
                      {(v.category || 'violation') === 'complaint' ? 'Complaint' : 'Violation'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{v.device || '—'}</TableCell>
                  <TableCell className="text-sm">{v.issue_date ? new Date(v.issue_date).toLocaleDateString() : '—'}</TableCell>
                  <TableCell><StatusPill value={v.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground line-clamp-2">{v.description || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
