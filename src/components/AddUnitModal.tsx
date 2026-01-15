'use client';

import { useState } from 'react';
import { Home } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Dropdown } from './ui/Dropdown';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';
import { Body, Heading, Label } from '@/ui/typography';

import {
  type BedroomEnum,
  type BathroomEnum,
  BEDROOM_OPTIONS,
  BATHROOM_OPTIONS,
} from '@/types/units';
import { UnitCreateSchema, type UnitCreateInput } from '@/schemas/unit';

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
      } as UnitCreateInput);

      if (!parsed.success) {
        const msg = parsed.error.issues.map((e: { message: string }) => e.message).join('\n');
        throw new Error(msg || 'Please correct the form errors');
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

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="md" className="bg-card max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="border-border border-b p-6">
          <DialogTitle asChild>
            <Heading size="h3">Add New Unit</Heading>
          </DialogTitle>
        </DialogHeader>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-destructive/10 border-destructive/20 mx-6 mt-4 rounded-md border p-4">
            <Body as="p" size="sm" className="text-destructive">
              {error}
            </Body>
          </div>
        )}

        {success && (
          <div className="bg-success/10 border-success/20 mx-6 mt-4 rounded-md border p-4">
            <Body as="p" size="sm" className="text-success">
              {success}
            </Body>
          </div>
        )}

        {/* Form Content */}
        <div className="space-y-6 p-6">
          <div className="mb-6 text-center">
            <Home className="text-primary mx-auto mb-4 h-12 w-12" />
            <Heading as="h2" size="h4" className="text-center">
              Unit Information
            </Heading>
            <Body size="sm" tone="muted" className="text-center">
              Enter the unit details
            </Body>
          </div>

          {/* Unit Details Section */}
          <div className="space-y-4">
            <Heading as="h3" size="h5" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Unit Details
            </Heading>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="unit-number" className="mb-1 block">
                  Unit Number *
                </Label>
                <Input
                  id="unit-number"
                  type="text"
                  value={formData.unitNumber}
                  onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })}
                  placeholder="e.g., 101"
                />
              </div>

              <div>
                <Label htmlFor="unit-size" className="mb-1 block">
                  Square Feet
                </Label>
                <Input
                  id="unit-size"
                  type="number"
                  min={0}
                  value={formData.unitSize || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      unitSize: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  placeholder="e.g., 750"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label as="p" className="mb-1 block">
                  Bedrooms *
                </Label>
                <Dropdown
                  value={formData.unitBedrooms}
                  onChange={(value) =>
                    setFormData({ ...formData, unitBedrooms: value as BedroomEnum })
                  }
                  options={BEDROOM_OPTIONS.map((option) => ({ value: option, label: option }))}
                  placeholder="Select bedrooms"
                />
              </div>

              <div>
                <Label as="p" className="mb-1 block">
                  Bathrooms *
                </Label>
                <Dropdown
                  value={formData.unitBathrooms}
                  onChange={(value) =>
                    setFormData({ ...formData, unitBathrooms: value as BathroomEnum })
                  }
                  options={BATHROOM_OPTIONS.map((option) => ({ value: option, label: option }))}
                  placeholder="Select bathrooms"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="market-rent" className="mb-1 block">
                Market Rent
              </Label>
              <div className="relative">
                <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
                  $
                </span>
                <Input
                  id="market-rent"
                  type="number"
                  min={0}
                  step={0.01}
                  value={formData.marketRent || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      marketRent: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="pl-8"
                  placeholder="e.g., 1800.00"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description" className="mb-1 block">
                Description
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[80px]"
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
      </DialogContent>
    </Dialog>
  );
}
