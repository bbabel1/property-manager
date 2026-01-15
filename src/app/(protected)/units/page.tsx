"use client"

import { Bed, Bath, Plus, Building } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select } from '@/ui/select'
import { Body, Heading, Label } from '@/ui/typography'

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
          <Heading as="h1" size="h2">
            Units
          </Heading>
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
          <Heading as="h1" size="h2">
            Units
          </Heading>
        </div>
        <div className="text-center py-12">
          <Building className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <Heading as="h3" size="h4" className="mb-2">
            Error Loading Units
          </Heading>
          <Body tone="muted" className="mb-6">
            {error}
          </Body>
          <Button onClick={() => location.reload()}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Heading as="h1" size="h2">
          Units
        </Heading>
        <Button className="flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          Add Unit
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <Label tone="muted" className="block">
                Total Units
              </Label>
              <Heading as="p" size="h3">
                {stats.totalUnits}
              </Heading>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <Label tone="muted" className="block">
                Occupied
              </Label>
              <Heading as="p" size="h3" className="text-success">
                {stats.occupiedUnits}
              </Heading>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <Label tone="muted" className="block">
                Vacant
              </Label>
              <Heading as="p" size="h3" className="text-warning">
                {stats.vacantUnits}
              </Heading>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <Label tone="muted" className="block">
                Occupancy Rate
              </Label>
              <Heading as="p" size="h3">
                {stats.occupancyRate}%
              </Heading>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-card rounded-lg border">
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <Heading as="h2" size="h3">
              Units
            </Heading>
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
              <Select
                id="units-property-filter"
                className="px-3 py-2 text-sm"
              >
                <option>All Properties</option>
              </Select>
              <label className="sr-only" htmlFor="units-status-filter">
                Filter units by status
              </label>
              <Select
                id="units-status-filter"
                className="px-3 py-2 text-sm"
              >
                <option>All Status</option>
                <option>Occupied</option>
                <option>Vacant</option>
              </Select>
              <label className="sr-only" htmlFor="units-bedroom-filter">
                Filter units by bedroom count
              </label>
              <Select
                id="units-bedroom-filter"
                className="px-3 py-2 text-sm"
              >
                <option>All Bedrooms</option>
                <option>1 Bedroom</option>
                <option>2 Bedrooms</option>
                <option>3 Bedrooms</option>
              </Select>
            </div>
          </div>
        </div>
        
        {units.length === 0 ? (
          <div className="text-center py-12">
            <Building className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <Heading as="h3" size="h4" className="mb-2">
              No units found
            </Heading>
            <Body tone="muted" className="mb-6">
              Add units to your properties to start managing rentals and leases.
            </Body>
            <Button>
              Add Your First Unit
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <Label
                    as="th"
                    size="xs"
                    tone="muted"
                    className="px-6 py-3 text-left uppercase tracking-wider"
                  >
                    Unit
                  </Label>
                  <Label
                    as="th"
                    size="xs"
                    tone="muted"
                    className="px-6 py-3 text-left uppercase tracking-wider"
                  >
                    Property
                  </Label>
                  <Label
                    as="th"
                    size="xs"
                    tone="muted"
                    className="px-6 py-3 text-left uppercase tracking-wider"
                  >
                    Layout
                  </Label>
                  <Label
                    as="th"
                    size="xs"
                    tone="muted"
                    className="px-6 py-3 text-left uppercase tracking-wider"
                  >
                    Size
                  </Label>
                  <Label
                    as="th"
                    size="xs"
                    tone="muted"
                    className="px-6 py-3 text-left uppercase tracking-wider"
                  >
                    Market Rent
                  </Label>
                  <Label
                    as="th"
                    size="xs"
                    tone="muted"
                    className="px-6 py-3 text-left uppercase tracking-wider"
                  >
                    Status
                  </Label>
                  <Label
                    as="th"
                    size="xs"
                    tone="muted"
                    className="px-6 py-3 text-left uppercase tracking-wider"
                  >
                    Tenant
                  </Label>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {units.map((unit) => (
                  <tr key={unit.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Label as="div" size="sm">
                        {unit.unit_number || '-'}
                      </Label>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Label as="div" size="sm">
                        {unit.address_line1 || '-'}
                      </Label>
                      <Body as="div" size="sm" tone="muted">
                        {[unit.city, unit.state].filter(Boolean).join(', ')}
                      </Body>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Body as="div" size="sm" className="flex items-center">
                        <Bed className="h-4 w-4 mr-1" />
                        {unit.unit_bedrooms ?? '-'} bed
                        <Bath className="h-4 w-4 ml-2 mr-1" />
                        {unit.unit_bathrooms ?? '-'} bath
                      </Body>
                    </td>
                    <Body as="td" size="sm" className="px-6 py-4 whitespace-nowrap">
                      {unit.unit_size ?? '-'} sq ft
                    </Body>
                    <Body as="td" size="sm" className="px-6 py-4 whitespace-nowrap">
                      {unit.market_rent != null ? `$${Number(unit.market_rent).toLocaleString()}` : '-'}
                    </Body>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Label as="span" size="xs" className={`inline-flex items-center px-2.5 py-0.5 rounded-full ${
                        unit.status === 'Occupied' 
                          ? 'bg-success/10 text-success' 
                          : 'bg-warning/10 text-warning'
                      }`}>
                        {unit.status}
                      </Label>
                    </td>
                    <Body as="td" size="sm" className="px-6 py-4 whitespace-nowrap">
                      {'-'}
                    </Body>
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
