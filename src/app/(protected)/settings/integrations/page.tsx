"use client"

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Loader2 } from 'lucide-react'

type Integration = {
  key: string
  name: string
  description: string
  status: 'connected' | 'not_connected'
  email?: string
  lastSync?: string
  loading?: boolean
}

export default function WorkspaceIntegrationsPage() {
  const searchParams = useSearchParams()
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      key: 'buildium',
      name: 'Buildium',
      description: 'Sync properties, owners, tenants, and financials bi-directionally.',
      status: 'not_connected',
    },
    {
      key: 'gmail',
      name: 'Gmail',
      description: 'Send Monthly Log Statements from your Gmail account.',
      status: 'not_connected',
      loading: true,
    },
  ])

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

  useEffect(() => {
    loadGmailStatus()
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

  const toggleIntegration = (key: string) => {
    if (key === 'gmail') {
      const integration = integrations.find((int) => int.key === 'gmail')
      if (integration?.status === 'connected') {
        handleDisconnectGmail()
      } else {
        handleConnectGmail()
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
                  {integration.key === 'gmail' && <Mail className="h-5 w-5 text-muted-foreground" />}
                  <CardTitle>{integration.name}</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{integration.description}</p>
                {integration.key === 'gmail' && integration.email && (
                  <p className="text-xs text-muted-foreground mt-1">Connected as: {integration.email}</p>
                )}
              </div>
              <Badge variant={integration.status === 'connected' ? 'default' : 'outline'}>
                {integration.status === 'connected' ? 'Connected' : 'Not connected'}
              </Badge>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {integration.lastSync ? `Last sync: ${integration.lastSync}` : integration.key === 'gmail' ? 'Ready to send statements' : 'No syncs yet'}
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
                    {integration.status === 'connected' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleIntegration(integration.key)}
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
    </div>
  )
}
