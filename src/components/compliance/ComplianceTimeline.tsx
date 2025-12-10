'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertCircle, Clock, Calendar } from 'lucide-react'
import type { ComplianceEvent, ComplianceItem } from '@/types/compliance'

interface ComplianceTimelineProps {
  items: ComplianceItem[]
  events: ComplianceEvent[]
}

export function ComplianceTimeline({ items, events }: ComplianceTimelineProps) {
  // Combine items and events, sort by date
  const timelineItems = [
    ...items.map((item) => ({
      type: 'item' as const,
      date: item.due_date,
      label: `Due: ${item.due_date}`,
      status: item.status,
      data: item,
    })),
    ...events.map((event) => ({
      type: 'event' as const,
      date: event.inspection_date || event.filed_date || event.created_at,
      label: event.inspection_type || event.event_type,
      status: event.compliance_status,
      data: event,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getStatusIcon = (status: string) => {
    if (status === 'overdue' || status === 'failed') {
      return <AlertCircle className="h-4 w-4 text-destructive" />
    }
    if (status === 'accepted' || status === 'cleared') {
      return <CheckCircle className="h-4 w-4 text-success" />
    }
    if (status === 'scheduled' || status === 'not_started') {
      return <Clock className="h-4 w-4 text-warning" />
    }
    return <Calendar className="h-4 w-4 text-muted-foreground" />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compliance Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {timelineItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No compliance activity</p>
          ) : (
            timelineItems.map((item, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="mt-1">{getStatusIcon(item.status || '')}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(item.date)}</span>
                  </div>
                  {item.status && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      {item.status}
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

