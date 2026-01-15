'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Inspection = {
  id: string
  inspection_date: string | null
  inspection_type: string | null
  event_type?: string | null
  compliance_status?: string | null
  device?: string | null
  tracking_id?: string | null
  agency?: string | null
}

const resultMap: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' }> = {
  pass: { label: 'Pass', variant: 'success' },
  defects: { label: 'Defects', variant: 'warning' },
  fail: { label: 'Fail', variant: 'danger' },
}

function ResultPill({ value }: { value?: string | null }) {
  if (!value) return null
  const key = value.toLowerCase()
  const info = resultMap[key] || { label: value, variant: 'info' }
  return <Badge variant={info.variant} className="text-xs">{info.label}</Badge>
}

export function ComplianceInspectionsTable({ inspections }: { inspections: Inspection[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Inspections & Filings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Tracking ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inspections.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                    No inspections on record. Try widening the date range or sync data.
                  </TableCell>
                </TableRow>
              )}
              {inspections.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm">{row.inspection_date ? new Date(row.inspection_date).toLocaleDateString() : '—'}</TableCell>
                  <TableCell className="text-sm">{row.inspection_type || row.event_type || 'Inspection'}</TableCell>
                  <TableCell><ResultPill value={row.compliance_status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.agency || 'DOB'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.device || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.tracking_id || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
