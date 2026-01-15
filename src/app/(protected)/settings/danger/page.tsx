"use client"

import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Body, Heading } from '@/ui/typography'

export default function DangerPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Heading as="h1" size="h2">
          Danger Zone
        </Heading>
        <Body as="p" tone="muted" size="sm">
          Export data or remove your account. Workspace deletion should be locked behind org-admin permissions.
        </Body>
      </div>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Delete my account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Body as="p" tone="muted" size="sm">
            This removes your personal access. Your organization data stays intact for other admins.
          </Body>
          <Button
            variant="destructive"
            onClick={() => toast.error('Account deletion flow', { description: 'Require confirmation and re-auth.' })}
          >
            Delete my account
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Workspace cleanup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Body as="p" tone="muted" size="sm">
            Org admins can archive a workspace or transfer ownership. This should require a fresh admin login and confirmation.
          </Body>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => toast.info('Archive workspace')}>
              Archive workspace
            </Button>
            <Button variant="destructive" onClick={() => toast.error('Workspace deletion requires backend gating')}>
              Request deletion
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Body as="p" tone="muted" size="sm">
            Export your workspace data before deletion. We recommend running a fresh export for audit.
          </Body>
          <Button onClick={() => toast.info('Export started')}>
            Start export
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
