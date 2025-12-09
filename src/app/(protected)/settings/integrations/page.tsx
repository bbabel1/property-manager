"use client"

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Building2 } from 'lucide-react'
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
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      key: 'buildium',
      name: 'Buildium',
      description: 'Sync properties, owners, tenants, and financials bi-directionally.',
      status: 'not_connected',
      loading: true,
    },
  ])
  const [buildiumFormOpen, setBuildiumFormOpen] = useState(false)
  const [buildiumStatus, setBuildiumStatus] = useState<BuildiumIntegrationStatus | null>(null)

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
    loadBuildiumStatus()
  }, [])

  const toggleIntegration = (key: string) => {
    if (key === 'buildium') {
      setBuildiumFormOpen(true)
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
        <p className="text-sm text-muted-foreground">Org-wide connections like Buildium. Personal integrations live under Personal.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {integrations.map((integration) => (
          <Card key={integration.key}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {integration.key === 'buildium' && <Building2 className="h-5 w-5 text-muted-foreground" />}
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
                {integration.lastTestedAt
                  ? `Last tested: ${new Date(integration.lastTestedAt).toLocaleString()}`
                  : 'No connection test yet'}
              </div>
              <div className="flex gap-2">
                {integration.loading ? (
                  <Button size="sm" variant="outline" disabled>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading...
                  </Button>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={() => toggleIntegration(integration.key)}>
                      Manage
                    </Button>
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
