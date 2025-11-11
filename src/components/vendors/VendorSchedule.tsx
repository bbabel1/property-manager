import { CalendarClock, CalendarDays, MapPin, Wrench } from 'lucide-react'
import type { ScheduleItem } from '@/lib/vendor-service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface VendorScheduleProps {
  schedule: ScheduleItem[]
}

function formatDate(value: string | null) {
  if (!value) return 'Schedule pending'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Schedule pending'
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function VendorSchedule({ schedule }: VendorScheduleProps) {
  const upcoming = schedule
    .filter((item) => item.scheduledDate)
    .sort((a, b) => (a.scheduledDate && b.scheduledDate ? a.scheduledDate.localeCompare(b.scheduledDate) : 0))
    .slice(0, 6)

  const unscheduled = schedule.filter((item) => !item.scheduledDate).slice(0, 3)

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Scheduling & site visits</CardTitle>
            <CardDescription>Smart scheduling using vendor availability and Buildium work orders.</CardDescription>
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary">{schedule.length} work orders</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <CalendarDays className="h-4 w-4 text-primary" /> Upcoming visits
          </div>
          <div className="space-y-3">
            {upcoming.length > 0 ? (
              upcoming.map((item) => (
                <div key={item.workOrderId} className="rounded-lg border border-border/70 bg-muted/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.vendorName}</p>
                      <p className="text-xs text-muted-foreground">{item.subject}</p>
                    </div>
                    {item.priority ? <Badge variant="outline" className="uppercase">{item.priority}</Badge> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {formatDate(item.scheduledDate)}
                    </span>
                    {item.propertyName ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {item.propertyName}
                        {item.propertyAddress ? ` • ${item.propertyAddress}` : ''}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex h-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground">
                <CalendarDays className="h-5 w-5" />
                No confirmed visits yet. Use auto-scheduler to propose times.
              </div>
            )}
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Wrench className="h-4 w-4 text-primary" /> Work orders needing schedule
          </div>
          <div className="space-y-3">
            {unscheduled.length > 0 ? (
              unscheduled.map((item) => (
                <div key={item.workOrderId} className="rounded-lg border border-border/70 bg-background p-3">
                  <p className="text-sm font-semibold text-foreground">{item.vendorName}</p>
                  <p className="text-xs text-muted-foreground">{item.subject}</p>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {item.propertyName || 'Property assignment pending'}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Badge variant="secondary">Auto-schedule</Badge>
                    <Badge variant="outline">Share availability</Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex h-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground">
                <CheckIcon />
                All open work orders have scheduled visits.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CheckIcon() {
  return <svg viewBox="0 0 20 20" className="h-5 w-5 text-[var(--color-action-500)]" aria-hidden="true"><path fill="currentColor" d="M16.707 5.293a1 1 0 0 0-1.414 0L8 12.586 4.707 9.293a1 1 0 0 0-1.414 1.414l4 4a1 1 0 0 0 1.414 0l8-8a1 1 0 0 0 0-1.414Z" /></svg>
}

export default VendorSchedule
