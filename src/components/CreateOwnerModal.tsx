'use client';

import React, { useState, type FormEvent } from 'react';
import { User, Building, Mail, MapPin, FileText, DollarSign, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import AddressAutocomplete from './HybridAddressAutocomplete';
import { DatePicker } from './ui/date-picker';
import { mapGoogleCountryToEnum } from '@/lib/utils';
import { Checkbox } from '@/ui/checkbox';
import { Select } from '@/ui/select';
import { Body, Heading, Label } from '@/ui/typography';
// import { useForm } from 'react-hook-form'
// import { zodResolver } from '@hookform/resolvers/zod'
// import { OwnerCreateSchema, type OwnerCreateInput } from '@/schemas/owner'

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

const TAX_PAYER_TYPES = ['SSN', 'EIN'] as const;

const coerceMailingPreference = (
  value: string,
): OwnerCreatePayload['mailingPreference'] =>
  MAILING_PREFERENCES.includes(value as (typeof MAILING_PREFERENCES)[number])
    ? (value as (typeof MAILING_PREFERENCES)[number])
    : 'primary';

const coerceTaxPayerType = (value: string): OwnerCreatePayload['taxPayerType'] =>
  TAX_PAYER_TYPES.includes(value as (typeof TAX_PAYER_TYPES)[number])
    ? (value as (typeof TAX_PAYER_TYPES)[number])
    : 'SSN';

// const ETF_ACCOUNT_TYPES = [
//   'Checking',
//   'Saving'
// ]

export type OwnerCreatePayload = {
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
  mailingPreference: (typeof MAILING_PREFERENCES)[number];
  taxPayerId: string;
  taxPayerType: (typeof TAX_PAYER_TYPES)[number];
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
  onCreateOwner: (ownerData: OwnerCreatePayload) => void | Promise<void>;
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
  const initialFormState: OwnerCreatePayload = {
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
  };

  const [formData, setFormData] = useState<OwnerCreatePayload>(initialFormState);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
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

    onCreateOwner(formData as OwnerCreatePayload);
  };

  const handleMailingPreferenceChange = (value: OwnerCreatePayload['mailingPreference']) => {
    setFormData((prev) => ({
      ...prev,
      mailingPreference: value,
    }));
    setShowAlternateAddress(value === 'alternate');
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setActiveTab('basic');
    setShowAlternateAddress(false);
  };

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
      <DialogContent className="bg-card border-border/80 max-h-[90vh] w-[680px] max-w-[680px] overflow-y-auto rounded-none border p-0 shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <DialogHeader className="border-border border-b p-6">
          <DialogTitle>
            <Heading as="div" size="h4">
              Create New Owner
            </Heading>
          </DialogTitle>
        </DialogHeader>

        {/* Error Message */}
        {error && (
          <Body
            as="div"
            size="sm"
            className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-red-600"
          >
            {error}
          </Body>
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
                  className={`flex items-center gap-2 border-b-2 px-1 py-4 ${
                    activeTab === tab.id
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <Label as="span" size="sm" className="text-inherit">
                    {tab.name}
                  </Label>
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
              <Heading as="h3" size="h5">
                Basic Information
              </Heading>

              {/* Owner Type */}
              <div>
                <Label className="mb-3 block">Owner Type</Label>
                <div className="flex items-center space-x-6">
                  <Label as="label" className="flex items-center">
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
                    <Body as="span" size="sm" tone="muted">
                      Individual
                    </Body>
                  </Label>
                  <Label as="label" className="flex items-center">
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
                    <Body as="span" size="sm" tone="muted">
                      Company
                    </Body>
                  </Label>
                </div>
              </div>

              {/* Company Name */}
              {formData.isCompany && (
                <div>
                  <Label className="mb-1 block">
                    Company Name *
                  </Label>
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
                  <Label className="mb-1 block">
                    First Name {!formData.isCompany && '*'}
                  </Label>
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
                  <Label className="mb-1 block">
                    Last Name {!formData.isCompany && '*'}
                  </Label>
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
                <Label className="mb-1 block">
                  Date of Birth
                </Label>
                <DatePicker
                  value={formData.dateOfBirth || ''}
                  onChange={(v) => setFormData((prev) => ({ ...prev, dateOfBirth: v ?? '' }))}
                />
              </div>

              {/* Management Agreement Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block">
                    Management Agreement Start Date
                  </Label>
                  <DatePicker
                    value={formData.managementAgreementStartDate || ''}
                    onChange={(v) =>
                      setFormData((prev) => ({ ...prev, managementAgreementStartDate: v ?? '' }))
                    }
                  />
                </div>
                <div>
                  <Label className="mb-1 block">
                    Management Agreement End Date
                  </Label>
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
                <Label className="mb-1 block">Comment</Label>
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
              <Heading as="h3" size="h5">Contact Information</Heading>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label className="mb-1 block">
                    Primary Email *
                  </Label>
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
                  <Label className="mb-1 block">
                    Alternative Email
                  </Label>
                  <input
                    type="email"
                    value={formData.altEmail}
                    onChange={(e) => setFormData((prev) => ({ ...prev, altEmail: e.target.value }))}
                    className="border-input focus-visible:ring-primary focus-visible:border-primary bg-background text-foreground w-full rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
                    placeholder="john.alt@example.com"
                  />
                </div>
                <div>
                  <Label className="mb-1 block">
                    Primary Phone
                  </Label>
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
                  <Label className="mb-1 block">
                    Alternative Phone
                  </Label>
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
              <Heading as="h3" size="h5">Address Information</Heading>

              {/* Primary Address */}
              <div className="space-y-4">
                <Heading as="h4" size="h6" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Primary Address *
                </Heading>
                <div>
                  <Label className="mb-1 block">
                    Street Address *
                  </Label>
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
                  <Label className="mb-1 block">
                    Address Line 2
                  </Label>
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
                    <Label className="mb-1 block">City</Label>
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
                    <Label className="mb-1 block">State</Label>
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
                    <Label className="mb-1 block">
                      ZIP Code *
                    </Label>
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
                    <Label htmlFor="owner-primary-country" className="mb-1 block">
                      Country
                    </Label>
                    <Select
                      id="owner-primary-country"
                      value={formData.primaryCountry}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, primaryCountry: e.target.value }))
                      }
                    >
                      {COUNTRIES.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              {/* Mailing Preference */}
              <div>
                <Label htmlFor="owner-mailing-preference" className="mb-1 block">
                  Mailing Preference
                </Label>
                <Select
                  id="owner-mailing-preference"
                  value={formData.mailingPreference}
                  onChange={(e) => handleMailingPreferenceChange(coerceMailingPreference(e.target.value))}
                >
                  {MAILING_PREFERENCES.map((pref) => (
                    <option key={pref} value={pref}>
                      {pref.charAt(0).toUpperCase() + pref.slice(1)} Address
                    </option>
                  ))}
                </Select>
              </div>

              {/* Alternate Address */}
              {showAlternateAddress && (
                <div className="space-y-4">
                  <Heading as="h4" size="h6" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Alternate Address
                  </Heading>
                  <div>
                    <Label className="mb-1 block">
                      Street Address
                    </Label>
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
                    <Label className="mb-1 block">
                      Address Line 2
                    </Label>
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
                      <Label className="mb-1 block">City</Label>
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
                      <Label className="mb-1 block">
                        State
                      </Label>
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
                      <Label className="mb-1 block">
                        ZIP Code
                      </Label>
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
                      <Label
                        htmlFor="owner-alt-country"
                        size="sm" className="mb-1 block"
                      >
                        Country
                      </Label>
                      <Select
                        id="owner-alt-country"
                        value={formData.altCountry}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, altCountry: e.target.value }))
                        }
                      >
                        <option value="">Select country</option>
                        {COUNTRIES.map((country) => (
                          <option key={country} value={country}>
                            {country}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tax Information Tab */}
          {activeTab === 'tax' && (
            <div className="space-y-6">
              <Heading as="h3" size="h5">Tax Information</Heading>

              {/* Tax Payer Information */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label className="mb-1 block">
                    Tax Payer ID
                  </Label>
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
                  <Label
                    htmlFor="owner-taxpayer-type"
                    size="sm" className="mb-1 block"
                  >
                    Tax Payer Type
                  </Label>
                  <Select
                    id="owner-taxpayer-type"
                    value={formData.taxPayerType}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        taxPayerType: coerceTaxPayerType(e.target.value),
                      }))
                    }
                  >
                    <option value="">Select type</option>
                    {TAX_PAYER_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Tax Payer Name */}
              <div>
                <Label className="mb-1 block">
                  Tax Payer Name
                </Label>
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
                <Heading as="h4" size="h6" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Tax Address
                </Heading>

                {/* Tax Address Checkbox */}
                <div className="flex items-center">
                  <Checkbox
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
                  <Label htmlFor="taxSameAsPrimary" size="sm" tone="muted">
                    Same as primary address
                  </Label>
                </div>

                {/* Tax Address Fields - Only show if not same as primary */}
                {!formData.taxSameAsPrimary && (
                  <>
                    <div>
                      <Label className="mb-1 block">
                        Street Address
                      </Label>
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
                      <Label className="mb-1 block">
                        Address Line 2
                      </Label>
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
                      <Label className="mb-1 block">
                        Address Line 3
                      </Label>
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
                        <Label className="mb-1 block">
                          City
                        </Label>
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
                        <Label className="mb-1 block">
                          State
                        </Label>
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
                        <Label className="mb-1 block">
                          ZIP Code
                        </Label>
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
                        <Label
                          htmlFor="owner-tax-country"
                          size="sm" className="mb-1 block"
                        >
                          Country
                        </Label>
                        <Select
                          id="owner-tax-country"
                          value={formData.taxCountry}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, taxCountry: e.target.value }))
                          }
                        >
                          <option value="">Select country</option>
                          {COUNTRIES.map((country) => (
                            <option key={country} value={country}>
                              {country}
                            </option>
                          ))}
                        </Select>
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
              <Heading as="h3" size="h5">Banking Details</Heading>

              {/* ETF Account Type */}
              <div>
                <Label className="mb-3 block">
                  ETF Account Type
                </Label>
                <div className="flex items-center space-x-6">
                  <Label as="label" className="flex items-center">
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
                    <Body as="span" size="sm" tone="muted">
                      Checking
                    </Body>
                  </Label>
                  <Label as="label" className="flex items-center">
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
                    <Body as="span" size="sm" tone="muted">
                      Saving
                    </Body>
                  </Label>
                </div>
              </div>

              {/* ETF Account Details */}
              {(formData.etfCheckingAccount || formData.etfSavingAccount) && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label className="mb-1 block">
                      Account Number
                    </Label>
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
                    <Label className="mb-1 block">
                      Routing Number
                    </Label>
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
