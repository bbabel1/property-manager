'use client'

import { useState, useEffect } from 'react'
import { Building, Plus, Search, Filter, Bed, Bath, Ruler, DollarSign, Calendar, MapPin, Users } from 'lucide-react'
import { Button } from '../ui/button'
import { Unit } from '@/types/units'
import AddUnitModal from '../AddUnitModal'

interface PropertyUnitsProps {
  propertyId: string
  property?: any
  onUnitsChange?: () => void
}

export function PropertyUnits({ propertyId, property, onUnitsChange }: PropertyUnitsProps) {
  const [units, setUnits] = useState<Unit[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAddUnitModal, setShowAddUnitModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchUnits = async () => {
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
  }

  useEffect(() => {
    fetchUnits()
  }, [propertyId])

  const filteredUnits = units.filter(unit =>
    unit.unitNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    unit.addressLine1?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    unit.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getUnitStatus = (unit: Unit) => {
    // TODO: Implement real status logic based on lease data
    return 'Available'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Occupied':
        return 'bg-red-100 text-red-800'
      case 'Available':
        return 'bg-green-100 text-green-800'
      case 'Maintenance':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
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
          <p className="mt-2 text-muted-foreground">Loading units...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && units.length === 0 && (
        <div className="text-center py-12">
          <Building className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No units added</h3>
          <p className="text-muted-foreground mb-6">Add units to this property to start managing rentals and leases.</p>
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
            <div key={unit.id} className="bg-card rounded-lg border border-border p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-semibold text-lg">Unit {unit.unitNumber}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(getUnitStatus(unit))}`}>
                  {getUnitStatus(unit)}
                </span>
              </div>
              
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Bed className="w-4 h-4 text-muted-foreground" />
                    <span>{unit.unitBedrooms || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Bath className="w-4 h-4 text-muted-foreground" />
                    <span>{unit.unitBathrooms || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Ruler className="w-4 h-4 text-muted-foreground" />
                    <span>{unit.unitSize ? `${unit.unitSize} sq ft` : 'N/A'}</span>
                  </div>
                </div>
                
                {unit.marketRent && (
                  <div className="flex items-center gap-1 text-sm">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">${unit.marketRent.toLocaleString()}/month</span>
                  </div>
                )}
                
                {unit.addressLine1 && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{unit.addressLine1}</span>
                  </div>
                )}
                
                {unit.description && (
                  <p className="text-sm text-muted-foreground">{unit.description}</p>
                )}
              </div>
              
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Unit ID: {unit.id}</span>
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
