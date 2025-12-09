"use client"

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Building2, Calendar, Home, MoreVertical, Receipt, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

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

export default function UnitDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [unit, setUnit] = useState<Unit | null>(null)
  const [propertyName, setPropertyName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'financials' | 'monthly-log' | 'inspections' | 'appliances'>('overview')

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
    if (status === 'occupied') return { label: 'Occupied', cls: 'status-pill border-blue-800 bg-blue-100 text-blue-800' }
    if (status === 'vacant') return { label: 'Vacant', cls: 'status-pill border-yellow-800 bg-yellow-100 text-yellow-800' }
    if (status === 'active' || unit?.is_active) return { label: 'Active', cls: 'status-pill border-[var(--color-success-500)] bg-[var(--color-success-50)] text-[var(--color-success-700)]' }
    if (unit?.is_active === false) return { label: 'Inactive', cls: 'status-pill border-gray-400 bg-gray-100 text-gray-700' }
    return { label: unit?.status || 'Unknown', cls: 'status-pill border-gray-800 bg-gray-100 text-gray-800' }
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
          <CardContent className="p-6 text-center text-muted-foreground">{error || 'Unit not found'}</CardContent>
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
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Unit {unit.unit_number}
          </h1>
          <p className="text-muted-foreground">{propertyName || [unit.address_line1, unit.city, unit.state].filter(Boolean).join(' • ')}</p>
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
      <Tabs value={activeTab} onValueChange={(v)=>setActiveTab(v as any)}>
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
                <div><p className="text-sm text-muted-foreground">Unit Number</p><p className="font-medium">{unit.unit_number || '-'}</p></div>
                <div><p className="text-sm text-muted-foreground">Status</p><Badge className={statusBadge.cls}>{statusBadge.label}</Badge></div>
                <div><p className="text-sm text-muted-foreground">Bedrooms</p><p className="font-medium">{unit.unit_bedrooms ?? '-'}</p></div>
                <div><p className="text-sm text-muted-foreground">Bathrooms</p><p className="font-medium">{unit.unit_bathrooms ?? '-'}</p></div>
                <div><p className="text-sm text-muted-foreground">Square Feet</p><p className="font-medium">{unit.unit_size ?? '-'}</p></div>
                <div><p className="text-sm text-muted-foreground">Market Rent</p><p className="font-medium">{currency(unit.market_rent)}</p></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle>Management Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-muted-foreground">Service Plan</p><p className="font-medium">Premium</p></div>
                <div><p className="text-sm text-muted-foreground">Fee Structure</p><p className="font-medium">8% of rent</p></div>
                <div><p className="text-sm text-muted-foreground">Monthly Fee</p><p className="font-medium">$240</p></div>
                <div><p className="text-sm text-muted-foreground">Management Notes</p><p className="font-medium">Enter notes here.</p></div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Active Services</p>
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Tenant</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Start Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">End Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Monthly Rent</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {leases.map((l) => (
                      <tr key={l.id} className="hover:bg-muted/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-foreground">{l.tenant.name}</div>
                          <div className="text-sm text-muted-foreground">{l.tenant.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{new Date(l.start).toLocaleDateString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{new Date(l.end).toLocaleDateString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{currency(l.monthly)}</td>
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
                <span className="text-success">$</span>
                <div>
                  <div className="text-sm font-medium text-foreground">Rent payment received</div>
                  <div className="text-xs text-muted-foreground">Jan 31, 2024 at 10:30 AM</div>
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
                      <div className="text-sm text-muted-foreground">Balance</div>
                      <div className="text-2xl font-bold text-foreground">{currency(balance)}</div>
                    </div>
                    <div className="bg-card border rounded-lg p-4">
                      <div className="text-sm text-muted-foreground">YTD Income</div>
                      <div className="text-2xl font-bold text-success">{currency(totals.income)}</div>
                    </div>
                    <div className="bg-card border rounded-lg p-4">
                      <div className="text-sm text-muted-foreground">YTD Expenses</div>
                      <div className="text-2xl font-bold text-destructive">{currency(totals.expense)}</div>
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{new Date(t.date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{t.desc}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{t.type}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${t.amount >= 0 ? 'text-success' : 'text-destructive'}`}>{currency(t.amount)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{t.status}</td>
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
              <p className="text-sm text-muted-foreground">
                View or create monthly logs for this unit to track rent and expenses.
              </p>
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
              <p className="text-sm text-muted-foreground">
                Schedule or log inspections for this unit. Inspection scheduling will sync once the
                calendar write API is available.
              </p>
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
              <p className="text-sm text-muted-foreground">
                Track appliances for this unit once the inventory module is connected.
              </p>
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
