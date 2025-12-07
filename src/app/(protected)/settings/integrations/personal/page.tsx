"use client"

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/components/providers'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

type PersonalIntegration = {
  key: string
  title: string
  description: string
  connected: boolean
  lastSync?: string
}

export default function PersonalIntegrationsPage() {
  const { user } = useAuth()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>
  const personalIntegrations = (meta['personal_integrations'] as Record<string, boolean> | undefined) || {}

  const [items, setItems] = useState<PersonalIntegration[]>([
    {
      key: 'calendar',
      title: 'Calendar (Google / Outlook)',
      description: 'Sync your tasks, board meetings, and key dates to your calendar.',
      connected: Boolean(personalIntegrations.calendar),
      lastSync: personalIntegrations.calendar ? 'Just now' : undefined,
    },
    {
      key: 'email_logging',
      title: 'Email logging',
      description: 'Allow Ora to log relevant email threads with tenants, owners, and vendors.',
      connected: Boolean(personalIntegrations.email_logging),
      lastSync: personalIntegrations.email_logging ? 'Just now' : undefined,
    },
  ])
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const persistIntegrations = async (nextItems: PersonalIntegration[], actionKey: string) => {
    if (!user) return
    setSavingKey(actionKey)
    try {
      const payload = nextItems.reduce<Record<string, boolean>>((acc, item) => {
        acc[item.key] = item.connected
        return acc
      }, {})
      const { error } = await supabase.auth.updateUser({
        data: { ...(user.user_metadata ?? {}), personal_integrations: payload },
      })
      if (error) {
        toast.error('Failed to update integrations', { description: error.message })
        return
      }
      toast.success('Integration updated')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error('Failed to update integrations', { description: message })
    } finally {
      setSavingKey(null)
    }
  }

  const toggle = (key: string) => {
    setItems((prev) => {
      const nextItems = prev.map((item) =>
        item.key === key
          ? { ...item, connected: !item.connected, lastSync: !item.connected ? 'Just now' : undefined }
          : item,
      )
      void persistIntegrations(nextItems, key)
      return nextItems
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Personal Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Calendar and email add-ons that follow you, not the workspace. Org-wide integrations live in Workspace.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((item) => (
          <Card key={item.key}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>{item.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Badge variant={item.connected ? 'default' : 'outline'}>
                {item.connected ? 'Connected' : 'Not connected'}
              </Badge>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {item.connected ? item.lastSync || 'Last sync: moments ago' : 'No syncs yet'}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={item.connected ? 'default' : 'outline'}
                  onClick={() => toggle(item.key)}
                  disabled={savingKey === item.key}
                >
                  {item.connected ? 'Manage' : 'Connect'}
                </Button>
                {item.connected ? (
                  <Button size="sm" variant="ghost" onClick={() => toggle(item.key)} disabled={savingKey === item.key}>
                    Disconnect
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
