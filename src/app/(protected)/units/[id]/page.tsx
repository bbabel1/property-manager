"use client"

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Building2, Calendar, Home, MoreVertical, Receipt, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Body, Heading, Label } from '@/ui/typography'

type Unit = {
  id: string
  property_id: string
  unit_number: string
  unit_size?: number | null
  market_rent?: number | null
  address_line1?: string | null
  city?: string | null
  state?: string | null
  unit_bedrooms?: string | number | null
  unit_bathrooms?: string | number | null
  description?: string | null
  status?: string | null
  is_active?: boolean | null
}

type UnitTab = 'overview' | 'financials' | 'monthly-log' | 'inspections' | 'appliances'

export default function UnitDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [unit, setUnit] = useState<Unit | null>(null)
  const [propertyName, setPropertyName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<UnitTab>('overview')

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/units/${id}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load unit')
        const data: Unit = await res.json()
        setUnit(data)
        if (data?.property_id) {
          const pres = await fetch(`/api/properties/${data.property_id}/details`, { cache: 'no-store' })
          const pjson = pres.ok ? await pres.json() : null
          if (pjson?.name) setPropertyName(pjson.name)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load unit')
      } finally {
        setLoading(false)
      }
    }
    if (id) load()
  }, [id])

  const statusBadge = useMemo(() => {
    const status = (unit?.status || '').toLowerCase()
    if (status === 'occupied') return { label: 'Occupied', cls: 'status-pill status-pill-success' }
    if (status === 'vacant') return { label: 'Vacant', cls: 'status-pill status-pill-warning' }
    if (status === 'active' || unit?.is_active) return { label: 'Active', cls: 'status-pill status-pill-success' }
    if (unit?.is_active === false) return { label: 'Inactive', cls: 'status-pill status-pill-danger' }
    return { label: unit?.status || 'Unknown', cls: 'status-pill status-pill-info' }
  }, [unit])

  const currency = (n?: number | null) => n != null ? `$${Number(n).toLocaleString()}` : '-'

  // Mock lease data until leases API is ready
  const leases = useMemo(() => (
    [
      { id: 'l1', tenant: { name: 'John Smith', email: 'john.smith@email.com' }, start: '2023-12-31', end: '2024-12-30', monthly: 1200, status: 'Active' },
      { id: 'l2', tenant: { name: 'Sarah Johnson', email: 'sarah.johnson@email.com' }, start: '2022-12-31', end: '2023-12-30', monthly: 1150, status: 'Expired' },
      { id: 'l3', tenant: { name: 'Michael Davis', email: 'michael.davis@email.com' }, start: '2021-12-31', end: '2022-12-30', monthly: 1100, status: 'Expired' },
    ]
  ), [])

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="flex items-center gap-2" disabled>
            <ArrowLeft className="h-4 w-4" />
            Back to Property
          </Button>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    )
  }

  if (error || !unit) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Link href={`/properties`}>
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Property
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <Body size="sm" tone="muted">
              {error || 'Unit not found'}
            </Body>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Link href={`/properties/${unit.property_id}`}>
          <Button variant="ghost" size="sm" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Property
          </Button>
        </Link>
        <div className="flex-1">
          <Heading as="h1" size="h3" className="flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Unit {unit.unit_number}
          </Heading>
          <Body tone="muted">
            {propertyName || [unit.address_line1, unit.city, unit.state].filter(Boolean).join(' • ')}
          </Body>
        </div>
        <Badge className={statusBadge.cls}>{statusBadge.label}</Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <MoreVertical className="h-4 w-4" />
              Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>
              <Receipt className="h-4 w-4 mr-2" /> Generate Monthly Log
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Calendar className="h-4 w-4 mr-2" /> Schedule Inspection
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Home className="h-4 w-4 mr-2" /> Add Appliance
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v)=>setActiveTab(v as UnitTab)}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="overview" className="flex items-center gap-2"><Building2 className="h-4 w-4"/>Overview</TabsTrigger>
          <TabsTrigger value="financials" className="flex items-center gap-2"><DollarSign className="h-4 w-4"/>Financials</TabsTrigger>
          <TabsTrigger value="monthly-log" className="flex items-center gap-2"><Receipt className="h-4 w-4"/>Monthly Log</TabsTrigger>
          <TabsTrigger value="inspections" className="flex items-center gap-2"><Calendar className="h-4 w-4"/>Inspections</TabsTrigger>
          <TabsTrigger value="appliances" className="flex items-center gap-2"><Home className="h-4 w-4"/>Appliances</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Unit Information + Management Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3"><CardTitle>Unit Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <Label size="xs" tone="muted">Unit Number</Label>
                  <Label as="p" size="sm">{unit.unit_number || '-'}</Label>
                </div>
                <div>
                  <Label size="xs" tone="muted">Status</Label>
                  <Badge className={statusBadge.cls}>{statusBadge.label}</Badge>
                </div>
                <div>
                  <Label size="xs" tone="muted">Bedrooms</Label>
                  <Label as="p" size="sm">{unit.unit_bedrooms ?? '-'}</Label>
                </div>
                <div>
                  <Label size="xs" tone="muted">Bathrooms</Label>
                  <Label as="p" size="sm">{unit.unit_bathrooms ?? '-'}</Label>
                </div>
                <div>
                  <Label size="xs" tone="muted">Square Feet</Label>
                  <Label as="p" size="sm">{unit.unit_size ?? '-'}</Label>
                </div>
                <div>
                  <Label size="xs" tone="muted">Market Rent</Label>
                  <Label as="p" size="sm">{currency(unit.market_rent)}</Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle>Management Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <Label size="xs" tone="muted">Service Plan</Label>
                  <Label as="p" size="sm">Premium</Label>
                </div>
                <div>
                  <Label size="xs" tone="muted">Fee Structure</Label>
                  <Label as="p" size="sm">8% of rent</Label>
                </div>
                <div>
                  <Label size="xs" tone="muted">Monthly Fee</Label>
                  <Label as="p" size="sm">$240</Label>
                </div>
                <div>
                  <Label size="xs" tone="muted">Management Notes</Label>
                  <Label as="p" size="sm">Enter notes here.</Label>
                </div>
                <div className="col-span-2">
                  <Label size="xs" tone="muted">Active Services</Label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {['Property Management','Maintenance Coordination','Tenant Screening'].map(x=> (
                      <Badge key={x} className="bg-primary/10 text-primary">{x}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lease History */}
          <Card>
            <CardHeader className="pb-3"><CardTitle>Lease History</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted">
                      <tr>
                        <Label as="th" size="xs" tone="muted" className="px-6 py-3 text-left uppercase tracking-wider">
                          Tenant
                        </Label>
                        <Label as="th" size="xs" tone="muted" className="px-6 py-3 text-left uppercase tracking-wider">
                          Start Date
                        </Label>
                        <Label as="th" size="xs" tone="muted" className="px-6 py-3 text-left uppercase tracking-wider">
                          End Date
                        </Label>
                        <Label as="th" size="xs" tone="muted" className="px-6 py-3 text-left uppercase tracking-wider">
                          Monthly Rent
                        </Label>
                        <Label as="th" size="xs" tone="muted" className="px-6 py-3 text-left uppercase tracking-wider">
                          Status
                        </Label>
                        <Label as="th" size="xs" tone="muted" className="px-6 py-3 text-right uppercase tracking-wider">
                          Actions
                        </Label>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {leases.map((l) => (
                        <tr key={l.id} className="hover:bg-muted/50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Label as="div" size="sm">
                              {l.tenant.name}
                            </Label>
                            <Body as="div" size="sm" tone="muted">
                              {l.tenant.email}
                            </Body>
                          </td>
                          <Body as="td" size="sm" className="px-6 py-4 whitespace-nowrap">
                            {new Date(l.start).toLocaleDateString()}
                          </Body>
                          <Body as="td" size="sm" className="px-6 py-4 whitespace-nowrap">
                            {new Date(l.end).toLocaleDateString()}
                          </Body>
                          <Body as="td" size="sm" className="px-6 py-4 whitespace-nowrap">
                            {currency(l.monthly)}
                          </Body>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${l.status === 'Active' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                              {l.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <Button variant="ghost" size="sm">View</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3"><CardTitle>Recent Activity</CardTitle></CardHeader>
            <CardContent>
              <div className="p-4 border rounded-lg flex items-start gap-3">
                <Body as="span" size="sm" className="text-success">
                  $
                </Body>
                <div>
                  <Label as="div" size="sm">
                    Rent payment received
                  </Label>
                  <Body as="div" size="xs" tone="muted">
                    Jan 31, 2024 at 10:30 AM
                  </Body>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Placeholder tabs */}
        <TabsContent value="financials" className="space-y-6">
          {/* Summary */}
          <Card>
            <CardHeader className="pb-3"><CardTitle>Financial Summary</CardTitle></CardHeader>
            <CardContent>
              {(() => {
                const tx = [
                  { id: 't1', date: '2024-01-01', desc: 'January Rent', amount: 1200, type: 'Income', status: 'Posted' },
                  { id: 't2', date: '2024-01-10', desc: 'Plumbing Repair', amount: -150, type: 'Expense', status: 'Posted' },
                  { id: 't3', date: '2024-02-01', desc: 'February Rent', amount: 1200, type: 'Income', status: 'Posted' },
                  { id: 't4', date: '2024-02-14', desc: 'Light Fixture Replacement', amount: -85, type: 'Expense', status: 'Posted' },
                ]
                const totals = tx.reduce((acc, t) => {
                  if (t.amount >= 0) acc.income += t.amount; else acc.expense += Math.abs(t.amount)
                  return acc
                }, { income: 0, expense: 0 })
                const balance = totals.income - totals.expense
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-card border rounded-lg p-4">
                      <Label size="sm" tone="muted">Balance</Label>
                      <Heading as="div" size="h3">{currency(balance)}</Heading>
                    </div>
                    <div className="bg-card border rounded-lg p-4">
                      <Label size="sm" tone="muted">YTD Income</Label>
                      <Heading as="div" size="h3" className="text-success">{currency(totals.income)}</Heading>
                    </div>
                    <div className="bg-card border rounded-lg p-4">
                      <Label size="sm" tone="muted">YTD Expenses</Label>
                      <Heading as="div" size="h3" className="text-destructive">{currency(totals.expense)}</Heading>
                    </div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>

          {/* Transactions Table */}
          <Card>
            <CardHeader className="pb-3"><CardTitle>Transactions</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <Label as="th" size="xs" tone="muted" className="px-6 py-3 text-left uppercase tracking-wider">
                        Date
                      </Label>
                      <Label as="th" size="xs" tone="muted" className="px-6 py-3 text-left uppercase tracking-wider">
                        Description
                      </Label>
                      <Label as="th" size="xs" tone="muted" className="px-6 py-3 text-left uppercase tracking-wider">
                        Type
                      </Label>
                      <Label as="th" size="xs" tone="muted" className="px-6 py-3 text-right uppercase tracking-wider">
                        Amount
                      </Label>
                      <Label as="th" size="xs" tone="muted" className="px-6 py-3 text-left uppercase tracking-wider">
                        Status
                      </Label>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {[
                      { id: 't1', date: '2024-01-01', desc: 'January Rent', amount: 1200, type: 'Income', status: 'Posted' },
                      { id: 't2', date: '2024-01-10', desc: 'Plumbing Repair', amount: -150, type: 'Expense', status: 'Posted' },
                      { id: 't3', date: '2024-02-01', desc: 'February Rent', amount: 1200, type: 'Income', status: 'Posted' },
                      { id: 't4', date: '2024-02-14', desc: 'Light Fixture Replacement', amount: -85, type: 'Expense', status: 'Posted' },
                    ].map((t) => (
                      <tr key={t.id} className="hover:bg-muted/50">
                        <Body as="td" size="sm" className="px-6 py-4 whitespace-nowrap">
                          {new Date(t.date).toLocaleDateString()}
                        </Body>
                        <Body as="td" size="sm" className="px-6 py-4 whitespace-nowrap">
                          {t.desc}
                        </Body>
                        <Body as="td" size="sm" className="px-6 py-4 whitespace-nowrap">
                          {t.type}
                        </Body>
                        <Body
                          as="td"
                          size="sm"
                          className={`px-6 py-4 whitespace-nowrap text-right ${t.amount >= 0 ? 'text-success' : 'text-destructive'}`}
                        >
                          {currency(t.amount)}
                        </Body>
                        <Body as="td" size="sm" className="px-6 py-4 whitespace-nowrap">
                          {t.status}
                        </Body>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly-log">
          <Card>
            <CardHeader>
              <CardTitle>Monthly logs</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <Body size="sm" tone="muted">
                View or create monthly logs for this unit to track rent and expenses.
              </Body>
              <div className="flex gap-2">
                <Link href={`/monthly-logs?unitId=${unit.id}`}>
                  <Button variant="outline" size="sm">Open monthly logs</Button>
                </Link>
                <Link href={`/monthly-logs/new?unitId=${unit.id}`}>
                  <Button size="sm">Create monthly log</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="inspections">
          <Card>
            <CardHeader>
              <CardTitle>Inspections</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <Body size="sm" tone="muted">
                Schedule or log inspections for this unit. Inspection scheduling will sync once the
                calendar write API is available.
              </Body>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/calendar?prefillUnit=${unit.id}`}>Go to calendar</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="appliances">
          <Card>
            <CardHeader>
              <CardTitle>Appliances</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <Body size="sm" tone="muted">
                Track appliances for this unit once the inventory module is connected.
              </Body>
              <Button size="sm" variant="outline" disabled>
                Inventory module pending
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
