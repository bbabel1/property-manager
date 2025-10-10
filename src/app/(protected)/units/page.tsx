"use client"

import { Bed, Bath, Plus, Building } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'

type Unit = {
  id: string
  property_id: string
  unit_number: string
  unit_size: number | null
  market_rent: number | null
  address_line1: string | null
  city: string | null
  state: string | null
  unit_bedrooms: number | null
  unit_bathrooms: number | null
  status?: 'Occupied' | 'Vacant'
}

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchUnits = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('/api/units')
        if (!res.ok) throw new Error('Failed to fetch units')
        const data = await res.json()
        setUnits(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load units')
      } finally {
        setLoading(false)
      }
    }
    fetchUnits()
  }, [])

  const stats = useMemo(() => {
    const total = units.length
    const occupied = units.filter(u => u.status === 'Occupied').length
    const vacant = total - occupied
    const rate = total ? Math.round((occupied / total) * 100) : 0
    return { totalUnits: total, occupiedUnits: occupied, vacantUnits: vacant, occupancyRate: rate }
  }, [units])

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Units</h1>
        </div>
        <div className="bg-card rounded-lg border p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded" />
              <div className="h-4 bg-muted rounded w-5/6" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Units</h1>
        </div>
        <div className="text-center py-12">
          <Building className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Error Loading Units</h3>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => location.reload()}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Units</h1>
        <Button className="flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          Add Unit
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Units</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalUnits}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Occupied</p>
              <p className="text-2xl font-bold text-success">{stats.occupiedUnits}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Vacant</p>
              <p className="text-2xl font-bold text-warning">{stats.vacantUnits}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Occupancy Rate</p>
              <p className="text-2xl font-bold text-foreground">{stats.occupancyRate}%</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-card rounded-lg border">
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-foreground">Units</h2>
            <div className="flex items-center space-x-4">
              <label className="sr-only" htmlFor="units-search">
                Search units or properties
              </label>
              <input
                id="units-search"
                type="text"
                placeholder="Search units or properties..."
                className="px-3 py-2 border border-input rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              <label className="sr-only" htmlFor="units-property-filter">
                Filter units by property
              </label>
              <select
                id="units-property-filter"
                className="px-3 py-2 border border-input rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary bg-background text-foreground"
              >
                <option>All Properties</option>
              </select>
              <label className="sr-only" htmlFor="units-status-filter">
                Filter units by status
              </label>
              <select
                id="units-status-filter"
                className="px-3 py-2 border border-input rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary bg-background text-foreground"
              >
                <option>All Status</option>
                <option>Occupied</option>
                <option>Vacant</option>
              </select>
              <label className="sr-only" htmlFor="units-bedroom-filter">
                Filter units by bedroom count
              </label>
              <select
                id="units-bedroom-filter"
                className="px-3 py-2 border border-input rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary bg-background text-foreground"
              >
                <option>All Bedrooms</option>
                <option>1 Bedroom</option>
                <option>2 Bedrooms</option>
                <option>3 Bedrooms</option>
              </select>
            </div>
          </div>
        </div>
        
        {units.length === 0 ? (
          <div className="text-center py-12">
            <Building className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No units found</h3>
            <p className="text-muted-foreground mb-6">Add units to your properties to start managing rentals and leases.</p>
            <Button>
              Add Your First Unit
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Unit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Property
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Layout
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Market Rent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Tenant
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {units.map((unit) => (
                  <tr key={unit.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-foreground">
                        {unit.unit_number || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-foreground">
                        {unit.address_line1 || '-'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {[unit.city, unit.state].filter(Boolean).join(', ')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-foreground">
                        <Bed className="h-4 w-4 mr-1" />
                        {unit.unit_bedrooms ?? '-'} bed
                        <Bath className="h-4 w-4 ml-2 mr-1" />
                        {unit.unit_bathrooms ?? '-'} bath
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {unit.unit_size ?? '-'} sq ft
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {unit.market_rent != null ? `$${Number(unit.market_rent).toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        unit.status === 'Occupied' 
                          ? 'bg-success/10 text-success' 
                          : 'bg-warning/10 text-warning'
                      }`}>
                        {unit.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {'-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
