"use client"

import type { ComponentType } from 'react'
import type { AutomationSignal, ComplianceAlert } from '@/lib/vendor-service'
import { AlertTriangle, BellRing, CheckCircle, ShieldCheck, ShieldOff } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Body, Heading, Label } from '@/ui/typography'

interface VendorAutomationProps {
  complianceAlerts: ComplianceAlert[]
  automationSignals: AutomationSignal[]
}

type Priority = AutomationSignal['priority']

const priorityBadge: Record<Priority, { label: string; className: string }> = {
  high: { label: 'High impact', className: 'bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-200' },
  medium: { label: 'Medium', className: 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200' },
  low: { label: 'Low', className: 'bg-slate-500/10 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200' },
}

const signalCopy: Record<AutomationSignal['signalType'], { icon: ComponentType<{ className?: string }>; label: string }> = {
  follow_up: { icon: BellRing, label: 'Follow-up' },
  schedule: { icon: CheckCircle, label: 'Scheduling' },
  quote: { icon: AlertTriangle, label: 'Quotes & billing' },
  compliance: { icon: ShieldCheck, label: 'Compliance' },
}

function formatDays(days?: number) {
  if (days == null) return 'Unknown'
  if (days < 0) return `${Math.abs(days)} days overdue`
  if (days === 0) return 'Expires today'
  return `${days} days remaining`
}

export function VendorAutomation({ complianceAlerts, automationSignals }: VendorAutomationProps) {
  return (
    <Card id="automation">
      <CardHeader className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>
              <Heading as="div" size="h4">
                Automation & alerts
              </Heading>
            </CardTitle>
            <CardDescription>
              <Body as="p" size="sm" tone="muted">
                Trigger-ready workflows for compliance, approvals, and vendor engagement.
              </Body>
            </CardDescription>
          </div>
          <Button size="sm" variant="outline">Configure workflows</Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Heading as="h3" size="h6">
              Compliance alerts
            </Heading>
            <Badge variant="secondary" className="bg-primary/10 text-primary">{complianceAlerts.length}</Badge>
          </div>
          <div className="space-y-3">
            {complianceAlerts.slice(0, 6).map((alert) => (
              <div key={alert.vendorId} className="rounded-lg border border-border/70 bg-muted/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <Label as="div" size="sm" className="flex items-center gap-2">
                      <ShieldOff className="h-4 w-4 text-red-500" />
                      {alert.vendorName}
                    </Label>
                    <Body as="p" size="xs" tone="muted">
                      {alert.notes}
                    </Body>
                    {alert.insuranceExpirationDate ? (
                      <Body as="p" size="xs" tone="muted">
                        Expiration: {new Date(alert.insuranceExpirationDate).toLocaleDateString()} • {formatDays(alert.daysUntilExpiration)}
                      </Body>
                    ) : null}
                  </div>
                  <Badge variant="outline" className="uppercase">
                    {alert.status}
                  </Badge>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button size="sm" variant="secondary">Launch COI workflow</Button>
                </div>
              </div>
            ))}
            {complianceAlerts.length === 0 ? (
              <div className="flex h-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60">
                <ShieldCheck className="h-5 w-5" />
                <Body as="p" size="sm" tone="muted">
                  All vendors have up-to-date COIs.
                </Body>
              </div>
            ) : null}
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Heading as="h3" size="h6">
              Automation signals
            </Heading>
            <Badge variant="secondary" className="bg-primary/10 text-primary">{automationSignals.length}</Badge>
          </div>
          <div className="space-y-3">
            {automationSignals.slice(0, 6).map((signal, index) => {
              const meta = signalCopy[signal.signalType]
              const priority = priorityBadge[signal.priority]
              return (
                <div key={`${signal.vendorId}-${index}`} className="rounded-lg border border-border/70 bg-background p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label as="div" size="sm" className="flex items-center gap-2">
                      <meta.icon className="h-4 w-4 text-primary" />
                      {signal.vendorName}
                    </Label>
                    <Badge className={priority.className}>{priority.label}</Badge>
                  </div>
                  <Body as="p" size="xs" tone="muted" className="mt-2">
                    {signal.description}
                  </Body>
                  <Label as="p" size="xs" className="mt-2">
                    Suggested action: {signal.suggestedAction}
                  </Label>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="secondary">Automate</Button>
                    <Button size="sm" variant="ghost">Log note</Button>
                  </div>
                </div>
              )
            })}
            {automationSignals.length === 0 ? (
              <div className="flex h-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60">
                <CheckCircle className="h-5 w-5 text-primary-500" />
                <Body as="p" size="sm" tone="muted">
                  No automation triggers at this time.
                </Body>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default VendorAutomation
