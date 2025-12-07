"use client"

import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function PrivacyPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Data &amp; Privacy</h1>
        <p className="text-sm text-muted-foreground">
          Control exports, audit visibility, and how long operational data is retained.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Data export</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Request a full export of your personal data (JSON + CSV) emailed to your login address.
          </div>
          <Button onClick={() => toast.info('Export requested', { description: 'Wire to export endpoint.' })}>
            Request export
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit visibility</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Show recent login and security events in your personal activity feed.
          </p>
          <Button variant="outline" size="sm" onClick={() => toast.info('Audit feed toggled')}>
            View my audit log
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data retention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pick how long personal logs (sessions, notifications) are retained before archival.
          </p>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="retention">Retention window</Label>
            <Select defaultValue="90" onValueChange={(value) => toast.info(`Set retention to ${value} days`)}>
              <SelectTrigger id="retention">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="180">180 days</SelectItem>
                <SelectItem value="365">365 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
