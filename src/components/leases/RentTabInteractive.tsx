"use client"

import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MoreHorizontal } from 'lucide-react'
import ActionButton from '@/components/ui/ActionButton'
import DynamicOverlay from '@/components/ui/DynamicOverlay'
import RentScheduleForm, { RentScheduleFormDefaults, RentScheduleFormLeaseSummary } from '@/components/leases/RentScheduleForm'

type RentLogRowDisplay = {
  id: string
  statusLabel: string
  statusVariant: 'default' | 'secondary' | 'outline'
  startLabel: string
  endLabel: string
  cycleLabel: string
  amountLabel: string
}

type CurrentCard = {
  rangeLabel: string
  amountLabel: string
  cycleLabel?: string | null
  chargeLabel: string
}

type UpcomingCard = {
  rangeLabel: string
  amountLabel: string
  cycleLabel?: string | null
}

type RentTabInteractiveProps = {
  leaseId: number | string
  currentCard: CurrentCard | null
  upcomingCard: UpcomingCard | null
  rentLog: RentLogRowDisplay[]
  rentCycleOptions: string[]
  rentStatusOptions: string[]
  leaseSummary: RentScheduleFormLeaseSummary
  defaults?: RentScheduleFormDefaults
}

export default function RentTabInteractive({
  leaseId,
  currentCard,
  upcomingCard,
  rentLog,
  rentCycleOptions,
  rentStatusOptions,
  leaseSummary,
  defaults,
}: RentTabInteractiveProps) {
  const router = useRouter()
  const [isAdding, setIsAdding] = useState(false)
  const [overlayTop, setOverlayTop] = useState(0)
  const [overlayLeft, setOverlayLeft] = useState(0)

  const rentLogSummary = useMemo(() => {
    if (!rentLog.length) return 'No rent schedules yet'
    return `${rentLog.length} rent schedule${rentLog.length === 1 ? '' : 's'}`
  }, [rentLog])

  const leaseSummaryForForm = useMemo(() => leaseSummary, [leaseSummary])

  useLayoutEffect(() => {
    if (!isAdding) return
    const update = () => {
      const anchor = document.querySelector('[data-lease-back-link]')
      if (anchor instanceof HTMLElement) {
        const rect = anchor.getBoundingClientRect()
        setOverlayTop(rect.bottom)
        anchor.style.visibility = 'hidden'
      } else {
        setOverlayTop(0)
      }

      const sidebarContainer = document.querySelector('[data-slot="sidebar-container"]') as HTMLElement | null
      const sidebarGap = document.querySelector('[data-slot="sidebar-gap"]') as HTMLElement | null
      const sidebarRect = sidebarContainer?.getBoundingClientRect() || sidebarGap?.getBoundingClientRect()
      setOverlayLeft(sidebarRect ? sidebarRect.right : 0)
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, { passive: true })
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update)
      const anchor = document.querySelector('[data-lease-back-link]') as HTMLElement | null
      if (anchor) anchor.style.visibility = ''
    }
  }, [isAdding])

  useEffect(() => {
    if (!isAdding) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [isAdding])

  const formMarkup = (
    <RentScheduleForm
      leaseId={leaseId}
      rentCycleOptions={rentCycleOptions}
      rentStatusOptions={rentStatusOptions}
      leaseSummary={leaseSummaryForForm}
      defaults={defaults}
      onCancel={() => setIsAdding(false)}
      onSuccess={() => {
        setIsAdding(false)
        router.refresh()
      }}
    />
  )

  if (isAdding) {
    return (
      <DynamicOverlay overlayTop={overlayTop} overlayLeft={overlayLeft}>
        {formMarkup}
      </DynamicOverlay>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border border-border/70 shadow-sm">
          <CardContent className="flex h-full flex-col gap-4 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current rent</p>
                <p className="mt-1 text-xs text-muted-foreground">{currentCard?.rangeLabel ?? 'No current rent schedule recorded.'}</p>
              </div>
              {currentCard ? <Badge variant="default">Current</Badge> : null}
            </div>
            {currentCard ? (
              <div className="space-y-1">
                <p className="text-2xl font-semibold text-foreground">
                  {currentCard.amountLabel}{' '}
                  {currentCard.cycleLabel ? (
                    <span className="text-base font-normal text-muted-foreground">{currentCard.cycleLabel.toLowerCase()}</span>
                  ) : null}
                </p>
                <p className="text-sm text-muted-foreground">{currentCard.chargeLabel}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No current rent schedule recorded.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/70 shadow-sm">
          <CardContent className="flex h-full flex-col gap-4 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upcoming rent</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {upcomingCard?.rangeLabel ?? 'No upcoming rent changes are scheduled.'}
                </p>
              </div>
              {upcomingCard ? <Badge variant="secondary">Future</Badge> : null}
            </div>
            {upcomingCard ? (
              <div className="space-y-1">
                <p className="text-xl font-semibold text-foreground">{upcomingCard.amountLabel}</p>
                <p className="text-sm text-muted-foreground">{upcomingCard.cycleLabel ?? '—'}</p>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                <span className="text-center leading-relaxed">No upcoming rent changes are scheduled.</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-dashed border-border/70 bg-muted/10 shadow-none">
          <CardContent className="flex h-full flex-col items-start justify-between gap-4 p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add a rent change</p>
              <p className="mt-2 text-sm text-muted-foreground">Add a new future or past rent schedule to keep the rent roll accurate.</p>
            </div>
            <Button onClick={() => setIsAdding(true)}>Add</Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-foreground">Rent log</h3>
          <span className="text-xs text-muted-foreground">{rentLogSummary}</span>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <Table className="min-w-full divide-y divide-border">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-32">Status</TableHead>
                <TableHead>Start date</TableHead>
                <TableHead>End date</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-16 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border bg-card">
              {rentLog.length ? (
                rentLog.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Badge variant={row.statusVariant} className="uppercase tracking-wide">
                        {row.statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">{row.startLabel}</TableCell>
                    <TableCell className="text-sm text-foreground">{row.endLabel}</TableCell>
                    <TableCell className="text-sm text-foreground">{row.cycleLabel}</TableCell>
                    <TableCell className="text-right text-sm text-foreground">{row.amountLabel}</TableCell>
                    <TableCell className="text-right">
                      <ActionButton aria-label="Rent schedule actions" />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    No rent schedules recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
