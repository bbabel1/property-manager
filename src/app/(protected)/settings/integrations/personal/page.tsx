"use client"

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Calendar } from 'lucide-react'

type PersonalIntegration = {
  key: 'gmail' | 'calendar'
  title: string
  description: string
  status: 'connected' | 'not_connected'
  email?: string
  loading?: boolean
}

export default function PersonalIntegrationsPage() {
  const searchParams = useSearchParams()
  const [items, setItems] = useState<PersonalIntegration[]>([
    {
      key: 'gmail',
      title: 'Gmail',
      description: 'Send/receive email and log threads with tenants, owners, and vendors.',
      status: 'not_connected',
      loading: true,
    },
    {
      key: 'calendar',
      title: 'Google Calendar',
      description: 'Sync your tasks, board meetings, and key dates to your calendar.',
      status: 'not_connected',
      loading: true,
    },
  ])

  useEffect(() => {
    const connected = searchParams?.get('connected')
    const error = searchParams?.get('error')
    const message = searchParams?.get('message')

    if (connected === 'gmail') {
      toast.success('Gmail connected', { description: 'Your Gmail account has been successfully connected.' })
      void loadGmailStatus()
    } else if (error === 'gmail') {
      toast.error('Gmail connection failed', { description: message || 'Failed to connect Gmail account.' })
    } else if (connected === 'calendar') {
      toast.success('Google Calendar connected', { description: 'Your Google Calendar has been successfully connected.' })
      void loadCalendarStatus()
    } else if (error === 'calendar') {
      toast.error('Google Calendar connection failed', { description: message || 'Failed to connect Google Calendar.' })
    }
  }, [searchParams])

  const loadGmailStatus = async () => {
    try {
      const response = await fetch('/api/gmail/status')
      if (response.ok) {
        const data = await response.json()
        setItems((prev) =>
          prev.map((item) =>
            item.key === 'gmail'
              ? {
                  ...item,
                  status: data.connected ? 'connected' : 'not_connected',
                  email: data.email || undefined,
                  loading: false,
                }
              : item,
          ),
        )
      } else {
        setItems((prev) => prev.map((item) => (item.key === 'gmail' ? { ...item, loading: false } : item)))
      }
    } catch {
      setItems((prev) => prev.map((item) => (item.key === 'gmail' ? { ...item, loading: false } : item)))
    }
  }

  const loadCalendarStatus = async () => {
    try {
      const response = await fetch('/api/calendar/status')
      if (response.ok) {
        const data = await response.json()
        setItems((prev) =>
          prev.map((item) =>
            item.key === 'calendar'
              ? {
                  ...item,
                  status: data.connected ? 'connected' : 'not_connected',
                  email: data.email || undefined,
                  loading: false,
                }
              : item,
          ),
        )
      } else {
        setItems((prev) => prev.map((item) => (item.key === 'calendar' ? { ...item, loading: false } : item)))
      }
    } catch {
      setItems((prev) => prev.map((item) => (item.key === 'calendar' ? { ...item, loading: false } : item)))
    }
  }

  useEffect(() => {
    void loadGmailStatus()
    void loadCalendarStatus()
  }, [])

  const handleConnectGmail = () => {
    window.location.href = '/api/auth/gmail/initiate'
  }

  const handleDisconnectGmail = async () => {
    try {
      const response = await fetch('/api/gmail/disconnect', { method: 'POST' })
      if (response.ok) {
        toast.success('Gmail disconnected', { description: 'Your Gmail account has been disconnected.' })
        void loadGmailStatus()
      } else {
        const data = await response.json()
        toast.error('Failed to disconnect', { description: data.error?.message || 'Unknown error' })
      }
    } catch {
      toast.error('Failed to disconnect', { description: 'An error occurred while disconnecting Gmail.' })
    }
  }

  const handleConnectCalendar = () => {
    window.location.href = '/api/auth/calendar/initiate'
  }

  const handleDisconnectCalendar = async () => {
    try {
      const response = await fetch('/api/calendar/disconnect', { method: 'POST' })
      if (response.ok) {
        toast.success('Google Calendar disconnected', { description: 'Your Google Calendar has been disconnected.' })
        void loadCalendarStatus()
      } else {
        const data = await response.json()
        toast.error('Failed to disconnect', { description: data.error?.message || 'Unknown error' })
      }
    } catch {
      toast.error('Failed to disconnect', { description: 'An error occurred while disconnecting Google Calendar.' })
    }
  }

  const handleToggle = (key: 'gmail' | 'calendar', status: 'connected' | 'not_connected') => {
    if (key === 'gmail') {
      if (status === 'connected') {
        void handleDisconnectGmail()
      } else {
        handleConnectGmail()
      }
      return
    }

    if (key === 'calendar') {
      if (status === 'connected') {
        void handleDisconnectCalendar()
      } else {
        handleConnectCalendar()
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Personal Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Gmail and Calendar connections that follow you. Workspace-level integrations stay under Workspace → Integrations.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((item) => (
          <Card key={item.key}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="flex items-center gap-2">
                {item.key === 'gmail' && <Mail className="h-5 w-5 text-muted-foreground" />}
                {item.key === 'calendar' && <Calendar className="h-5 w-5 text-muted-foreground" />}
                <div>
                  <CardTitle>{item.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                  {item.email ? (
                    <p className="text-xs text-muted-foreground mt-1">Connected as: {item.email}</p>
                  ) : null}
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  item.status === 'connected'
                    ? 'status-pill border-[var(--color-success-500)] bg-[var(--color-success-50)] text-[var(--color-success-700)]'
                    : 'status-pill'
                }
              >
                {item.status === 'connected' ? 'Connected' : 'Not connected'}
              </Badge>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {item.status === 'connected' ? 'Synced recently' : 'No syncs yet'}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={item.status === 'connected' ? 'default' : 'outline'}
                  onClick={() => handleToggle(item.key, item.status)}
                  disabled={item.loading}
                >
                  {item.status === 'connected' ? 'Manage' : 'Connect'}
                </Button>
                {item.status === 'connected' ? (
                  <Button size="sm" variant="ghost" onClick={() => handleToggle(item.key, item.status)} disabled={item.loading}>
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
