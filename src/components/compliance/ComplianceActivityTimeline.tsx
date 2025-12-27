'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react'

type Activity = {
  type: 'event' | 'violation'
  date: string
  title: string | null
  status?: string | null
  agency?: string | null
}

function iconFor(type: string, status?: string | null) {
  if (type === 'violation') return <AlertTriangle className="h-4 w-4 text-rose-600" />
  if (status && status.toLowerCase().includes('pass')) return <CheckCircle2 className="h-4 w-4 text-emerald-600" />
  return <Calendar className="h-4 w-4 text-muted-foreground" />
}

export function ComplianceActivityTimeline({ items }: { items: Activity[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Recent Compliance Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[420px] overflow-auto">
        {items.length === 0 && <div className="text-sm text-muted-foreground">No recent activity.</div>}
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-3 border-b border-muted-100 pb-2 last:border-none">
            <div className="mt-1">{iconFor(item.type, item.status)}</div>
            <div className="flex-1">
              <div className="text-sm font-medium leading-tight">{item.title || 'Event'}</div>
              <div className="text-xs text-muted-foreground">{item.date ? new Date(item.date).toLocaleDateString() : '—'}{item.agency ? ` • ${item.agency}` : ''}</div>
              {item.status && (
                <Badge variant="outline" className="mt-1 text-[11px]">
                  {item.type === 'event' && item.status.toLowerCase() === 'removed' ? 'Device retired' : item.status}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
