'use client';

import React, { useState, useEffect } from 'react';
import { User, Building, Mail, MapPin, FileText, DollarSign } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Button } from './components/ui/button';
import { DatePicker } from './components/ui/date-picker';
import AddressAutocomplete from './HybridAddressAutocomplete';
import { mapGoogleCountryToEnum } from '@/lib/utils';

const COUNTRIES = [
  'United States',
  'Canada',
  'Mexico',
  'United Kingdom',
  'Germany',
  'France',
  'Spain',
  'Italy',
  'Australia',
  'Japan',
  'China',
  'India',
  'Brazil',
  'Argentina',
  'South Africa',
];

const TAX_PAYER_TYPES = ['SSN', 'EIN'];
// Types for owner data to avoid explicit any
interface OwnerData {
  id: string;
  contact_id?: string;
  is_company?: boolean;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  date_of_birth?: string;
  primary_email?: string;
  alt_email?: string;
  primary_phone?: string;
  alt_phone?: string;
  mailing_preference?: string;
  primary_address_line_1?: string;
  primary_address_line_2?: string;
  primary_city?: string;
  primary_state?: string;
  primary_postal_code?: string;
  primary_country?: string;
  alt_address_line_1?: string;
  alt_address_line_2?: string;
  alt_city?: string;
  alt_state?: string;
  alt_postal_code?: string;
  alt_country?: string;
  tax_address_line1?: string;
  tax_address_line2?: string;
  tax_address_line3?: string;
  tax_city?: string;
  tax_state?: string;
  tax_postal_code?: string;
  tax_country?: string;
  tax_payer_id?: string;
  tax_payer_type?: string;
  tax_payer_name?: string;
  management_agreement_start_date?: string;
  management_agreement_end_date?: string;
  comment?: string;
  etf_account_type?: 'Checking' | 'Saving' | null;
  etf_account_number?: string;
  etf_routing_number?: string;
}

type OwnerUpdatePayload = Partial<OwnerData> & { id: string; contact_id?: string };

interface EditOwnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateOwner: (ownerData: OwnerUpdatePayload) => void;
  ownerData: OwnerData;
  isUpdating?: boolean;
}

export default function EditOwnerModal({
  isOpen,
  onClose,
  onUpdateOwner,
  ownerData,
  isUpdating = false,
}: EditOwnerModalProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'contact' | 'address' | 'tax' | 'owner'>(
    'basic',
  );
  const [error, setError] = useState<string | null>(null);
  const [showAlternateAddress, setShowAlternateAddress] = useState(false);

  const [formData, setFormData] = useState({
    // Basic Information
    isCompany: false,
    firstName: '',
    lastName: '',
    companyName: '',
    dateOfBirth: '',

    // Contact Information
    primaryEmail: '',
    altEmail: '',
    primaryPhone: '',
    altPhone: '',

    // Primary Address
    primaryAddressLine1: '',
    primaryAddressLine2: '',
    primaryCity: '',
    primaryState: '',
    primaryPostalCode: '',
    primaryCountry: 'United States',

    // Alternative Address
    altAddressLine1: '',
    altAddressLine2: '',
    altCity: '',
    altState: '',
    altPostalCode: '',
    altCountry: '',

    // Address Checkboxes
    taxSameAsPrimary: true,

    // Tax Information
    taxPayerId: '',
    taxPayerType: '',
    taxPayerName: '',
    taxAddressLine1: '',
    taxAddressLine2: '',
    taxAddressLine3: '',
    taxCity: '',
    taxState: '',
    taxPostalCode: '',
    taxCountry: '',

    // Owner-Specific Information
    managementAgreementStartDate: '',
    managementAgreementEndDate: '',
    comment: '',
    // ETF Account Information
    etfCheckingAccount: false,
    etfSavingAccount: false,
    etfAccountNumber: '',
    etfRoutingNumber: '',
  });

  // Load owner data when modal opens
  useEffect(() => {
    if (isOpen && ownerData) {
      setFormData({
        // Basic Information
        isCompany: ownerData.is_company || false,
        firstName: ownerData.first_name || '',
        lastName: ownerData.last_name || '',
        companyName: ownerData.company_name || '',
        dateOfBirth: ownerData.date_of_birth || '',

        // Contact Information
        primaryEmail: ownerData.primary_email || '',
        altEmail: ownerData.alt_email || '',
        primaryPhone: ownerData.primary_phone || '',
        altPhone: ownerData.alt_phone || '',

        // Primary Address
        primaryAddressLine1: ownerData.primary_address_line_1 || '',
        primaryAddressLine2: ownerData.primary_address_line_2 || '',
        primaryCity: ownerData.primary_city || '',
        primaryState: ownerData.primary_state || '',
        primaryPostalCode: ownerData.primary_postal_code || '',
        primaryCountry: ownerData.primary_country || 'United States',

        // Alternative Address
        altAddressLine1: ownerData.alt_address_line_1 || '',
        altAddressLine2: ownerData.alt_address_line_2 || '',
        altCity: ownerData.alt_city || '',
        altState: ownerData.alt_state || '',
        altPostalCode: ownerData.alt_postal_code || '',
        altCountry: ownerData.alt_country || '',

        // Address Checkboxes - Determine if addresses are same as primary

        taxSameAsPrimary: !ownerData.tax_address_line1 && !ownerData.tax_city,

        // Tax Information
        taxPayerId: ownerData.tax_payer_id || '',
        taxPayerType: ownerData.tax_payer_type || '',
        taxPayerName: ownerData.tax_payer_name || '',
        taxAddressLine1: ownerData.tax_address_line1 || '',
        taxAddressLine2: ownerData.tax_address_line2 || '',
        taxAddressLine3: ownerData.tax_address_line3 || '',
        taxCity: ownerData.tax_city || '',
        taxState: ownerData.tax_state || '',
        taxPostalCode: ownerData.tax_postal_code || '',
        taxCountry: ownerData.tax_country || '',

        // Owner-Specific Information
        managementAgreementStartDate: ownerData.management_agreement_start_date || '',
        managementAgreementEndDate: ownerData.management_agreement_end_date || '',
        comment: ownerData.comment || '',
        // ETF Account Information - Convert from single type to checkboxes
        etfCheckingAccount: ownerData.etf_account_type === 'Checking',
        etfSavingAccount: ownerData.etf_account_type === 'Saving',
        etfAccountNumber: ownerData.etf_account_number || '',
        etfRoutingNumber: ownerData.etf_routing_number || '',
      });
      setActiveTab('basic');
      setError(null);
      setShowAlternateAddress(Boolean(ownerData.alt_address_line_1 || ownerData.alt_city));
    }
  }, [isOpen, ownerData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (formData.isCompany && !formData.companyName) {
      setError('Company name is required for company owners');
      return;
    }

    if (!formData.isCompany && (!formData.firstName || !formData.lastName)) {
      setError('First name and last name are required for individual owners');
      return;
    }

    if (!formData.primaryEmail) {
      setError('Primary email is required');
      return;
    }

    if (!formData.primaryAddressLine1 || !formData.primaryPostalCode) {
      setError('Primary address line 1 and postal code are required');
      return;
    }

    // Clean up empty fields
    const cleanedData = Object.fromEntries(
      Object.entries(formData).filter(([_, value]) => value !== ''),
    );

    // Add the owner ID for the update
    const updateData = {
      ...cleanedData,
      id: ownerData.id,
      contact_id: ownerData.contact_id,
    };

    onUpdateOwner(updateData);
  };

  // Use Radix Dialog for focus management and accessibility

  const tabs = [
    { id: 'basic', name: 'Basic Info', icon: User },
    { id: 'contact', name: 'Contact', icon: Mail },
    { id: 'address', name: 'Addresses', icon: MapPin },
    { id: 'tax', name: 'Tax Info', icon: FileText },
    { id: 'owner', name: 'Banking Details', icon: DollarSign },
  ];

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="bg-card border-border/80 max-h-[90vh] w-[92vw] overflow-y-auto rounded-none border p-0 shadow-2xl sm:max-w-xl sm:rounded-2xl md:max-w-2xl lg:max-w-3xl">
        {/* Header */}
        <DialogHeader className="border-border border-b p-6">
          <DialogTitle className="text-foreground text-xl font-semibold">Edit Owner</DialogTitle>
        </DialogHeader>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="border-border border-b">
          <div className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() =>
                    setActiveTab(tab.id as 'basic' | 'contact' | 'address' | 'tax' | 'owner')
                  }
                  className={`flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:border-border border-transparent'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Basic Information Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <h3 className="text-foreground text-lg font-medium">Basic Information</h3>

              {/* Owner Type */}
              <div>
                <label className="text-foreground mb-3 block text-sm font-medium">Owner Type</label>
                <div className="flex items-center space-x-6">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="ownerType"
                      checked={!formData.isCompany}
                      onChange={() =>
                        setFormData((prev) => ({
                          ...prev,
                          isCompany: false,
                          taxPayerType: 'SSN', // Default to SSN for individuals
                        }))
                      }
                      className="mr-2"
                    />
                    <User className="mr-1 h-4 w-4" />
                    <span className="text-muted-foreground text-sm">Individual</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="ownerType"
                      checked={formData.isCompany}
                      onChange={() =>
                        setFormData((prev) => ({
                          ...prev,
                          isCompany: true,
                          taxPayerType: 'EIN', // Default to EIN for companies
                        }))
                      }
                      className="mr-2"
                    />
                    <Building className="mr-1 h-4 w-4" />
                    <span className="text-muted-foreground text-sm">Company</span>
                  </label>
                </div>
              </div>

              {/* Company Name - Only shown when company is selected */}
              {formData.isCompany && (
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, companyName: e.target.value }))
                    }
                    className="border-input focus-visible:ring-primary focus-visible:border-primary w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                    placeholder="Enter company name"
                    required
                  />
                </div>
              )}

              {/* Name Fields - Always shown, required when individual is selected */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    First Name {!formData.isCompany && '*'}
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, firstName: e.target.value }))
                    }
                    className="border-input focus-visible:ring-primary focus-visible:border-primary w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                    placeholder="Enter first name"
                    required={!formData.isCompany}
                  />
                </div>
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    Last Name {!formData.isCompany && '*'}
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                    className="border-input focus-visible:ring-primary focus-visible:border-primary w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                    placeholder="Enter last name"
                    required={!formData.isCompany}
                  />
                </div>
              </div>

              {/* Date of Birth - Always shown, never required */}
              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">
                  Date of Birth
                </label>
                <DatePicker
                  value={formData.dateOfBirth || ''}
                  onChange={(v: string | null) =>
                    setFormData((prev) => ({ ...prev, dateOfBirth: v ?? '' }))
                  }
                />
              </div>

              {/* Management Agreement Dates */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    Management Agreement Start Date
                  </label>
                  <DatePicker
                    value={formData.managementAgreementStartDate || ''}
                    onChange={(v: string | null) =>
                      setFormData((prev) => ({ ...prev, managementAgreementStartDate: v ?? '' }))
                    }
                  />
                </div>
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    Management Agreement End Date
                  </label>
                  <DatePicker
                    value={formData.managementAgreementEndDate || ''}
                    onChange={(v: string | null) =>
                      setFormData((prev) => ({ ...prev, managementAgreementEndDate: v ?? '' }))
                    }
                  />
                </div>
              </div>

              {/* Comments */}
              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">Comments</label>
                <textarea
                  value={formData.comment}
                  onChange={(e) => setFormData((prev) => ({ ...prev, comment: e.target.value }))}
                  className="border-input focus-visible:ring-primary focus-visible:border-primary w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                  rows={3}
                  placeholder="Additional notes about this owner..."
                />
              </div>
            </div>
          )}

          {/* Contact Information Tab */}
          {activeTab === 'contact' && (
            <div className="space-y-6">
              <h3 className="text-foreground text-lg font-medium">Contact Information</h3>

              {/* Email Addresses */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    Primary Email *
                  </label>
                  <input
                    type="email"
                    value={formData.primaryEmail}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, primaryEmail: e.target.value }))
                    }
                    className="border-input focus-visible:ring-primary focus-visible:border-primary w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                    placeholder="primary@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    Alternative Email
                  </label>
                  <input
                    type="email"
                    value={formData.altEmail}
                    onChange={(e) => setFormData((prev) => ({ ...prev, altEmail: e.target.value }))}
                    className="border-input focus-visible:ring-primary focus-visible:border-primary w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                    placeholder="alt@example.com"
                  />
                </div>
              </div>

              {/* Phone Numbers */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    Primary Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.primaryPhone}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, primaryPhone: e.target.value }))
                    }
                    className="border-input focus-visible:ring-primary focus-visible:border-primary w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    Alternative Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.altPhone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, altPhone: e.target.value }))}
                    className="border-input focus-visible:ring-primary focus-visible:border-primary w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                    placeholder="(555) 987-6543"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Address Information Tab */}
          {activeTab === 'address' && (
            <div className="space-y-8">
              <h3 className="text-foreground text-lg font-medium">Address Information</h3>

              {/* Primary Address */}
              <div className="space-y-4">
                <h4 className="text-foreground flex items-center gap-2 font-medium">
                  <MapPin className="h-4 w-4" />
                  Primary Address *
                </h4>
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    Street Address *
                  </label>
                  <AddressAutocomplete
                    value={formData.primaryAddressLine1}
                    onChange={(value) =>
                      setFormData((prev) => ({ ...prev, primaryAddressLine1: value }))
                    }
                    onPlaceSelect={(place) => {
                      const mappedCountry = mapGoogleCountryToEnum(place.country);
                      setFormData((prev) => ({
                        ...prev,
                        primaryAddressLine1: place.address,
                        primaryCity: place.city,
                        primaryState: place.state,
                        primaryPostalCode: place.postalCode,
                        primaryCountry: mappedCountry,
                      }));
                    }}
                    placeholder="123 Main Street"
                    required
                  />
                </div>
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    value={formData.primaryAddressLine2}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, primaryAddressLine2: e.target.value }))
                    }
                    className="border-input focus-visible:ring-primary focus-visible:border-primary w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                    placeholder="Primary address line 2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div>
                    <label className="text-foreground mb-1 block text-sm font-medium">City</label>
                    <input
                      type="text"
                      value={formData.primaryCity}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, primaryCity: e.target.value }))
                      }
                      className="border-input focus-visible:ring-primary focus-visible:border-primary w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                      placeholder="Los Angeles"
                    />
                  </div>
                  <div>
                    <label className="text-foreground mb-1 block text-sm font-medium">State</label>
                    <input
                      type="text"
                      value={formData.primaryState}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, primaryState: e.target.value }))
                      }
                      className="border-input focus-visible:ring-primary focus-visible:border-primary w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                      placeholder="CA"
                    />
                  </div>
                  <div>
                    <label className="text-foreground mb-1 block text-sm font-medium">
                      ZIP Code *
                    </label>
                    <input
                      type="text"
                      value={formData.primaryPostalCode}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, primaryPostalCode: e.target.value }))
                      }
                      className="border-input focus-visible:ring-primary focus-visible:border-primary w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                      placeholder="90210"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="primaryCountry"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Country
                    </label>
                    <select
                      id="primaryCountry"
                      value={formData.primaryCountry}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, primaryCountry: e.target.value }))
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {COUNTRIES.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Alternate Address */}
              {showAlternateAddress && (
                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 font-medium text-gray-900">
                    <MapPin className="h-4 w-4" />
                    Alternate Address
                  </h4>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Street Address
                    </label>
                    <AddressAutocomplete
                      value={formData.altAddressLine1}
                      onChange={(value) =>
                        setFormData((prev) => ({ ...prev, altAddressLine1: value }))
                      }
                      onPlaceSelect={(place) => {
                        const mappedCountry = mapGoogleCountryToEnum(place.country);
                        setFormData((prev) => ({
                          ...prev,
                          altAddressLine1: place.address,
                          altCity: place.city,
                          altState: place.state,
                          altPostalCode: place.postalCode,
                          altCountry: mappedCountry,
                        }));
                      }}
                      placeholder="Mailing address line 1"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      value={formData.altAddressLine2}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, altAddressLine2: e.target.value }))
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="Mailing address line 2"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">City</label>
                      <input
                        type="text"
                        value={formData.altCity}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, altCity: e.target.value }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Mailing city"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">State</label>
                      <input
                        type="text"
                        value={formData.altState}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, altState: e.target.value }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Mailing state"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        ZIP Code
                      </label>
                      <input
                        type="text"
                        value={formData.altPostalCode}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, altPostalCode: e.target.value }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Mailing ZIP"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="altCountry"
                        className="mb-1 block text-sm font-medium text-gray-700"
                      >
                        Country
                      </label>
                      <select
                        id="altCountry"
                        value={formData.altCountry}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, altCountry: e.target.value }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="">Select country</option>
                        {COUNTRIES.map((country) => (
                          <option key={country} value={country}>
                            {country}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tax Information Tab */}
          {activeTab === 'tax' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Tax Information</h3>

              {/* Tax Payer Information */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Tax Payer ID
                  </label>
                  <input
                    type="text"
                    value={formData.taxPayerId}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, taxPayerId: e.target.value }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="123-45-6789"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Tax Payer Type
                  </label>
                  <select
                    value={formData.taxPayerType}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, taxPayerType: e.target.value }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    aria-label="Tax payer type"
                  >
                    <option value="">Select type</option>
                    {TAX_PAYER_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tax Payer Name */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Tax Payer Name
                </label>
                <input
                  type="text"
                  value={formData.taxPayerName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, taxPayerName: e.target.value }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Full name or business name"
                />
              </div>

              {/* Tax Address */}
              <div className="space-y-4">
                <h4 className="flex items-center gap-2 font-medium text-gray-900">
                  <MapPin className="h-4 w-4" />
                  Tax Address
                </h4>

                {/* Tax Address Checkbox */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="taxSameAsPrimary"
                    checked={formData.taxSameAsPrimary}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        taxSameAsPrimary: e.target.checked,
                        // Clear tax address fields if same as primary
                        ...(e.target.checked && {
                          taxAddressLine1: '',
                          taxAddressLine2: '',
                          taxAddressLine3: '',
                          taxCity: '',
                          taxState: '',
                          taxPostalCode: '',
                          taxCountry: '',
                        }),
                      }))
                    }
                    className="mr-2"
                  />
                  <label htmlFor="taxSameAsPrimary" className="text-sm text-gray-700">
                    Same as primary address
                  </label>
                </div>

                {/* Tax Address Fields - Only show if not same as primary */}
                {!formData.taxSameAsPrimary && (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Street Address
                      </label>
                      <AddressAutocomplete
                        value={formData.taxAddressLine1}
                        onChange={(value) =>
                          setFormData((prev) => ({ ...prev, taxAddressLine1: value }))
                        }
                        onPlaceSelect={(place) => {
                          const mappedCountry = mapGoogleCountryToEnum(place.country);
                          setFormData((prev) => ({
                            ...prev,
                            taxAddressLine1: place.address,
                            taxCity: place.city,
                            taxState: place.state,
                            taxPostalCode: place.postalCode,
                            taxCountry: mappedCountry,
                          }));
                        }}
                        placeholder="Tax address line 1"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Address Line 2
                      </label>
                      <input
                        type="text"
                        value={formData.taxAddressLine2}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, taxAddressLine2: e.target.value }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Tax address line 2"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Address Line 3
                      </label>
                      <input
                        type="text"
                        value={formData.taxAddressLine3}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, taxAddressLine3: e.target.value }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Tax address line 3"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">City</label>
                        <input
                          type="text"
                          value={formData.taxCity}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, taxCity: e.target.value }))
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          placeholder="Tax city"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          State
                        </label>
                        <input
                          type="text"
                          value={formData.taxState}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, taxState: e.target.value }))
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          placeholder="Tax state"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          ZIP Code
                        </label>
                        <input
                          type="text"
                          value={formData.taxPostalCode}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, taxPostalCode: e.target.value }))
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          placeholder="Tax ZIP"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="taxCountry"
                          className="mb-1 block text-sm font-medium text-gray-700"
                        >
                          Country
                        </label>
                        <select
                          id="taxCountry"
                          value={formData.taxCountry}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, taxCountry: e.target.value }))
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                          <option value="">Select country</option>
                          {COUNTRIES.map((country) => (
                            <option key={country} value={country}>
                              {country}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Banking Details Tab */}
          {activeTab === 'owner' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Banking Details</h3>

              {/* ETF Account Information */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">ETF Account Information</h4>

                {/* Account Type Selection */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-gray-700">
                    Account Type
                  </label>
                  <div className="flex items-center space-x-6">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="accountType"
                        checked={formData.etfCheckingAccount}
                        onChange={() =>
                          setFormData((prev) => ({
                            ...prev,
                            etfCheckingAccount: true,
                            etfSavingAccount: false,
                          }))
                        }
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Checking</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="accountType"
                        checked={formData.etfSavingAccount}
                        onChange={() =>
                          setFormData((prev) => ({
                            ...prev,
                            etfCheckingAccount: false,
                            etfSavingAccount: true,
                          }))
                        }
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Saving</span>
                    </label>
                  </div>
                </div>

                {/* Account Details - Only show if an account type is selected */}
                {(formData.etfCheckingAccount || formData.etfSavingAccount) && (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Account Number
                      </label>
                      <input
                        type="text"
                        value={formData.etfAccountNumber}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, etfAccountNumber: e.target.value }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Account number"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Routing Number
                      </label>
                      <input
                        type="text"
                        value={formData.etfRoutingNumber}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, etfRoutingNumber: e.target.value }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Routing number"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Navigation and Submit */}
          <div className="border-border flex items-center justify-between border-t pt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? 'Updating...' : 'Update Owner'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
