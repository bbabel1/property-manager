'use client'

import { useState } from 'react'
import { Home } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Dropdown } from './ui/Dropdown';

import { type BedroomEnum, type BathroomEnum, BEDROOM_OPTIONS, BATHROOM_OPTIONS } from '@/types/units'
import { UnitCreateSchema, type UnitCreateInput } from '@/schemas/unit'


interface AddUnitFormData {
  unitNumber: string
  unitSize?: number
  marketRent?: number
  unitBedrooms: BedroomEnum | ''
  unitBathrooms: BathroomEnum | ''
  description?: string
}

interface AddUnitModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  propertyId: string
  property?: {
    address_line1: string
    address_line2?: string
    address_line3?: string
    city: string
    state: string
    postal_code: string
    country: string
  }
}





export default function AddUnitModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  propertyId,
  property
}: AddUnitModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [formData, setFormData] = useState<AddUnitFormData>({
    unitNumber: '',
    unitSize: undefined,
    marketRent: undefined,
    unitBedrooms: '',
    unitBathrooms: '',
    description: ''
  })



  const handleSubmit = async () => {
    try {
      setIsLoading(true)
      setError(null)
      setSuccess(null)

      // Basic validation
      if (!formData.unitNumber) {
        throw new Error('Unit number is required')
      }
      if (!formData.unitBedrooms) {
        throw new Error('Number of bedrooms is required')
      }
      if (!formData.unitBathrooms) {
        throw new Error('Number of bathrooms is required')
      }
      if (!property?.address_line1) {
        throw new Error('Property address information is required')
      }

      // Zod validation before submit
      const parsed = UnitCreateSchema.safeParse({
        propertyId,
        unitNumber: formData.unitNumber,
        unitSize: formData.unitSize,
        marketRent: formData.marketRent,
        addressLine1: property?.address_line1 || '',
        addressLine2: property?.address_line2 || '',
        addressLine3: property?.address_line3 || '',
        city: property?.city || '',
        state: property?.state || '',
        postalCode: property?.postal_code || '',
        country: property?.country || '',
        unitBedrooms: formData.unitBedrooms || undefined,
        unitBathrooms: formData.unitBathrooms || undefined,
        description: formData.description || undefined,
      } as UnitCreateInput)

      if (!parsed.success) {
        const msg = parsed.error.issues.map((e: { message: string }) => e.message).join('\n')
        throw new Error(msg || 'Please correct the form errors')
      }

      // Submit the form data to your API
      const response = await fetch('/api/units', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...parsed.data,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create unit')
      }

      await response.json()
      setSuccess('Unit created successfully!')
      
      // Reset form
      setFormData({
        unitNumber: '',
        unitSize: undefined,
        marketRent: undefined,
        unitBedrooms: '',
        unitBathrooms: '',
        description: ''
      })
      
      // Close modal after a short delay to show success message
      setTimeout(() => {
        onClose()
        setSuccess(null)
        // Call onSuccess callback to refresh the units list
        if (onSuccess) {
          onSuccess()
        }
      }, 1500)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create unit. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="bg-card sm:rounded-2xl rounded-none border border-border/80 shadow-2xl w-[92vw] sm:max-w-md md:max-w-lg max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="p-6 border-b border-border">
          <DialogTitle className="text-xl font-semibold text-foreground">Add New Unit</DialogTitle>
        </DialogHeader>

        {/* Error/Success Messages */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mx-6 mt-4 p-4 bg-success/10 border border-success/20 rounded-md">
            <p className="text-sm text-success">{success}</p>
          </div>
        )}

        {/* Form Content */}
        <div className="p-6 space-y-6">
          <div className="text-center mb-6">
            <Home className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">Unit Information</h3>
            <p className="text-sm text-muted-foreground">Enter the unit details</p>
          </div>

          {/* Unit Details Section */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <Home className="w-4 h-4" />
              Unit Details
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit Number *
                </label>
                <input
                  type="text"
                  value={formData.unitNumber}
                  onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })}
                  className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="e.g., 101"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Square Feet
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.unitSize || ''}
                  onChange={(e) => setFormData({ ...formData, unitSize: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="e.g., 750"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bedrooms *
                </label>
                <Dropdown
                  value={formData.unitBedrooms}
                  onChange={(value) => setFormData({ ...formData, unitBedrooms: value as BedroomEnum })}
                  options={BEDROOM_OPTIONS.map(option => ({ value: option, label: option }))}
                  placeholder="Select bedrooms"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bathrooms *
                </label>
                <Dropdown
                  value={formData.unitBathrooms}
                  onChange={(value) => setFormData({ ...formData, unitBathrooms: value as BathroomEnum })}
                  options={BATHROOM_OPTIONS.map(option => ({ value: option, label: option }))}
                  placeholder="Select bathrooms"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Market Rent
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.marketRent || ''}
                  onChange={(e) => setFormData({ ...formData, marketRent: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full h-9 pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="e.g., 1800.00"
                />
              </div>
            </div>



            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-h-[80px]"
                rows={3}
                placeholder="Brief description of the unit..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-border px-6 pb-6">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Unit'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
