'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building, Plus, Search, Filter, Bed, Bath, Ruler, DollarSign, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Body, Heading, Label } from '@/ui/typography'
import { Unit } from '@/types/units'
import AddUnitModal from '../AddUnitModal'

interface PropertyUnitsProps {
  propertyId: string
  onUnitsChange?: () => void
}

export function PropertyUnits({ propertyId, onUnitsChange }: PropertyUnitsProps) {
  const [units, setUnits] = useState<Unit[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAddUnitModal, setShowAddUnitModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchUnits = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/units?propertyId=${propertyId}`)
      if (response.ok) {
        const data = await response.json()
        setUnits(data)
      } else {
        console.error('Failed to fetch units')
        setUnits([])
      }
    } catch (error) {
      console.error('Error fetching units:', error)
      setUnits([])
    } finally {
      setIsLoading(false)
    }
  }, [propertyId])

  useEffect(() => {
    fetchUnits()
  }, [fetchUnits, propertyId])

  const filteredUnits = units.filter(unit =>
    unit.unitNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    unit.addressLine1?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    unit.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getUnitStatus = () => {
    // TODO: Implement real status logic based on lease data
    return 'Available'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Occupied':
        return 'status-pill status-pill-danger'
      case 'Available':
        return 'status-pill status-pill-success'
      case 'Maintenance':
        return 'status-pill status-pill-warning'
      default:
        return 'status-pill status-pill-info'
    }
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search units..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>
        <Button onClick={() => setShowAddUnitModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Unit
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <Body as="p" tone="muted" size="sm" className="mt-2">
            Loading units...
          </Body>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && units.length === 0 && (
        <div className="text-center py-12">
          <Building className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <Heading as="h3" size="h5" className="mb-2">
            No units added
          </Heading>
          <Body as="p" tone="muted" size="sm" className="mb-6">
            Add units to this property to start managing rentals and leases.
          </Body>
          <Button onClick={() => setShowAddUnitModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Unit
          </Button>
        </div>
      )}

      {/* Units Grid */}
      {!isLoading && units.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUnits.map((unit) => (
            <div key={unit.id} className="bg-card rounded-lg border border-border p-6 transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <Heading as="h3" size="h6">
                  Unit {unit.unitNumber}
                </Heading>
                <Label
                  as="span"
                  size="xs"
                  className={`px-2 py-1 rounded-full ${getStatusColor(getUnitStatus())}`}
                >
                  {getUnitStatus()}
                </Label>
              </div>
              
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Bed className="w-4 h-4 text-muted-foreground" />
                    <Body as="span" size="sm">
                      {unit.unitBedrooms || 'N/A'}
                    </Body>
                  </div>
                  <div className="flex items-center gap-1">
                    <Bath className="w-4 h-4 text-muted-foreground" />
                    <Body as="span" size="sm">
                      {unit.unitBathrooms || 'N/A'}
                    </Body>
                  </div>
                  <div className="flex items-center gap-1">
                    <Ruler className="w-4 h-4 text-muted-foreground" />
                    <Body as="span" size="sm">
                      {unit.unitSize ? `${unit.unitSize} sq ft` : 'N/A'}
                    </Body>
                  </div>
                </div>
                
                {unit.marketRent && (
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <Label as="span" size="sm">
                      ${unit.marketRent.toLocaleString()}/month
                    </Label>
                  </div>
                )}
                
                {unit.addressLine1 && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <Body as="span" tone="muted" size="sm" className="truncate">
                      {unit.addressLine1}
                    </Body>
                  </div>
                )}
                
                {unit.description && (
                  <Body as="p" tone="muted" size="sm">
                    {unit.description}
                  </Body>
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <Body as="span" tone="muted" size="sm">
                  Unit ID: {unit.id}
                </Body>
                <Button variant="outline" size="sm">
                  View Details
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Unit Modal */}
      <AddUnitModal
        isOpen={showAddUnitModal}
        onClose={() => setShowAddUnitModal(false)}
        onSuccess={() => {
          setShowAddUnitModal(false)
          fetchUnits()
          onUnitsChange?.()
        }}
        propertyId={propertyId}
      />
    </div>
  )
}
