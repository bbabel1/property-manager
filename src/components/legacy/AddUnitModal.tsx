'use client';

import { useState } from 'react';
import { X, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/Dropdown';

import {
  type BedroomEnum,
  type BathroomEnum,
  BEDROOM_OPTIONS,
  BATHROOM_OPTIONS,
} from '@/types/units';

interface AddUnitFormData {
  unitNumber: string;
  unitSize?: number;
  marketRent?: number;
  unitBedrooms: BedroomEnum | '';
  unitBathrooms: BathroomEnum | '';
  description?: string;
}

interface AddUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  propertyId: string;
  property?: {
    address_line1: string;
    address_line2?: string;
    address_line3?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
}

export default function AddUnitModal({
  isOpen,
  onClose,
  onSuccess,
  propertyId,
  property,
}: AddUnitModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState<AddUnitFormData>({
    unitNumber: '',
    unitSize: undefined,
    marketRent: undefined,
    unitBedrooms: '',
    unitBathrooms: '',
    description: '',
  });

  const handleSubmit = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      // Basic validation
      if (!formData.unitNumber) {
        throw new Error('Unit number is required');
      }
      if (!formData.unitBedrooms) {
        throw new Error('Number of bedrooms is required');
      }
      if (!formData.unitBathrooms) {
        throw new Error('Number of bathrooms is required');
      }
      if (!property?.address_line1) {
        throw new Error('Property address information is required');
      }

      // Submit the form data to your API
      const response = await fetch('/api/units', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          propertyId,
          // Include property address data
          addressLine1: property?.address_line1 || '',
          addressLine2: property?.address_line2 || '',
          addressLine3: property?.address_line3 || '',
          city: property?.city || '',
          state: property?.state || '',
          postalCode: property?.postal_code || '',
          country: property?.country || '',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create unit');
      }

      await response.json();
      setSuccess('Unit created successfully!');

      // Reset form
      setFormData({
        unitNumber: '',
        unitSize: undefined,
        marketRent: undefined,
        unitBedrooms: '',
        unitBathrooms: '',
        description: '',
      });

      // Close modal after a short delay to show success message
      setTimeout(() => {
        onClose();
        setSuccess(null);
        // Call onSuccess callback to refresh the units list
        if (onSuccess) {
          onSuccess();
        }
      }, 1500);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create unit. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-card max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border shadow-xl">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b p-6">
          <h2 className="text-foreground text-xl font-semibold">Add New Unit</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close modal"
            title="Close modal"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-destructive/10 border-destructive/20 mx-6 mt-4 rounded-md border p-4">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-success/10 border-success/20 mx-6 mt-4 rounded-md border p-4">
            <p className="text-success text-sm">{success}</p>
          </div>
        )}

        {/* Form Content */}
        <div className="space-y-6 p-6">
          <div className="mb-6 text-center">
            <Home className="text-primary mx-auto mb-4 h-12 w-12" />
            <h3 className="text-foreground text-lg font-medium">Unit Information</h3>
            <p className="text-muted-foreground text-sm">Enter the unit details</p>
          </div>

          {/* Unit Details Section */}
          <div className="space-y-4">
            <h4 className="flex items-center gap-2 font-medium text-gray-900">
              <Home className="h-4 w-4" />
              Unit Details
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Unit Number *
                </label>
                <input
                  type="text"
                  value={formData.unitNumber}
                  onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })}
                  className="h-9 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g., 101"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Square Feet</label>
                <input
                  type="number"
                  min="0"
                  value={formData.unitSize || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      unitSize: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="h-9 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g., 750"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Bedrooms *</label>
                <Dropdown
                  value={formData.unitBedrooms}
                  onChange={(value: string) =>
                    setFormData({ ...formData, unitBedrooms: value as BedroomEnum })
                  }
                  options={BEDROOM_OPTIONS.map((option) => ({ value: option, label: option }))}
                  placeholder="Select bedrooms"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Bathrooms *</label>
                <Dropdown
                  value={formData.unitBathrooms}
                  onChange={(value: string) =>
                    setFormData({ ...formData, unitBathrooms: value as BathroomEnum })
                  }
                  options={BATHROOM_OPTIONS.map((option) => ({ value: option, label: option }))}
                  placeholder="Select bathrooms"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Market Rent</label>
              <div className="relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.marketRent || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      marketRent: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="h-9 w-full rounded-md border border-gray-300 py-2 pr-3 pl-8 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g., 1800.00"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[80px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                rows={3}
                placeholder="Brief description of the unit..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="border-border flex justify-end gap-3 border-t px-6 pt-6 pb-6">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>

            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Unit'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
