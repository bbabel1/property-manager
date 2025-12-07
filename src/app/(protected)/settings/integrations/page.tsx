"use client"

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Loader2, Calendar, Building2 } from 'lucide-react'
import { BuildiumCredentialsForm } from '@/components/integrations/buildium-credentials-form'

type Integration = {
  key: string
  name: string
  description: string
  status: 'connected' | 'not_connected'
  email?: string
  lastSync?: string
  loading?: boolean
  isEnabled?: boolean
  lastTestedAt?: string | null
  webhookSecretRotatedAt?: string | null
}

type BuildiumIntegrationStatus = {
  is_enabled: boolean
  has_credentials: boolean
  last_tested_at: string | null
  webhook_secret_rotated_at: string | null
  base_url: string | null
  masked_client_id: string | null
  masked_client_secret: string | null
  masked_webhook_secret: string | null
}

export default function WorkspaceIntegrationsPage() {
  const searchParams = useSearchParams()
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      key: 'buildium',
      name: 'Buildium',
      description: 'Sync properties, owners, tenants, and financials bi-directionally.',
      status: 'not_connected',
      loading: true,
    },
    {
      key: 'gmail',
      name: 'Gmail',
      description: 'Send, receive, and manage emails from your Gmail account.',
      status: 'not_connected',
      loading: true,
    },
    {
      key: 'calendar',
      name: 'Google Calendar',
      description: 'View and manage calendar events from your Google Calendar.',
      status: 'not_connected',
      loading: true,
    },
  ])
  const [buildiumFormOpen, setBuildiumFormOpen] = useState(false)
  const [buildiumStatus, setBuildiumStatus] = useState<BuildiumIntegrationStatus | null>(null)

  // Check for OAuth callback results
  useEffect(() => {
    const connected = searchParams?.get('connected')
    const error = searchParams?.get('error')
    const message = searchParams?.get('message')

    if (connected === 'gmail') {
      toast.success('Gmail connected', { description: 'Your Gmail account has been successfully connected.' })
      loadGmailStatus()
    } else if (error === 'gmail') {
      toast.error('Gmail connection failed', { description: message || 'Failed to connect Gmail account.' })
    } else if (connected === 'calendar') {
      toast.success('Google Calendar connected', { description: 'Your Google Calendar has been successfully connected.' })
      loadCalendarStatus()
    } else if (error === 'calendar') {
      toast.error('Google Calendar connection failed', { description: message || 'Failed to connect Google Calendar.' })
    }
  }, [searchParams])

  // Load Gmail integration status
  const loadGmailStatus = async () => {
    try {
      const response = await fetch('/api/gmail/status')
      if (response.ok) {
        const data = await response.json()
        setIntegrations((prev) =>
          prev.map((int) =>
            int.key === 'gmail'
              ? {
                  ...int,
                  status: data.connected ? 'connected' : 'not_connected',
                  email: data.email || undefined,
                  loading: false,
                }
              : int,
          ),
        )
      } else {
        setIntegrations((prev) =>
          prev.map((int) =>
            int.key === 'gmail' ? { ...int, loading: false } : int,
          ),
        )
      }
    } catch (error) {
      console.error('Failed to load Gmail status:', error)
      setIntegrations((prev) =>
        prev.map((int) =>
          int.key === 'gmail' ? { ...int, loading: false } : int,
        ),
      )
    }
  }

  // Load Google Calendar integration status
  const loadCalendarStatus = async () => {
    try {
      const response = await fetch('/api/calendar/status')
      if (response.ok) {
        const data = await response.json()
        setIntegrations((prev) =>
          prev.map((int) =>
            int.key === 'calendar'
              ? {
                  ...int,
                  status: data.connected ? 'connected' : 'not_connected',
                  email: data.email || undefined,
                  loading: false,
                }
              : int,
          ),
        )
      } else {
        setIntegrations((prev) =>
          prev.map((int) =>
            int.key === 'calendar' ? { ...int, loading: false } : int,
          ),
        )
      }
    } catch (error) {
      console.error('Failed to load Google Calendar status:', error)
      setIntegrations((prev) =>
        prev.map((int) =>
          int.key === 'calendar' ? { ...int, loading: false } : int,
        ),
      )
    }
  }

  // Load Buildium integration status
  const loadBuildiumStatus = async () => {
    try {
      const response = await fetch('/api/buildium/integration')
      if (response.ok) {
        const data: BuildiumIntegrationStatus = await response.json()
        setBuildiumStatus(data)
        setIntegrations((prev) =>
          prev.map((int) =>
            int.key === 'buildium'
              ? {
                  ...int,
                  status: data.has_credentials && data.is_enabled ? 'connected' : 'not_connected',
                  isEnabled: data.is_enabled,
                  lastTestedAt: data.last_tested_at,
                  webhookSecretRotatedAt: data.webhook_secret_rotated_at,
                  loading: false,
                }
              : int,
          ),
        )
      } else {
        setIntegrations((prev) =>
          prev.map((int) =>
            int.key === 'buildium' ? { ...int, loading: false } : int,
          ),
        )
      }
    } catch (error) {
      console.error('Failed to load Buildium status:', error)
      setIntegrations((prev) =>
        prev.map((int) =>
          int.key === 'buildium' ? { ...int, loading: false } : int,
        ),
      )
    }
  }

  useEffect(() => {
    loadGmailStatus()
    loadCalendarStatus()
    loadBuildiumStatus()
  }, [])

  const handleConnectGmail = () => {
    window.location.href = '/api/auth/gmail/initiate'
  }

  const handleDisconnectGmail = async () => {
    try {
      const response = await fetch('/api/gmail/disconnect', { method: 'POST' })
      if (response.ok) {
        toast.success('Gmail disconnected', { description: 'Your Gmail account has been disconnected.' })
        loadGmailStatus()
      } else {
        const data = await response.json()
        toast.error('Failed to disconnect', { description: data.error?.message || 'Unknown error' })
      }
    } catch (error) {
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
        loadCalendarStatus()
      } else {
        const data = await response.json()
        toast.error('Failed to disconnect', { description: data.error?.message || 'Unknown error' })
      }
    } catch (error) {
      toast.error('Failed to disconnect', { description: 'An error occurred while disconnecting Google Calendar.' })
    }
  }

  const handleToggleBuildium = async (enabled: boolean) => {
    try {
      const response = await fetch('/api/buildium/integration/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || 'Failed to toggle integration')
      }

      toast.success(enabled ? 'Buildium integration enabled' : 'Buildium integration disabled')
      loadBuildiumStatus()
    } catch (error) {
      toast.error('Failed to toggle integration', {
        description: error instanceof Error ? error.message : 'An error occurred',
      })
    }
  }

  const toggleIntegration = (key: string) => {
    if (key === 'buildium') {
      const integration = integrations.find((int) => int.key === 'buildium')
      if (integration?.status === 'connected') {
        setBuildiumFormOpen(true)
      } else {
        setBuildiumFormOpen(true)
      }
      return
    }

    if (key === 'gmail') {
      const integration = integrations.find((int) => int.key === 'gmail')
      if (integration?.status === 'connected') {
        handleDisconnectGmail()
      } else {
        handleConnectGmail()
      }
      return
    }

    if (key === 'calendar') {
      const integration = integrations.find((int) => int.key === 'calendar')
      if (integration?.status === 'connected') {
        handleDisconnectCalendar()
      } else {
        handleConnectCalendar()
      }
      return
    }

    setIntegrations((prev) =>
      prev.map((int) =>
        int.key === key
          ? {
              ...int,
              status: int.status === 'connected' ? 'not_connected' : 'connected',
              lastSync: int.status === 'connected' ? undefined : 'Just now',
            }
          : int,
      ),
    )
    toast.success('Integration updated', { description: `Toggled ${key} locally.` })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Workspace Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Org-wide connections like Buildium. Personal integrations live under Personal.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {integrations.map((integration) => (
          <Card key={integration.key}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {integration.key === 'buildium' && <Building2 className="h-5 w-5 text-muted-foreground" />}
                  {integration.key === 'gmail' && <Mail className="h-5 w-5 text-muted-foreground" />}
                  {integration.key === 'calendar' && <Calendar className="h-5 w-5 text-muted-foreground" />}
                  <CardTitle>{integration.name}</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{integration.description}</p>
                {integration.key === 'buildium' && integration.isEnabled !== undefined && (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-xs text-muted-foreground">
                      Status: {integration.isEnabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                )}
                {integration.key === 'gmail' && integration.email && (
                  <p className="text-xs text-muted-foreground mt-1">Connected as: {integration.email}</p>
                )}
                {integration.key === 'calendar' && integration.email && (
                  <p className="text-xs text-muted-foreground mt-1">Connected as: {integration.email}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge
                  variant="outline"
                  className={
                    integration.status === 'connected'
                      ? 'status-pill border-[var(--color-success-500)] bg-[var(--color-success-50)] text-[var(--color-success-700)]'
                      : 'status-pill'
                  }
                >
                  {integration.status === 'connected' ? 'Connected' : 'Not connected'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {integration.key === 'buildium'
                  ? integration.lastTestedAt
                    ? `Last tested: ${new Date(integration.lastTestedAt).toLocaleString()}`
                    : 'No connection test yet'
                  : integration.lastSync
                    ? `Last sync: ${integration.lastSync}`
                    : integration.key === 'gmail'
                      ? ''
                      : integration.key === 'calendar'
                        ? ''
                        : 'No syncs yet'}
              </div>
              <div className="flex gap-2">
                {integration.loading ? (
                  <Button size="sm" variant="outline" disabled>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading...
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant={integration.status === 'connected' ? 'default' : 'outline'}
                      onClick={() => toggleIntegration(integration.key)}
                    >
                      {integration.status === 'connected' ? 'Manage' : 'Connect'}
                    </Button>
                    {integration.status === 'connected' && integration.key !== 'buildium' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleIntegration(integration.key)}
                        className="text-destructive hover:text-destructive"
                      >
                        Disconnect
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Buildium Credentials Form Dialog */}
      <BuildiumCredentialsForm
        isOpen={buildiumFormOpen}
        onClose={() => setBuildiumFormOpen(false)}
        onSuccess={() => {
          loadBuildiumStatus()
          setBuildiumFormOpen(false)
        }}
        initialStatus={buildiumStatus}
      />
    </div>
  )
}
