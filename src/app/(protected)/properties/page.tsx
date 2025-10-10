"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Building, Search, Filter, Plus, MapPin, Users, DollarSign, Building2 } from 'lucide-react'
import AddPropertyModal from '@/components/AddPropertyModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface Property {
  id: string
  name: string
  addressLine1: string
  propertyType: string | null
  status: string
  createdAt: string
  updatedAt?: string
  totalActiveUnits?: number
  totalOccupiedUnits?: number
  totalVacantUnits?: number
  ownersCount?: number
  primaryOwnerName?: string
}

export default function PropertiesPage() {
  const [isAddPropertyModalOpen, setIsAddPropertyModalOpen] = useState(false)
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [typeFilter, setTypeFilter] = useState('All Types')

  useEffect(() => {
    fetchProperties()
  }, [])

  async function fetchProperties() {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/properties')
      if (!res.ok) throw new Error('Failed to fetch properties')
      const data = await res.json()
      setProperties(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load properties')
    } finally {
      setLoading(false)
    }
  }

  const filtered = properties.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.addressLine1.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'All Status' || p.status === statusFilter
    const matchesType =
      typeFilter === 'All Types' ||
      (typeFilter === 'None' ? !p.propertyType : p.propertyType === typeFilter)
    return matchesSearch && matchesStatus && matchesType
  })

  const handlePropertyCreated = () => {
    fetchProperties()
    setIsAddPropertyModalOpen(false)
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Properties</h1>
            <p className="text-muted-foreground">Manage your property portfolio and view detailed information.</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading properties...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Properties</h1>
            <p className="text-muted-foreground">Manage your property portfolio and view detailed information.</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="text-destructive mb-4">
              <Building className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Error Loading Properties</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchProperties}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Properties</h1>
          <p className="text-muted-foreground">Manage and monitor all your properties in one place.</p>
        </div>
        <Button onClick={() => setIsAddPropertyModalOpen(true)} className="flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          Add Property
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Properties ({filtered.length})
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search properties..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <label className="sr-only" htmlFor="properties-status-filter">
                Filter properties by status
              </label>
              <select
                id="properties-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
              >
                <option value="All Status">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <label className="sr-only" htmlFor="properties-type-filter">
                Filter properties by type
              </label>
              <select
                id="properties-type-filter"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
              >
                <option value="All Types">All Types</option>
                <option value="None">None</option>
                <option value="Condo">Condo</option>
                <option value="Co-op">Co-op</option>
                <option value="Condop">Condop</option>
                <option value="Mult-Family">Mult-Family</option>
                <option value="Townhouse">Townhouse</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="p-16 text-center">
              <Building className="mx-auto h-16 w-16 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium text-foreground">No properties found</h3>
              <p className="mt-2 text-muted-foreground">
                {searchTerm || statusFilter !== 'All Status' || typeFilter !== 'All Types'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Get started by creating your first property.'}
              </p>
              {properties.length === 0 && (
                <div className="mt-6">
                  <Button onClick={() => setIsAddPropertyModalOpen(true)} className="flex items-center">
                    <Building className="h-4 w-4 mr-2" /> Add Property
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Property</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Units</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Owners</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {filtered.map((property) => (
                      <tr key={property.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link href={`/properties/${property.id}`} className="hover:text-primary transition-colors">
                            <div className="flex items-start gap-3">
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Building2 className="h-5 w-5 text-primary" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-foreground">{property.name}</div>
                                <div className="flex items-center gap-1 mt-1">
                                  <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  <span className="text-sm text-muted-foreground truncate">{property.addressLine1}</span>
                                </div>
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <Badge variant="secondary" className="text-xs">
                            {property.propertyType ?? 'None'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-foreground">{property.totalActiveUnits ?? 0}</div>
                            <div className="text-xs text-muted-foreground">
                              <span className="text-success">{property.totalOccupiedUnits ?? 0}</span>/<span className="text-muted-foreground">{property.totalVacantUnits ?? 0}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="space-y-1">
                            <div className="flex items-center justify-center gap-1">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm font-medium text-foreground">{property.ownersCount ?? 0}</span>
                            </div>
                            {property.primaryOwnerName ? (
                              <div className="text-xs text-muted-foreground truncate max-w-[12rem] mx-auto" title={property.primaryOwnerName}>
                                {property.primaryOwnerName}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <Badge 
                            variant={property.status === 'Active' ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {property.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Showing {filtered.length} of {properties.length} properties</p>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <span>
                      Total Units: <span className="font-medium text-foreground">{filtered.reduce((sum, p) => sum + (p.totalActiveUnits ?? 0), 0)}</span>
                    </span>
                    <span>
                      Occupied: <span className="font-medium text-success">{filtered.reduce((sum, p) => sum + (p.totalOccupiedUnits ?? 0), 0)}</span>
                    </span>
                    <span>
                      Available: <span className="font-medium text-foreground">{filtered.reduce((sum, p) => sum + (p.totalVacantUnits ?? 0), 0)}</span>
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AddPropertyModal
        isOpen={isAddPropertyModalOpen}
        onClose={() => setIsAddPropertyModalOpen(false)}
        onSuccess={handlePropertyCreated}
      />
    </div>
  )
}
