"use client"

import { useMemo, useState } from 'react'
import { Building2, Mail, Phone, ShieldAlert, ShieldCheck, ShieldQuestion, Sparkles } from 'lucide-react'
import type { VendorInsight } from '@/lib/vendor-service'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface VendorDirectoryProps {
  vendors: VendorInsight[]
}

type ComplianceFilter = 'all' | 'ok' | 'expiring' | 'expired' | 'missing'
type StatusFilter = 'all' | 'active' | 'inactive'

type SortKey = 'reliability' | 'spend' | 'recency'

const complianceCopy: Record<ComplianceFilter, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  all: { label: 'All compliance states', icon: ShieldCheck },
  ok: { label: 'Compliant', icon: ShieldCheck },
  expiring: { label: 'Expiring soon', icon: ShieldAlert },
  expired: { label: 'Expired', icon: ShieldAlert },
  missing: { label: 'Missing COI', icon: ShieldQuestion },
}

const statusCopy: Record<StatusFilter, string> = {
  all: 'All vendors',
  active: 'Active only',
  inactive: 'Inactive only',
}

const sortCopy: Record<SortKey, string> = {
  reliability: 'AI reliability',
  spend: 'Spend (YTD)',
  recency: 'Recent activity',
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value >= 1000 ? 0 : 2 }).format(value)

function complianceBadge(status: VendorInsight['complianceStatus']) {
  switch (status) {
    case 'ok':
      return <Badge className="bg-[var(--color-action-50)]0/10 text-[var(--color-action-600)] dark:bg-[var(--color-action-50)]0/15 dark:text-[var(--color-action-100)]">Compliant</Badge>
    case 'expiring':
      return <Badge className="bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">Expiring</Badge>
    case 'expired':
      return <Badge className="bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-200">Expired</Badge>
    case 'missing':
      return <Badge className="bg-slate-500/10 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200">Missing COI</Badge>
    default:
      return null
  }
}

export function VendorDirectory({ vendors }: VendorDirectoryProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [compliance, setCompliance] = useState<ComplianceFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('reliability')

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return vendors
      .filter((vendor) => {
        if (status === 'active' && !vendor.isActive) return false
        if (status === 'inactive' && vendor.isActive) return false
        if (compliance !== 'all' && vendor.complianceStatus !== compliance) return false

        if (!query) return true

        const haystack = [
          vendor.displayName,
          vendor.companyName,
          vendor.categoryName,
          vendor.contactEmail,
          vendor.contactPhone,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return haystack.includes(query)
      })
      .sort((a, b) => {
        switch (sortKey) {
          case 'spend':
            return b.spendYtd - a.spendYtd
          case 'recency': {
            const dateA = a.lastEngagement ? new Date(a.lastEngagement).getTime() : 0
            const dateB = b.lastEngagement ? new Date(b.lastEngagement).getTime() : 0
            return dateB - dateA
          }
          case 'reliability':
          default:
            return b.reliabilityScore - a.reliabilityScore
        }
      })
  }, [vendors, searchTerm, compliance, status, sortKey])

  return (
    <Card className="h-full">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-2">
          <CardTitle className="text-lg">Vendor Intelligence</CardTitle>
          <CardDescription>
            AI-ranked vendor directory combining Buildium data, compliance health, and recent performance.
          </CardDescription>
        </div>
        <div className="grid gap-3 md:grid-cols-4 md:items-end">
          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="vendor-search">Search vendors</Label>
            <Input
              id="vendor-search"
              placeholder="Search by name, category, email, or phone"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Compliance</Label>
            <Select value={compliance} onValueChange={(value) => setCompliance(value as ComplianceFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Compliance" />
              </SelectTrigger>
              <SelectContent align="start">
                {Object.entries(complianceCopy).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>
                    <div className="flex items-center gap-2">
                      <meta.icon className="h-3.5 w-3.5" />
                      <span>{meta.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent align="start">
                {Object.entries(statusCopy).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2 lg:col-span-1">
            <Label>Sort by</Label>
            <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent align="start">
                {Object.entries(sortCopy).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mb-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
          <div>
            Showing <span className="font-medium text-foreground">{filtered.length}</span> vendors
          </div>
          <div className="flex items-center gap-1">
            <Sparkles className="h-4 w-4 text-primary" />
            Sorted by {sortCopy[sortKey]}
          </div>
        </div>
        <ScrollArea className="h-[488px] pr-2">
          <div className="space-y-3">
            {filtered.map((vendor) => (
              <div
                key={vendor.id}
                className="rounded-xl border border-border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">
                        {vendor.displayName}
                      </h3>
                      {vendor.categoryName ? <Badge variant="outline">{vendor.categoryName}</Badge> : null}
                      {complianceBadge(vendor.complianceStatus)}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {vendor.contactEmail ? (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          {vendor.contactEmail}
                        </span>
                      ) : null}
                      {vendor.contactPhone ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />
                          {vendor.contactPhone}
                        </span>
                      ) : null}
                      {vendor.addressLine1 ? (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {[vendor.addressLine1, vendor.city, vendor.state]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      ) : null}
                    </div>
                    {vendor.automationSuggestions.length > 0 ? (
                      <div className="flex flex-wrap gap-2 text-xs">
                        {vendor.automationSuggestions.map((note) => (
                          <Badge key={note} variant="secondary" className="bg-primary/5 text-primary">
                            {note}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-start gap-3 md:items-end">
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-foreground">{formatCurrency(vendor.spendYtd)}</p>
                      <p className="text-xs text-muted-foreground">YTD spend • {formatCurrency(vendor.spendLast30)} in last 30 days</p>
                    </div>
                    <div className="w-[200px] space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Reliability</span>
                        <span className="font-medium text-foreground">{vendor.reliabilityScore}/100</span>
                      </div>
                      <Progress value={vendor.reliabilityScore} className="h-1.5" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Rating</span>
                        <span>{vendor.rating.toFixed(1)} / 5</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 text-xs text-muted-foreground">
                      <span>{vendor.openWorkOrders} open work orders</span>
                      <span>•</span>
                      <span>{vendor.openInvoices} invoices pending</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (!vendor.buildiumVendorId) return
                          const buildiumBase = process.env.NEXT_PUBLIC_BUILDIUM_APP_URL || 'https://app.buildium.com'
                          window.open(`${buildiumBase}/vendors/${vendor.buildiumVendorId}`, '_blank', 'noopener')
                        }}
                        disabled={!vendor.buildiumVendorId}
                      >
                        View in Buildium
                      </Button>
                      <Button size="sm" variant="secondary">
                        Draft outreach
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 ? (
              <div className="flex h-[360px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 text-center text-sm text-muted-foreground">
                <ShieldCheck className="h-5 w-5" />
                <div>No vendors match the selected filters.</div>
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

export default VendorDirectory
