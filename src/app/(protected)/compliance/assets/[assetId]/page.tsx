'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { PageShell, PageHeader, PageBody, Stack } from '@/components/layout/page-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ComplianceChecklistTable } from '@/components/compliance/ComplianceChecklistTable'
import { ViolationsList } from '@/components/compliance/ViolationsList'
import { Loader2, ExternalLink, Wrench, FileText } from 'lucide-react'
import type { ComplianceAssetWithRelations } from '@/types/compliance'

export default function AssetDetailPage() {
  const params = useParams()
  const assetId = params.assetId as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [asset, setAsset] = useState<ComplianceAssetWithRelations | null>(null)

  useEffect(() => {
    const fetchAsset = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get org_id from user context (simplified - would need auth hook)
        const response = await fetch(`/api/compliance/assets/${assetId}`)

        if (!response.ok) {
          throw new Error('Failed to fetch asset data')
        }

        const data = await response.json()
        setAsset(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        console.error('Failed to fetch asset data:', err)
      } finally {
        setLoading(false)
      }
    }

    if (assetId) {
      fetchAsset()
    }
  }, [assetId])

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Asset Details" />
        <PageBody>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </PageBody>
      </PageShell>
    )
  }

  if (error || !asset) {
    return (
      <PageShell>
        <PageHeader title="Asset Details" />
        <PageBody>
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
            <p className="text-sm text-destructive">Error: {error || 'Failed to load asset data'}</p>
          </div>
        </PageBody>
      </PageShell>
    )
  }

  const lastInspection = asset.events?.[0]
  const nextDueItem = asset.items?.find((item) => 
    item.status === 'not_started' || item.status === 'scheduled'
  )

  return (
    <PageShell>
      <PageHeader
        title={asset.name}
        actions={
          <div className="flex items-center gap-2">
            {asset.external_source_id && (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`https://a810-bisweb.nyc.gov/bisweb/`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View in DOB NOW
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm">
              <Wrench className="h-4 w-4 mr-2" />
              Schedule Work Order
            </Button>
          </div>
        }
      />
      <PageBody>
        <Stack gap="lg">
          {/* Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Property</p>
                  {asset.property ? (
                    <Link
                      href={`/properties/${asset.property.id}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {asset.property.name}
                    </Link>
                  ) : (
                    <p className="text-sm">—</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Asset Type</p>
                  <Badge variant="outline">{asset.asset_type}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Inspection</p>
                  <p className="text-sm">
                    {lastInspection?.inspection_date
                      ? new Date(lastInspection.inspection_date).toLocaleDateString()
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Next Due</p>
                  <p className="text-sm">
                    {nextDueItem
                      ? new Date(nextDueItem.due_date).toLocaleDateString()
                      : '—'}
                  </p>
                </div>
              </div>
              {asset.location_notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Location Notes</p>
                  <p className="text-sm">{asset.location_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="inspections" className="space-y-4">
            <TabsList>
              <TabsTrigger value="inspections">Inspections & Filings</TabsTrigger>
              <TabsTrigger value="items">Compliance Items</TabsTrigger>
              <TabsTrigger value="violations">Violations</TabsTrigger>
            </TabsList>

            <TabsContent value="inspections">
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="p-4 text-left text-sm font-medium">Date</th>
                      <th className="p-4 text-left text-sm font-medium">Type</th>
                      <th className="p-4 text-left text-sm font-medium">Status</th>
                      <th className="p-4 text-left text-sm font-medium">Inspector</th>
                      <th className="p-4 text-left text-sm font-medium">Tracking Number</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asset.events && asset.events.length > 0 ? (
                      asset.events.map((event) => (
                        <tr key={event.id} className="border-b">
                          <td className="p-4 text-sm">
                            {event.inspection_date
                              ? new Date(event.inspection_date).toLocaleDateString()
                              : '—'}
                          </td>
                          <td className="p-4 text-sm">{event.inspection_type || event.event_type}</td>
                          <td className="p-4 text-sm">{event.compliance_status || '—'}</td>
                          <td className="p-4 text-sm">{event.inspector_name || '—'}</td>
                          <td className="p-4 text-sm font-mono">
                            {event.external_tracking_number || '—'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          No inspections found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="items">
              <ComplianceChecklistTable items={asset.items || []} />
            </TabsContent>

            <TabsContent value="violations">
              <ViolationsList violations={asset.violations || []} />
            </TabsContent>
          </Tabs>
        </Stack>
      </PageBody>
    </PageShell>
  )
}

