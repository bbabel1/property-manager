"use client"

import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Body, Heading, Label } from '@/ui/typography'

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Heading as="h1" size="h3">
          Billing &amp; Plans
        </Heading>
        <Body tone="muted" size="sm">
          Manage your subscription, invoices, and payment methods for this workspace.
        </Body>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex items-start justify-between">
            <div>
              <CardTitle>Current plan</CardTitle>
              <Body tone="muted" size="sm">
                Pro · Billed monthly
              </Body>
            </div>
            <Badge variant="secondary">Active</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <Body tone="muted" size="sm">
              Includes users, owner portal, and maintenance flows.
            </Body>
            <div className="flex gap-2">
              <Button size="sm" variant="default" onClick={() => toast.info('Upgrade')}>
                Upgrade
              </Button>
              <Button size="sm" variant="outline" onClick={() => toast.info('Open invoices')}>
                View invoices
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <Label as="span" size="sm">
                  Team seats
                </Label>
                <Label as="span" size="sm">
                  8 / 15
                </Label>
              </div>
              <Progress value={53} className="mt-1.5" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label as="span" size="sm">
                  Storage
                </Label>
                <Label as="span" size="sm">
                  32 GB / 100 GB
                </Label>
              </div>
              <Progress value={32} className="mt-1.5" />
            </div>
            <Button size="sm" variant="outline" onClick={() => toast.info('Manage add-ons')}>
              Manage add-ons
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment method</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Body tone="muted" size="sm">
            Visa ending in 4242 · Expires 10/27
          </Body>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => toast.info('Update card')}>
              Update card
            </Button>
            <Button size="sm" variant="ghost" onClick={() => toast.info('Add backup method')}>
              Add backup
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
