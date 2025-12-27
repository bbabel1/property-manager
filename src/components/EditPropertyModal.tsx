'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useAuth } from '@/components/providers';
import { Save, MapPin, Home, Users } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { type PropertyWithDetails } from '@/lib/property-service';
import { type StatusEnum } from '@/types/properties';
import CreateOwnerModal, { type OwnerCreatePayload } from './CreateOwnerModal';
// import CreateStaffModal from './CreateStaffModal'
import AddressAutocomplete from './HybridAddressAutocomplete';
import { mapGoogleCountryToEnum } from '@/lib/utils';
import { Listbox } from '@headlessui/react';
import { Dropdown } from './ui/Dropdown';

interface Owner {
  id: string;
  displayName: string;
  first_name?: string;
  last_name?: string;
  is_company?: boolean;
  company_name?: string;
  primary_email?: string;
  primary_phone?: string;
}

// interface Staff {
//   id: string;
//   displayName: string;
//   firstName: string;
//   lastName: string;
//   email?: string;
//   phone?: string;
//   role: string;
// }

interface EditPropertyFormData {
  name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  property_type: string | null;
  status: string;
  year_built: number | null;
  // primary_owner removed - now determined from ownerships table
  owners: Array<{
    id: string;
    name: string;
    ownershipPercentage: number;
    disbursementPercentage: number;
    primary: boolean;
  }>;
}

interface EditPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  property: PropertyWithDetails;
}

const PROPERTY_TYPES: string[] = ['Condo', 'Co-op', 'Condop', 'Mult-Family', 'Townhouse'];

const STATUS_OPTIONS: StatusEnum[] = ['Active', 'Inactive'];

const parseOwnerList = (value: unknown): Owner[] => {
  if (!Array.isArray(value)) return [];
  const result: Owner[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Record<string, unknown>;
    const id = candidate.id;
    const displayName = candidate.displayName;
    if ((typeof id !== 'string' && typeof id !== 'number') || typeof displayName !== 'string') {
      continue;
    }
    result.push({
      id: String(id),
      displayName,
      first_name: typeof candidate.first_name === 'string' ? candidate.first_name : undefined,
      last_name: typeof candidate.last_name === 'string' ? candidate.last_name : undefined,
      is_company: typeof candidate.is_company === 'boolean' ? candidate.is_company : undefined,
      company_name:
        typeof candidate.company_name === 'string' ? candidate.company_name : undefined,
      primary_email:
        typeof candidate.primary_email === 'string' ? candidate.primary_email : undefined,
      primary_phone:
        typeof candidate.primary_phone === 'string' ? candidate.primary_phone : undefined,
    });
  }
  return result;
};

// Remove the local COUNTRY_ENUMS, COUNTRY_LABELS, and mapGoogleCountryToEnum definitions.
// Only import mapGoogleCountryToEnum from '@/lib/utils' at the top.

export default function EditPropertyModal({
  isOpen,
  onClose,
  onSuccess,
  property,
}: EditPropertyModalProps) {
  const { user, loading } = useAuth();
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [formData, setFormData] = useState<EditPropertyFormData>({
    name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    property_type: null,
    status: '',
    year_built: null,
    // primary_owner removed - now determined from ownerships table
    owners: [],
  });

  // Fetch CSRF token on mount
  useEffect(() => {
    const fetchCSRFToken = async () => {
      try {
        const response = await fetch('/api/csrf');
        if (response.ok) {
          const data = await response.json();
          setCsrfToken(data.token);
        }
      } catch (error) {
        console.error('Error fetching CSRF token:', error);
      }
    };

    fetchCSRFToken();
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [isLoadingOwners, setIsLoadingOwners] = useState(false);
  const [showCreateOwnerModal, setShowCreateOwnerModal] = useState(false);
  const [isCreatingOwner, setIsCreatingOwner] = useState(false);
  const [createOwnerError, setCreateOwnerError] = useState<string | null>(null);

  const fetchOwners = useCallback(async () => {
    try {
      setIsLoadingOwners(true);
      const response = await fetch('/api/owners');
      if (response.ok) {
        const data = await response.json().catch(() => null);
        const list = parseOwnerList(data);
        console.log('Fetched owners:', list);
        setOwners(list);
      } else {
        const errorData = await response.json();
        console.error('Failed to fetch owners:', response.status, errorData);
        setError(`Failed to fetch owners: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error fetching owners:', error);
      setError('Failed to fetch owners: Network error');
    } finally {
      setIsLoadingOwners(false);
    }
  }, []);

  // Fetch owners when modal opens and user is authenticated
  useEffect(() => {
    console.log('EditPropertyModal: isOpen =', isOpen);
    if (isOpen && !loading && user) {
      console.log('EditPropertyModal: Fetching owners...');
      if (owners.length === 0) fetchOwners();
    } else if (isOpen && loading) {
      console.log('EditPropertyModal: Waiting for authentication...');
    } else if (isOpen && !loading && !user) {
      console.log('EditPropertyModal: User not authenticated');
      setError('Please log in to edit properties');
    }
  }, [fetchOwners, isOpen, loading, owners.length, user]);

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen && property) {
      // Transform owners data to match form structure
      const transformedOwners =
        property.owners?.map((owner) => ({
          id: owner.id,
          name: owner.is_company
            ? owner.company_name || ''
            : `${owner.first_name || ''} ${owner.last_name || ''}`.trim(),
          ownershipPercentage: 100, // Default values - these would need to come from ownership table
          disbursementPercentage: 100,
          primary: false, // This would need to come from ownership table
        })) || [];

    setFormData({
      name: property.name || '',
      address_line1: property.address_line1 || '',
      address_line2: property.address_line2 || '',
      city: property.city || '',
      state: property.state || '',
      postal_code: property.postal_code || '',
      country: property.country || '',
      property_type: property.property_type || null,
      status: property.status || '',
      year_built: property.year_built || null,
      // primary_owner removed - now determined from ownerships table
      owners: transformedOwners,
    });
      setError(null);
    }
  }, [isOpen, property]);

  const addOwner = (ownerId: string) => {
    if (ownerId === 'create-new-owner') {
      setShowCreateOwnerModal(true);
      return;
    }

    const owner = owners.find((o) => o.id === ownerId);
    if (owner && !formData.owners.find((o) => o.id === ownerId)) {
      const isFirstOwner = formData.owners.length === 0;
      setFormData((prev) => {
        const newPrimaryOwnerName = isFirstOwner ? owner.displayName : '';

        // Auto-set property name when first owner is added
        let newPropertyName = prev.name;
        if (prev.address_line1 && newPrimaryOwnerName) {
          newPropertyName = `${prev.address_line1} | ${newPrimaryOwnerName}`;
        } else if (prev.address_line1) {
          newPropertyName = prev.address_line1;
        } else if (newPrimaryOwnerName) {
          newPropertyName = newPrimaryOwnerName;
        } else {
          newPropertyName = '';
        }

        return {
          ...prev,
          owners: [
            ...prev.owners,
            {
              id: owner.id,
              name: owner.displayName,
              ownershipPercentage: 100,
              disbursementPercentage: 100,
              primary: isFirstOwner, // First owner is primary by default
            },
          ],
          // primary_owner removed - now determined from ownerships table
          name: newPropertyName,
        };
      });
    }
  };

  const createNewOwner = async (ownerData: OwnerCreatePayload) => {
    try {
      setIsCreatingOwner(true);
      setCreateOwnerError(null);

      const response = await fetch('/api/owners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ownerData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create owner');
      }

      const newOwnerData = await response.json().catch(() => null);
      const parsedNewOwner = parseOwnerList([newOwnerData])[0];
      if (!parsedNewOwner) {
        throw new Error('Failed to parse created owner');
      }

      // Add the new owner to the owners list
      setOwners((prev) => [...prev, parsedNewOwner]);

      // Add the new owner to the form data
      const isFirstOwner = formData.owners.length === 0;
      setFormData((prev) => {
        const newPrimaryOwnerName = isFirstOwner ? parsedNewOwner.displayName : '';

        // Auto-set property name when first owner is created
        let newPropertyName = prev.name;
        if (prev.address_line1 && newPrimaryOwnerName) {
          newPropertyName = `${prev.address_line1} | ${newPrimaryOwnerName}`;
        } else if (prev.address_line1) {
          newPropertyName = prev.address_line1;
        } else if (newPrimaryOwnerName) {
          newPropertyName = newPrimaryOwnerName;
        } else {
          newPropertyName = '';
        }

        return {
          ...prev,
          owners: [
            ...prev.owners,
            {
              id: parsedNewOwner.id,
              name: parsedNewOwner.displayName,
              ownershipPercentage: 100,
              disbursementPercentage: 100,
              primary: isFirstOwner, // First owner is primary
            },
          ],
          // primary_owner removed - now determined from ownerships table
          name: newPropertyName,
        };
      });

      setShowCreateOwnerModal(false);
    } catch (error) {
      setCreateOwnerError(error instanceof Error ? error.message : 'Failed to create owner');
    } finally {
      setIsCreatingOwner(false);
    }
  };

  const removeOwner = (ownerId: string) => {
    setFormData((prev) => {
      const updatedOwners = prev.owners.filter((o) => o.id !== ownerId);

      // If we removed the primary owner and there are still owners left, make the first remaining owner primary
      const removedOwner = prev.owners.find((o) => o.id === ownerId);

      if (removedOwner?.primary && updatedOwners.length > 0) {
        updatedOwners[0].primary = true;
      }

      return {
        ...prev,
        owners: updatedOwners,
        // primary_owner removed - now determined from ownerships table
      };
    });
  };

  const updateOwnerPercentage = (
    ownerId: string,
    field: 'ownershipPercentage' | 'disbursementPercentage',
    value: number,
  ) => {
    setFormData((prev) => ({
      ...prev,
      owners: prev.owners.map((o) => (o.id === ownerId ? { ...o, [field]: value } : o)),
    }));
  };

  const setPrimaryOwner = (ownerId: string, isPrimary: boolean) => {
    setFormData((prev) => {
      const updatedOwners = prev.owners.map((o) => ({
        ...o,
        primary: o.id === ownerId ? isPrimary : o.primary,
      }));

      // Find the primary owner
      const primaryOwner = updatedOwners.find((o) => o.primary);
      const newPrimaryOwnerName = primaryOwner ? primaryOwner.name : '';

      // Auto-set property name when primary owner changes
      let newPropertyName = prev.name;
      if (prev.address_line1 && newPrimaryOwnerName) {
        newPropertyName = `${prev.address_line1} | ${newPrimaryOwnerName}`;
      } else if (prev.address_line1) {
        newPropertyName = prev.address_line1;
      } else if (newPrimaryOwnerName) {
        newPropertyName = newPrimaryOwnerName;
      } else {
        newPropertyName = '';
      }

      return {
        ...prev,
        owners: updatedOwners,
        // primary_owner removed - now determined from ownerships table
        name: newPropertyName,
      };
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (!csrfToken) {
        throw new Error('CSRF token not found');
      }

      console.log('🔍 EditPropertyModal: Submitting form data:', formData);
      console.log('🔍 EditPropertyModal: Owners in form data:', formData.owners);

      const response = await fetch(`/api/properties/${property.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          ...formData,
          csrfToken, // Include in body as well
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update property');
      }

      const result = await response.json();
      console.log('Property updated successfully:', result);

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating property:', error);
      setError(
        error instanceof Error ? error.message : 'Failed to update property. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof EditPropertyFormData, value: string | number | null) => {
    setFormData((prev) => {
      const updatedFormData = {
        ...prev,
        [field]: value,
      };

      // Auto-set property name when address_line1 changes
      if (field === 'address_line1') {
        const addressLine1 = field === 'address_line1' ? (value as string) : prev.address_line1;
        const primaryOwner = ''; // primary_owner removed - now determined from ownerships table

        if (addressLine1 && primaryOwner) {
          updatedFormData.name = `${addressLine1} | ${primaryOwner}`;
        } else if (addressLine1) {
          updatedFormData.name = addressLine1;
        } else if (primaryOwner) {
          updatedFormData.name = primaryOwner;
        } else {
          updatedFormData.name = '';
        }
      }

      return updatedFormData;
    });
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] w-[680px] max-w-[680px] overflow-y-auto rounded-none border-0 bg-white p-0 shadow-[0_4px_12px_rgba(0,0,0,0.08)] sm:rounded-2xl">
        {/* Header */}
        <DialogHeader className="border-border border-b p-6">
          <DialogTitle className="text-foreground text-xl font-semibold">
            Edit Property Details
          </DialogTitle>
        </DialogHeader>

        {/* Error Message */}
        {error && (
          <div className="bg-destructive/10 border-destructive/20 mx-6 mt-4 rounded-md border p-4">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {/* Form Content */}
        <form id="edit-property-form" onSubmit={handleSubmit} className="space-y-6 p-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="text-foreground flex items-center gap-2 font-medium">
              <Home className="h-4 w-4" />
              Basic Information
            </h4>

            <div className="space-y-4">
              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">Status *</label>
                <Dropdown
                  value={formData.status}
                  onChange={(value) => handleInputChange('status', value)}
                  options={STATUS_OPTIONS.map((option) => ({ value: option, label: option }))}
                  placeholder="Select status"
                />
              </div>

              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">
                  Property Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="focus-visible:ring-primary w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                  placeholder="e.g., Sunset Apartments"
                  required
                />
              </div>

              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">
                  Property Type *
                </label>
                <Dropdown
                  value={formData.property_type || ''}
                  onChange={(value) => handleInputChange('property_type', value)}
                  options={PROPERTY_TYPES.map((type) => ({ value: type, label: type }))}
                  placeholder="Select type"
                />
              </div>

              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">Year Built</label>
                <input
                  type="number"
                  value={formData.year_built || ''}
                  onChange={(e) =>
                    handleInputChange(
                      'year_built',
                      e.target.value ? parseInt(e.target.value) : null,
                    )
                  }
                  className="focus-visible:ring-primary bg-background text-foreground w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                  placeholder="e.g., 2010"
                  min="1800"
                  max={new Date().getFullYear()}
                />
              </div>

              {/* Remove or comment out the Primary Owner field (lines 577-587) */}
              {/*
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Primary Owner
                </label>
                <input
                  type="text"
                                value=""
              onChange={(e) => {}} // primary_owner removed - now determined from ownerships table
                  className="w-full px-3 py-2 border border-gray-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary text-sm bg-background text-foreground"
                  placeholder="e.g., John Smith"
                />
              </div>
              */}
            </div>
          </div>

          {/* Address Information */}
          <div className="space-y-4">
            <h4 className="text-foreground flex items-center gap-2 font-medium">
              <MapPin className="h-4 w-4" />
              Property Address
            </h4>
            <div>
              <label className="text-foreground mb-1 block text-sm font-medium">
                Street Address *
              </label>
              <AddressAutocomplete
                value={formData.address_line1}
                onChange={(value) => handleInputChange('address_line1', value)}
                onPlaceSelect={(place) => {
                  const mappedCountry = mapGoogleCountryToEnum(place.country);
                  setFormData((prev) => ({
                    ...prev,
                    address_line1: place.address,
                    city: place.city,
                    state: place.state,
                    postal_code: place.postalCode,
                    country: mappedCountry,
                  }));
                }}
                placeholder="e.g., 123 Main Street"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">City *</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="focus-visible:ring-primary bg-background text-foreground h-9 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                  placeholder="e.g., Los Angeles"
                  required
                />
              </div>
              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">State *</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  className="focus-visible:ring-primary bg-background text-foreground h-9 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                  placeholder="e.g., CA"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">ZIP Code *</label>
                <input
                  type="text"
                  value={formData.postal_code}
                  onChange={(e) => handleInputChange('postal_code', e.target.value)}
                  className="focus-visible:ring-primary bg-background text-foreground h-9 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                  placeholder="e.g., 90210"
                  required
                />
              </div>
              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">Country *</label>
                <Dropdown
                  value={formData.country}
                  onChange={(value) => handleInputChange('country', value)}
                  options={Object.values({
                    'United States': 'United States',
                    Canada: 'Canada',
                    'United Kingdom': 'United Kingdom',
                    Australia: 'Australia',
                    Germany: 'Germany',
                    France: 'France',
                    Japan: 'Japan',
                    China: 'China',
                    India: 'India',
                    Brazil: 'Brazil',
                  }).map((country) => ({ value: country, label: country }))}
                  placeholder="Select country"
                />
              </div>
            </div>
          </div>

          {/* Ownership Information */}
          <div className="space-y-4">
            <h4 className="text-foreground flex items-center gap-2 font-medium">
              <Users className="h-4 w-4" />
              Ownership
            </h4>

            <div className="space-y-4">
              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">
                  Add Owners *
                </label>
                <div className="relative">
                    <Listbox
                      value={''}
                      disabled={isLoadingOwners}
                      onChange={(value: string) => {
                        if (value) {
                          addOwner(value);
                          // Clear the selected value after adding
                        }
                      }}
                    >
                      <Listbox.Button className="bg-background text-foreground focus-visible:ring-primary focus-visible:border-primary flex h-9 w-full appearance-none items-center justify-between rounded-md border border-gray-200 px-3 py-2 focus-visible:ring-2 focus-visible:outline-none">
                      <span className="block truncate text-sm">
                        {isLoadingOwners ? 'Loading owners…' : 'Choose owners to add...'}
                      </span>
                      <svg
                        className="text-muted-foreground ml-2 h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          d="M7 7l3 3 3-3"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </Listbox.Button>
                    <Listbox.Options className="bg-card text-foreground border-border animate-in fade-in-0 zoom-in-95 absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border p-1 ring-1 ring-black/5 focus:outline-none">
                      {owners.map((owner) => (
                        <Listbox.Option
                          key={owner.id}
                          value={owner.id}
                          className="focus:bg-accent focus:text-accent-foreground data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground relative flex w-full items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none select-none"
                        >
                          {({ selected }: { selected: boolean }) => (
                            <>
                              <span
                                className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}
                              >
                                {owner.displayName}
                              </span>
                              {selected ? (
                                <span className="text-primary absolute inset-y-0 left-0 flex items-center pl-3">
                                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </span>
                              ) : null}
                            </>
                          )}
                        </Listbox.Option>
                      ))}
                      <Listbox.Option
                        value="create-new-owner"
                        className="focus:bg-accent focus:text-accent-foreground data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground relative flex w-full items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none select-none"
                      >
                        {({ selected }: { selected: boolean }) => (
                          <>
                            <span className="text-primary font-medium">+ Create New Owner</span>
                            {selected ? (
                              <span className="text-primary absolute inset-y-0 left-0 flex items-center pl-3">
                                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </span>
                            ) : null}
                          </>
                        )}
                      </Listbox.Option>
                    </Listbox.Options>
                  </Listbox>
                </div>
              </div>

              {formData.owners.length > 0 && (
                <div className="border-border bg-muted rounded-lg border p-4">
                  <h4 className="text-foreground mb-3 text-base font-medium">Selected Owners</h4>
                  <div className="space-y-3">
                    {formData.owners.map((owner) => (
                      <div
                        key={owner.id}
                        className="border-border bg-card space-y-3 rounded-md border p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-foreground font-medium">{owner.name}</div>
                          <button
                            type="button"
                            onClick={() => removeOwner(owner.id)}
                            className="text-sm text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label
                              htmlFor={`ownership-${owner.id}`}
                              className="text-muted-foreground mb-1 block text-xs"
                            >
                              Ownership %
                            </label>
                            <input
                              id={`ownership-${owner.id}`}
                              type="number"
                              value={owner.ownershipPercentage}
                              onChange={(e) =>
                                updateOwnerPercentage(
                                  owner.id,
                                  'ownershipPercentage',
                                  Number(e.target.value),
                                )
                              }
                              className="bg-background text-foreground h-8 w-full rounded border border-gray-200 px-2 py-1 text-sm"
                              min="0"
                              max="100"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor={`disbursement-${owner.id}`}
                              className="text-muted-foreground mb-1 block text-xs"
                            >
                              Disbursement %
                            </label>
                            <input
                              id={`disbursement-${owner.id}`}
                              type="number"
                              value={owner.disbursementPercentage}
                              onChange={(e) =>
                                updateOwnerPercentage(
                                  owner.id,
                                  'disbursementPercentage',
                                  Number(e.target.value),
                                )
                              }
                              className="bg-background text-foreground h-8 w-full rounded border border-gray-200 px-2 py-1 text-sm"
                              min="0"
                              max="100"
                            />
                          </div>
                          <div className="flex items-center space-x-2 pt-5">
                            <input
                              type="checkbox"
                              id={`primary-${owner.id}`}
                              checked={owner.primary}
                              onChange={(e) => setPrimaryOwner(owner.id, e.target.checked)}
                              className="mr-2"
                            />
                            <label
                              htmlFor={`primary-${owner.id}`}
                              className="text-muted-foreground text-sm"
                            >
                              Primary
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Actions */}
        <div className="border-border flex justify-end gap-3 border-t px-6 pt-6 pb-6">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>

          <Button type="submit" form="edit-property-form" disabled={isLoading}>
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </DialogContent>

      {/* Create Owner Modal */}
      <CreateOwnerModal
        isOpen={showCreateOwnerModal}
        onClose={() => setShowCreateOwnerModal(false)}
        onCreateOwner={(ownerData) => {
          void createNewOwner(ownerData);
        }}
        isLoading={isCreatingOwner}
        error={createOwnerError}
      />
    </Dialog>
  );
}
