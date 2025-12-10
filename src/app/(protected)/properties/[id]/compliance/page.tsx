'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { PropertyComplianceHeader } from '@/components/compliance/PropertyComplianceHeader'
import { ComplianceTimeline } from '@/components/compliance/ComplianceTimeline'
import { ComplianceChecklistTable } from '@/components/compliance/ComplianceChecklistTable'
import { ViolationsList } from '@/components/compliance/ViolationsList'
import { PageBody, Stack } from '@/components/layout/page-shell'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, RefreshCw } from 'lucide-react'
import type {
  ComplianceItemWithRelations,
  ComplianceViolationWithRelations,
  ComplianceAsset,
} from '@/types/compliance'

interface PropertyComplianceData {
  property: {
    id: string
    name: string
    address_line1: string
    borough: string | null
    bin: string | null
  }
  items: ComplianceItemWithRelations[]
  violations: ComplianceViolationWithRelations[]
  assets: ComplianceAsset[]
  events: Array<{
    id: string
    inspection_date: string | null
    filed_date: string | null
    event_type: string
    inspection_type: string | null
    compliance_status: string | null
    created_at: string
  }>
  summary: {
    open_violations: number
    overdue_items: number
    items_due_next_30_days: number
  }
}

export default function PropertyCompliancePage() {
  const params = useParams()
  const propertyId = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PropertyComplianceData | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/compliance/properties/${propertyId}`)

      if (!response.ok) {
        throw new Error('Failed to fetch compliance data')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Failed to fetch property compliance data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (propertyId) {
      fetchData()
    }
  }, [propertyId])

  const handleViewItem = (itemId: string) => {
    // TODO: Open compliance item detail modal
    console.log('View item:', itemId)
  }

  const handleExportPDF = () => {
    // TODO: Implement PDF export
    console.log('Export PDF')
  }

  if (loading) {
    return (
      <PageBody>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageBody>
    )
  }

  if (error || !data) {
    return (
      <PageBody>
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">Error: {error || 'Failed to load compliance data'}</p>
          <Button onClick={fetchData} variant="outline" size="sm" className="mt-2">
            Retry
          </Button>
        </div>
      </PageBody>
    )
  }

  return (
    <PageBody>
      <Stack gap="lg">
        {/* Header */}
        <PropertyComplianceHeader
          propertyName={data.property.name}
          addressLine1={data.property.address_line1}
          borough={data.property.borough}
          bin={data.property.bin}
          openViolations={data.summary.open_violations}
          overdueItems={data.summary.overdue_items}
          itemsDueNext30Days={data.summary.items_due_next_30_days}
          onExportPDF={handleExportPDF}
        />

        {/* Timeline */}
        <ComplianceTimeline items={data.items} events={data.events} />

        {/* Tabs */}
        <Tabs defaultValue="checklist" className="space-y-4">
          <TabsList>
            <TabsTrigger value="checklist">Compliance Checklist</TabsTrigger>
            <TabsTrigger value="violations">Violations</TabsTrigger>
          </TabsList>

          <TabsContent value="checklist" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Compliance Items</h3>
              <Button onClick={fetchData} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
            <ComplianceChecklistTable items={data.items} onViewItem={handleViewItem} />
          </TabsContent>

          <TabsContent value="violations" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Violations</h3>
              <Button onClick={fetchData} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
            <ViolationsList violations={data.violations} />
          </TabsContent>
        </Tabs>
      </Stack>
    </PageBody>
  )
}

