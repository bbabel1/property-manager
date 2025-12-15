'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ComplianceSummaryCards } from '@/components/compliance/ComplianceSummaryCards'
import { PortfolioComplianceTable } from '@/components/compliance/PortfolioComplianceTable'
import { PageShell, PageHeader, PageBody, Stack } from '@/components/layout/page-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, RefreshCw, Search } from 'lucide-react'
import type { CompliancePortfolioSummary } from '@/types/compliance'

export default function ComplianceDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<CompliancePortfolioSummary | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [jurisdictionFilter, setJurisdictionFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [boroughFilter, setBoroughFilter] = useState<string>('all')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (jurisdictionFilter !== 'all') {
        params.append('jurisdiction', jurisdictionFilter)
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      if (boroughFilter !== 'all') {
        params.append('borough', boroughFilter)
      }

      const response = await fetch(`/api/compliance/portfolio?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch compliance data')
      }

      const data = await response.json()
      setSummary(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Failed to fetch compliance portfolio data:', err)
    } finally {
      setLoading(false)
    }
  }, [boroughFilter, jurisdictionFilter, statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filteredProperties = summary?.properties.filter((property) => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      property.property_name.toLowerCase().includes(searchLower) ||
      property.address_line1.toLowerCase().includes(searchLower) ||
      (property.borough && property.borough.toLowerCase().includes(searchLower))
    )
  }) || []

  const handleSyncProperty = async (propertyId: string) => {
    try {
      const response = await fetch('/api/compliance/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId }),
      })

      if (response.ok) {
        // Refresh data
        await fetchData()
      }
    } catch (error) {
      console.error('Failed to sync property:', error)
    }
  }

  const handleCreateWorkOrder = (propertyId: string) => {
    router.push(`/maintenance?propertyId=${propertyId}&from=compliance`)
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Compliance" />
        <PageBody>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </PageBody>
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell>
        <PageHeader title="Compliance" />
        <PageBody>
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
            <p className="text-sm text-destructive">Error: {error}</p>
            <Button onClick={fetchData} variant="outline" size="sm" className="mt-2">
              Retry
            </Button>
          </div>
        </PageBody>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="Compliance"
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={fetchData} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/compliance/programs">Manage compliance rules</a>
            </Button>
          </div>
        }
      />
      <PageBody>
        <Stack gap="lg">
          {/* Summary Cards */}
          {summary && (
            <ComplianceSummaryCards
              openViolations={summary.open_violations}
              overdueItems={summary.overdue_items}
              itemsDueNext30Days={summary.items_due_next_30_days}
              averageRiskScore={summary.average_risk_score}
            />
          )}

          {/* Filters */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search properties..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select value={jurisdictionFilter} onValueChange={setJurisdictionFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Jurisdiction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Jurisdictions</SelectItem>
                  <SelectItem value="NYC_DOB">NYC DOB</SelectItem>
                  <SelectItem value="NYC_HPD">NYC HPD</SelectItem>
                  <SelectItem value="FDNY">FDNY</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="due_soon">Due Soon</SelectItem>
                  <SelectItem value="on_track">On Track</SelectItem>
                </SelectContent>
              </Select>

              <Select value={boroughFilter} onValueChange={setBoroughFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Borough" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Boroughs</SelectItem>
                  <SelectItem value="Manhattan">Manhattan</SelectItem>
                  <SelectItem value="Brooklyn">Brooklyn</SelectItem>
                  <SelectItem value="Queens">Queens</SelectItem>
                  <SelectItem value="Bronx">Bronx</SelectItem>
                  <SelectItem value="Staten Island">Staten Island</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Properties Table */}
          <PortfolioComplianceTable
            properties={filteredProperties}
            onSyncProperty={handleSyncProperty}
            onCreateWorkOrder={handleCreateWorkOrder}
          />
        </Stack>
      </PageBody>
    </PageShell>
  )
}
