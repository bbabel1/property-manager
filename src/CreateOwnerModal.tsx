'use client';

import React, { useState } from 'react';
import { User, Building, Mail, MapPin, FileText, DollarSign, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Button } from './components/ui/button';
import AddressAutocomplete from './HybridAddressAutocomplete';
import { DatePicker } from './components/ui/date-picker';
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
];

const MAILING_PREFERENCES = ['primary', 'alternate'] as const;
type MailingPreference = (typeof MAILING_PREFERENCES)[number];

const TAX_PAYER_TYPES = ['SSN', 'EIN'] as const;
type TaxPayerType = (typeof TAX_PAYER_TYPES)[number];

type OwnerFormData = {
  isCompany: boolean;
  firstName: string;
  lastName: string;
  companyName: string;
  dateOfBirth: string;
  primaryEmail: string;
  altEmail: string;
  primaryPhone: string;
  altPhone: string;
  primaryAddressLine1: string;
  primaryAddressLine2: string;
  primaryCity: string;
  primaryState: string;
  primaryPostalCode: string;
  primaryCountry: string;
  altAddressLine1: string;
  altAddressLine2: string;
  altCity: string;
  altState: string;
  altPostalCode: string;
  altCountry: string;
  taxSameAsPrimary: boolean;
  mailingPreference: MailingPreference;
  taxPayerId: string;
  taxPayerType: TaxPayerType;
  taxPayerName: string;
  taxAddressLine1: string;
  taxAddressLine2: string;
  taxAddressLine3: string;
  taxCity: string;
  taxState: string;
  taxPostalCode: string;
  taxCountry: string;
  managementAgreementStartDate: string;
  managementAgreementEndDate: string;
  comment: string;
  etfCheckingAccount: boolean;
  etfSavingAccount: boolean;
  etfAccountNumber: string;
  etfRoutingNumber: string;
};

interface CreateOwnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateOwner: (ownerData: Partial<OwnerFormData>) => void;
  isLoading: boolean;
  error: string | null;
}

export default function CreateOwnerModal({
  isOpen,
  onClose,
  onCreateOwner,
  isLoading,
  error,
}: CreateOwnerModalProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const [showAlternateAddress, setShowAlternateAddress] = useState(false);
  const [formData, setFormData] = useState<OwnerFormData>({
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

    // Mailing Preference
    mailingPreference: 'primary',

    // Tax Information
    taxPayerId: '',
    taxPayerType: 'SSN',
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (formData.isCompany && !formData.companyName) {
      return;
    }

    if (!formData.isCompany && (!formData.firstName || !formData.lastName)) {
      return;
    }

    if (!formData.primaryEmail) {
      return;
    }

    if (!formData.primaryAddressLine1 || !formData.primaryPostalCode) {
      return;
    }

    // Clean up empty fields
    const cleanedData: Partial<OwnerFormData> = Object.fromEntries(
      Object.entries(formData).filter(([, value]) => value !== ''),
    ) as Partial<OwnerFormData>;

    onCreateOwner(cleanedData);
  };

  const handleMailingPreferenceChange = (value: MailingPreference) => {
    setFormData((prev) => ({
      ...prev,
      mailingPreference: value,
    }));
    setShowAlternateAddress(value === 'alternate');
  };

  const resetForm = () => {
    setFormData({
      isCompany: false,
      firstName: '',
      lastName: '',
      companyName: '',
      dateOfBirth: '',
      primaryEmail: '',
      altEmail: '',
      primaryPhone: '',
      altPhone: '',
      primaryAddressLine1: '',
      primaryAddressLine2: '',
      primaryCity: '',
      primaryState: '',
      primaryPostalCode: '',
      primaryCountry: 'United States',
      altAddressLine1: '',
      altAddressLine2: '',
      altCity: '',
      altState: '',
      altPostalCode: '',
      altCountry: '',
      taxSameAsPrimary: true,
      mailingPreference: 'primary',
      taxPayerId: '',
      taxPayerType: 'SSN',
      taxPayerName: '',
      taxAddressLine1: '',
      taxAddressLine2: '',
      taxAddressLine3: '',
      taxCity: '',
      taxState: '',
      taxPostalCode: '',
      taxCountry: '',
      managementAgreementStartDate: '',
      managementAgreementEndDate: '',
      comment: '',
      etfCheckingAccount: false,
      etfSavingAccount: false,
      etfAccountNumber: '',
      etfRoutingNumber: '',
    });
    setActiveTab('basic');
    setShowAlternateAddress(false);
  };

  // Controlled Radix Dialog will manage close via backdrop/Escape

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
        if (!open) {
          resetForm();
          onClose();
        }
      }}
    >
      <DialogContent className="bg-card border-border/80 max-h-[90vh] w-[92vw] overflow-y-auto rounded-none border p-0 shadow-2xl sm:max-w-xl sm:rounded-2xl md:max-w-2xl lg:max-w-3xl">
        {/* Header */}
        <DialogHeader className="border-border border-b p-6">
          <DialogTitle className="text-foreground text-xl font-semibold">
            Create New Owner
          </DialogTitle>
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
                  onClick={() => setActiveTab(tab.id)}
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
                      checked={!formData.isCompany}
                      onChange={() =>
                        setFormData((prev) => ({
                          ...prev,
                          isCompany: false,
                          taxPayerType: 'SSN',
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
                      checked={formData.isCompany}
                      onChange={() =>
                        setFormData((prev) => ({
                          ...prev,
                          isCompany: true,
                          taxPayerType: 'EIN',
                        }))
                      }
                      className="mr-2"
                    />
                    <Building className="mr-1 h-4 w-4" />
                    <span className="text-muted-foreground text-sm">Company</span>
                  </label>
                </div>
              </div>

              {/* Company Name */}
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
                    className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                    placeholder="Enter company name"
                    required
                  />
                </div>
              )}

              {/* Name Fields */}
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
                    className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
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
                    className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                    placeholder="Enter last name"
                    required={!formData.isCompany}
                  />
                </div>
              </div>

              {/* Date of Birth */}
              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">
                  Date of Birth
                </label>
                <DatePicker
                  value={formData.dateOfBirth || ''}
                  onChange={(v) => setFormData((prev) => ({ ...prev, dateOfBirth: v ?? '' }))}
                />
              </div>

              {/* Management Agreement Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    Management Agreement Start Date
                  </label>
                  <DatePicker
                    value={formData.managementAgreementStartDate || ''}
                    onChange={(v) =>
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
                    onChange={(v) =>
                      setFormData((prev) => ({ ...prev, managementAgreementEndDate: v ?? '' }))
                    }
                  />
                </div>
              </div>

              {/* Comment */}
              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">Comment</label>
                <textarea
                  value={formData.comment}
                  onChange={(e) => setFormData((prev) => ({ ...prev, comment: e.target.value }))}
                  className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                  rows={3}
                  placeholder="Additional notes..."
                />
              </div>
            </div>
          )}

          {/* Contact Information Tab */}
          {activeTab === 'contact' && (
            <div className="space-y-6">
              <h3 className="text-foreground text-lg font-medium">Contact Information</h3>

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
                    className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                    placeholder="john@example.com"
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
                    className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                    placeholder="john.alt@example.com"
                  />
                </div>
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
                    className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
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
                    className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
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
                    className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
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
                      className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
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
                      className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
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
                      className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                      placeholder="90210"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-foreground mb-1 block text-sm font-medium">
                      Country
                    </label>
                    <select
                      value={formData.primaryCountry}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, primaryCountry: e.target.value }))
                      }
                      className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                      aria-label="Primary address country"
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

              {/* Mailing Preference */}
              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">
                  Mailing Preference
                </label>
                <select
                  value={formData.mailingPreference}
                  onChange={(e) => handleMailingPreferenceChange(e.target.value)}
                  className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                  aria-label="Mailing preference"
                >
                  {MAILING_PREFERENCES.map((pref) => (
                    <option key={pref} value={pref}>
                      {pref.charAt(0).toUpperCase() + pref.slice(1)} Address
                    </option>
                  ))}
                </select>
              </div>

              {/* Alternate Address */}
              {showAlternateAddress && (
                <div className="space-y-4">
                  <h4 className="text-foreground flex items-center gap-2 font-medium">
                    <MapPin className="h-4 w-4" />
                    Alternate Address
                  </h4>
                  <div>
                    <label className="text-foreground mb-1 block text-sm font-medium">
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
                    <label className="text-foreground mb-1 block text-sm font-medium">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      value={formData.altAddressLine2}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, altAddressLine2: e.target.value }))
                      }
                      className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                      placeholder="Mailing address line 2"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div>
                      <label className="text-foreground mb-1 block text-sm font-medium">City</label>
                      <input
                        type="text"
                        value={formData.altCity}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, altCity: e.target.value }))
                        }
                        className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                        placeholder="Mailing city"
                      />
                    </div>
                    <div>
                      <label className="text-foreground mb-1 block text-sm font-medium">
                        State
                      </label>
                      <input
                        type="text"
                        value={formData.altState}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, altState: e.target.value }))
                        }
                        className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                        placeholder="Mailing state"
                      />
                    </div>
                    <div>
                      <label className="text-foreground mb-1 block text-sm font-medium">
                        ZIP Code
                      </label>
                      <input
                        type="text"
                        value={formData.altPostalCode}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, altPostalCode: e.target.value }))
                        }
                        className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                        placeholder="Mailing ZIP"
                      />
                    </div>
                    <div>
                      <label className="text-foreground mb-1 block text-sm font-medium">
                        Country
                      </label>
                      <select
                        value={formData.altCountry}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, altCountry: e.target.value }))
                        }
                        className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                        aria-label="Alternate address country"
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
              <h3 className="text-foreground text-lg font-medium">Tax Information</h3>

              {/* Tax Payer Information */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    Tax Payer ID
                  </label>
                  <input
                    type="text"
                    value={formData.taxPayerId}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, taxPayerId: e.target.value }))
                    }
                    className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                    placeholder="123-45-6789"
                  />
                </div>
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    Tax Payer Type
                  </label>
                  <select
                    value={formData.taxPayerType}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, taxPayerType: e.target.value }))
                    }
                    className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
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
                <label className="text-foreground mb-1 block text-sm font-medium">
                  Tax Payer Name
                </label>
                <input
                  type="text"
                  value={formData.taxPayerName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, taxPayerName: e.target.value }))
                  }
                  className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                  placeholder="Full name or business name"
                />
              </div>

              {/* Tax Address */}
              <div className="space-y-4">
                <h4 className="text-foreground flex items-center gap-2 font-medium">
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
                  <label htmlFor="taxSameAsPrimary" className="text-muted-foreground text-sm">
                    Same as primary address
                  </label>
                </div>

                {/* Tax Address Fields - Only show if not same as primary */}
                {!formData.taxSameAsPrimary && (
                  <>
                    <div>
                      <label className="text-foreground mb-1 block text-sm font-medium">
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
                      <label className="text-foreground mb-1 block text-sm font-medium">
                        Address Line 2
                      </label>
                      <input
                        type="text"
                        value={formData.taxAddressLine2}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, taxAddressLine2: e.target.value }))
                        }
                        className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                        placeholder="Tax address line 2"
                      />
                    </div>
                    <div>
                      <label className="text-foreground mb-1 block text-sm font-medium">
                        Address Line 3
                      </label>
                      <input
                        type="text"
                        value={formData.taxAddressLine3}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, taxAddressLine3: e.target.value }))
                        }
                        className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                        placeholder="Tax address line 3"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div>
                        <label className="text-foreground mb-1 block text-sm font-medium">
                          City
                        </label>
                        <input
                          type="text"
                          value={formData.taxCity}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, taxCity: e.target.value }))
                          }
                          className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                          placeholder="Tax city"
                        />
                      </div>
                      <div>
                        <label className="text-foreground mb-1 block text-sm font-medium">
                          State
                        </label>
                        <input
                          type="text"
                          value={formData.taxState}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, taxState: e.target.value }))
                          }
                          className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                          placeholder="Tax state"
                        />
                      </div>
                      <div>
                        <label className="text-foreground mb-1 block text-sm font-medium">
                          ZIP Code
                        </label>
                        <input
                          type="text"
                          value={formData.taxPostalCode}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, taxPostalCode: e.target.value }))
                          }
                          className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                          placeholder="Tax ZIP"
                        />
                      </div>
                      <div>
                        <label className="text-foreground mb-1 block text-sm font-medium">
                          Country
                        </label>
                        <select
                          value={formData.taxCountry}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, taxCountry: e.target.value }))
                          }
                          className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                          aria-label="Tax address country"
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

          {/* Owner-Specific Information Tab */}
          {activeTab === 'owner' && (
            <div className="space-y-6">
              <h3 className="text-foreground text-lg font-medium">Banking Details</h3>

              {/* ETF Account Type */}
              <div>
                <label className="text-foreground mb-3 block text-sm font-medium">
                  ETF Account Type
                </label>
                <div className="flex items-center space-x-6">
                  <label className="flex items-center">
                    <input
                      type="radio"
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
                    <span className="text-muted-foreground text-sm">Checking</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={formData.etfSavingAccount}
                      onChange={() =>
                        setFormData((prev) => ({
                          ...prev,
                          etfSavingAccount: true,
                          etfCheckingAccount: false,
                        }))
                      }
                      className="mr-2"
                    />
                    <span className="text-muted-foreground text-sm">Saving</span>
                  </label>
                </div>
              </div>

              {/* ETF Account Details */}
              {(formData.etfCheckingAccount || formData.etfSavingAccount) && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-foreground mb-1 block text-sm font-medium">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={formData.etfAccountNumber}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, etfAccountNumber: e.target.value }))
                      }
                      className="border-input focus-visible:ring-primary focus-visible:border-primary w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                      placeholder="Account number"
                    />
                  </div>
                  <div>
                    <label className="text-foreground mb-1 block text-sm font-medium">
                      Routing Number
                    </label>
                    <input
                      type="text"
                      value={formData.etfRoutingNumber}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, etfRoutingNumber: e.target.value }))
                      }
                      className="border-input focus-visible:ring-primary focus-visible:border-primary w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                      placeholder="Routing number"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation and Submit Buttons */}
          <div className="border-border mt-8 flex items-center justify-between border-t pt-6">
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  resetForm();
                  onClose();
                }}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
            <div className="flex space-x-3">
              {activeTab !== 'basic' && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
                    if (currentIndex > 0) {
                      setActiveTab(tabs[currentIndex - 1].id);
                    }
                  }}
                  disabled={isLoading}
                >
                  Previous
                </Button>
              )}
              {activeTab !== 'owner' ? (
                <Button
                  type="button"
                  onClick={() => {
                    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
                    if (currentIndex < tabs.length - 1) {
                      setActiveTab(tabs[currentIndex + 1].id);
                    }
                  }}
                  disabled={isLoading}
                >
                  Next
                </Button>
              ) : (
                <Button type="submit" disabled={isLoading} className="flex items-center px-6">
                  {isLoading ? (
                    <>
                      <div className="border-primary-foreground mr-2 h-4 w-4 animate-spin rounded-full border-b-2"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Owner
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
