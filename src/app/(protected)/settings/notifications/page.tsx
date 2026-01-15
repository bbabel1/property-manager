"use client"

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/components/providers'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Body, Heading, Label } from '@/ui/typography'

type ChannelState = { email: boolean; sms: boolean; app: boolean }
type NotificationRow = { key: string; label: string; description?: string }
type Group = { title: string; rows: NotificationRow[] }

const GROUPS: Group[] = [
  {
    title: 'Operations',
    rows: [
      { key: 'ops_new', label: 'New maintenance requests' },
      { key: 'ops_status', label: 'Status changes on my work orders' },
      { key: 'ops_vendor', label: 'Vendor updates' },
    ],
  },
  {
    title: 'Financial',
    rows: [
      { key: 'fin_rent', label: 'Rent received / failed' },
      { key: 'fin_owner_draw', label: 'Owner draw posted' },
      { key: 'fin_statements', label: 'Monthly statements ready' },
      { key: 'fin_expenses', label: 'Large unapproved expenses' },
    ],
  },
  {
    title: 'Board & Compliance',
    rows: [
      { key: 'board_meetings', label: 'Upcoming board meetings' },
      { key: 'board_compliance', label: 'Compliance tasks due' },
      { key: 'board_violations', label: 'Violations / notices' },
    ],
  },
]

const buildInitialState = () => {
  const result: Record<string, ChannelState> = {}
  GROUPS.forEach((group) => {
    group.rows.forEach((row) => {
      result[row.key] = { email: true, sms: row.key.startsWith('ops'), app: true }
    })
  })
  return result
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const userMeta = (user?.user_metadata ?? {}) as Record<string, unknown>

  const [matrix, setMatrix] = useState<Record<string, ChannelState>>(() => {
    const fromMeta = userMeta['notification_matrix'] as Record<string, ChannelState> | undefined
    return fromMeta && Object.keys(fromMeta).length ? fromMeta : buildInitialState()
  })
  const [pauseWindow, setPauseWindow] = useState<string>(
    typeof userMeta['notification_pause'] === 'string' ? (userMeta['notification_pause'] as string) : 'off',
  )
  const [saving, setSaving] = useState(false)

  const changeChannel = (rowKey: string, channel: keyof ChannelState, next: boolean) => {
    setMatrix((prev) => ({ ...prev, [rowKey]: { ...(prev[rowKey] ?? { email: false, sms: false, app: false }), [channel]: next } }))
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          ...(user.user_metadata ?? {}),
          notification_matrix: matrix,
          notification_pause: pauseWindow,
        },
      })
      if (error) {
        toast.error('Failed to save notifications', { description: error.message })
        return
      }
      toast.success('Notification preferences saved')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error('Failed to save notifications', { description: message })
    } finally {
      setSaving(false)
    }
  }

  const enabledCount = useMemo(
    () =>
      Object.values(matrix).reduce(
        (acc, row) => acc + Number(row.email) + Number(row.sms) + Number(row.app),
        0,
      ),
    [matrix],
  )

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Heading as="h1" size="h2">
          Notifications
        </Heading>
        <Body as="p" tone="muted" size="sm">
          Tune what you hear about and through which channels. Critical alerts stay on even when you pause.
        </Body>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Global controls</CardTitle>
            <Body as="p" tone="muted" size="sm">
              Pause non-critical emails or change how Ora reaches you.
            </Body>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Label as="span" size="xs" tone="muted" className="tracking-wide uppercase">
              Pause non-critical email
            </Label>
            <Select value={pauseWindow} onValueChange={setPauseWindow}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Do not pause</SelectItem>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Body as="div" tone="muted" size="xs">
            {enabledCount} channel toggles are on across {GROUPS.reduce((acc, g) => acc + g.rows.length, 0)} events.
          </Body>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {GROUPS.map((group) => (
          <Card key={group.title}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{group.title}</CardTitle>
                <Badge variant="outline">Personal</Badge>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-border/60 p-0">
              {group.rows.map((row) => {
                const rowState = matrix[row.key]
                return (
                  <div key={row.key} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <Label as="div" size="sm">
                        {row.label}
                      </Label>
                      {row.description ? (
                        <Body as="div" size="xs" tone="muted">
                          {row.description}
                        </Body>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {(['email', 'sms', 'app'] as (keyof ChannelState)[]).map((channel) => (
                        <div key={channel} className="flex items-center gap-2">
                          <Label as="span" size="xs" tone="muted" className="capitalize">
                            {channel}
                          </Label>
                          <Switch
                            checked={Boolean(rowState?.[channel])}
                            onCheckedChange={(checked) => changeChannel(row.key, channel, checked)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save notification settings'}
        </Button>
      </div>
    </div>
  )
}
