"use client"

import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DangerPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Danger Zone</h1>
        <p className="text-sm text-muted-foreground">
          Export data or remove your account. Workspace deletion should be locked behind org-admin permissions.
        </p>
      </div>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Delete my account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This removes your personal access. Your organization data stays intact for other admins.
          </p>
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
          <p className="text-sm text-muted-foreground">
            Org admins can archive a workspace or transfer ownership. This should require a fresh admin login and confirmation.
          </p>
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
          <p className="text-sm text-muted-foreground">
            Export your workspace data before deletion. We recommend running a fresh export for audit.
          </p>
          <Button onClick={() => toast.info('Export started')}>
            Start export
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
