'use client';

import { useState, useEffect } from 'react';
import { MapPin, Camera, Home, Banknote } from 'lucide-react';
import EditLink from '@/components/ui/EditLink';
import { Button } from '@/components/ui/button';
import type { BankAccountSummary } from '@/components/forms/types';
import EditPropertyModal from '@/components/EditPropertyModal';
import BankingDetailsModal from '@/components/BankingDetailsModal';
import PropertyNotes from '@/components/property/PropertyNotes';
import { type PropertyWithDetails } from '@/lib/property-service';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';
import { Body, Heading, Label } from '@/ui/typography';

interface PropertySummaryProps {
  property: PropertyWithDetails;
  fin?: {
    cash_balance?: number;
    security_deposits?: number;
    reserve?: number;
    available_balance?: number;
    as_of?: string;
  };
  onPropertyUpdate?: () => void;
}

export function PropertySummary({ property, fin, onPropertyUpdate }: PropertySummaryProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBankingModal, setShowBankingModal] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccountSummary[]>([]);
  const [isLoadingBankAccounts, setIsLoadingBankAccounts] = useState(false);
  const panelBaseClass = 'rounded-lg shadow-none';
  const panelClass = `${panelBaseClass} bg-card border-0`;
  const accentPanelClass = `${panelBaseClass} border-[0.75px] border-surface-primary-soft-border bg-surface-primary-soft shadow-[0_3px_8px_rgba(22,74,172,0.06)]`;
  const panelHeaderClass = 'border-b border-border-subtle bg-card px-6 py-4';
  const accentPanelHeaderClass =
    'border-b border-[0.75px] border-surface-primary-soft-border bg-surface-primary-soft-highlight px-6 py-4';

  const handleEditSuccess = () => {
    if (onPropertyUpdate) {
      onPropertyUpdate();
    }
  };

  const handleBankingEditSuccess = () => {
    if (onPropertyUpdate) {
      onPropertyUpdate();
    }
  };

  // Fetch bank accounts when component mounts
  useEffect(() => {
    const fetchBankAccounts = async () => {
      try {
        setIsLoadingBankAccounts(true);
        const response = await fetchWithSupabaseAuth('/api/bank-accounts');

        if (!response.ok) {
          throw new Error('Failed to fetch bank accounts');
        }

        const bankAccountsData = (await response.json()) as BankAccountSummary[];
        setBankAccounts(bankAccountsData);
      } catch (error) {
        console.error('Error fetching bank accounts:', error);
      } finally {
        setIsLoadingBankAccounts(false);
      }
    };

    fetchBankAccounts();
  }, []);

  // Helper functions to get bank account information
  const getOperatingBankAccount = () => {
    const operatingGlId = property.operating_bank_gl_account_id;
    if (!operatingGlId) return null;
    return bankAccounts.find((account) => account.id === operatingGlId);
  };

  const getDepositTrustBankAccount = () => {
    const depositGlId = property.deposit_trust_gl_account_id;
    if (!depositGlId) return null;
    return bankAccounts.find((account) => account.id === depositGlId);
  };

  return (
    <div className="space-y-6">
      {/* Main Content - Two Columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Property Details */}
          <div className={panelClass}>
            <div className={panelHeaderClass}>
              <div className="flex items-center gap-2">
                <Heading as="h2" size="h3">
                  Property Details
                </Heading>
                <EditLink onClick={() => setShowEditModal(true)} />
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
                {/* Column 1: Property Image */}
                <div className="space-y-4 md:col-span-2">
                  <div className="relative">
                    <div className="flex h-64 w-full items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-muted to-border">
                      <div className="text-center">
                        <div className="bg-card mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full">
                          <Home className="h-10 w-10 text-brand-500" />
                        </div>
                        <Body size="sm" tone="muted">
                          Property Image
                        </Body>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-card border-border text-primary hover:bg-muted absolute bottom-4 left-4"
                    >
                      <Camera className="text-primary mr-1 h-4 w-4" />
                      Replace photo
                    </Button>
                  </div>
                </div>

                {/* Column 2: Property Details */}
                <div className="space-y-6 md:col-span-3">
                  {/* Address */}
                  <div>
                    <Label tone="muted" size="xs" className="mb-2 block tracking-wide uppercase">
                      ADDRESS
                    </Label>
                    <Heading as="p" size="h4" className="mb-3">
                      {property.address_line1}
                      <br />
                      {property.city}, {property.state} {property.postal_code}
                    </Heading>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:text-primary h-auto p-0"
                    >
                      <MapPin className="mr-1 h-4 w-4" />
                      Map it
                    </Button>
                  </div>

                  {/* Property Manager */}
                  <div>
                    <Label tone="muted" size="xs" className="mb-2 block tracking-wide uppercase">
                      PROPERTY MANAGER
                    </Label>
                    <Body>No manager assigned</Body>
                  </div>

                  {/* Property Type */}
                  <div>
                    <Label tone="muted" size="xs" className="mb-2 block tracking-wide uppercase">
                      PROPERTY TYPE
                    </Label>
                    <Heading as="p" size="h5">
                      {property.property_type || 'None'}
                    </Heading>
                  </div>

                  {/* Status */}
                  <div>
                    <Label tone="muted" size="xs" className="mb-2 block tracking-wide uppercase">
                      STATUS
                    </Label>
                    <Heading
                      as="p"
                      size="h5"
                      className={property.status === 'Active' ? 'text-primary-500' : 'text-danger-500'}
                    >
                      {property.status || 'Unknown'}
                    </Heading>
                  </div>

                  {/* Rental Owners */}
                  <div>
                    <Label tone="muted" size="xs" className="mb-2 block tracking-wide uppercase">
                      RENTAL OWNERS
                    </Label>
                    {property.owners && property.owners.length > 0 ? (
                      <div className="space-y-2">
                        {property.owners.map((owner) => (
                          <div
                            key={owner.id}
                            className="border-l-2 border-brand-500 pl-3"
                          >
                            <div className="flex items-center justify-between">
                              <Body as="span" className="font-medium">
                                {owner.is_company
                                  ? owner.company_name
                                  : `${owner.first_name} ${owner.last_name}`}
                                {owner.primary && (
                                  <span className="ml-2 inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-600">
                                    Primary
                                  </span>
                                )}
                              </Body>
                            </div>
                            <Body tone="muted" size="sm" className="mt-1">
                              <span className="mr-4">
                                Ownership: {owner.ownership_percentage || 0}%
                              </span>
                              <span>Disbursement: {owner.disbursement_percentage || 0}%</span>
                            </Body>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Body tone="muted">No ownership information available</Body>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Location Card */}
          <div className={panelClass}>
            <div className={panelHeaderClass}>
              <div className="flex items-center gap-2">
                <Heading as="h2" size="h3">
                  Location
                </Heading>
                <EditLink />
              </div>
            </div>
            <div className="p-6">
              <div className="py-8 text-center">
                <MapPin className="text-muted-foreground/50 mx-auto mb-3 h-12 w-12" />
                <Body tone="muted">Location information will appear here</Body>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Financial Summary */}
          <div className={`${accentPanelClass} p-6`}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Body as="span">Cash balance:</Body>
                <Heading as="span" size="h5">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                    fin?.cash_balance ?? 0,
                  )}
                </Heading>
              </div>
              <div className="flex items-center justify-between">
                <Body tone="muted" className="pl-4">
                  - Security deposits and early payments:
                </Body>
                <Body as="span" tone="muted">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                    Math.abs(fin?.security_deposits ?? 0),
                  )}
                </Body>
              </div>
              <div className="flex items-center justify-between">
                <Body tone="muted" className="pl-4">
                  - Property reserve:
                </Body>
                <Body as="span" tone="muted">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                    fin?.reserve ?? (property.reserve || 0),
                  )}
                </Body>
              </div>
              <div className="border-border border-t pt-3">
                <div className="flex items-center justify-between">
                  <Heading as="span" size="h5">
                    Available:
                  </Heading>
                  <Heading as="span" size="h3">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                      fin?.available_balance ?? 0,
                    )}
                  </Heading>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary hover:text-primary h-auto p-0"
              >
                View income statement
              </Button>
            </div>
          </div>

          {/* Banking Details */}
          <div className={accentPanelClass}>
            <div className={accentPanelHeaderClass}>
              <div className="flex items-center gap-2">
                <Heading as="h2" size="h3">
                  Banking details
                </Heading>
                <EditLink onClick={() => setShowBankingModal(true)} />
              </div>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <Label tone="muted" size="xs" className="mb-2 block tracking-wide uppercase">
                  OPERATING ACCOUNT
                </Label>
                <div className="flex items-center">
                  <div className="bg-muted mr-3 flex h-8 w-8 items-center justify-center rounded-full">
                    <Banknote className="text-muted-foreground h-4 w-4" />
                  </div>
                  {isLoadingBankAccounts ? (
                    <Body tone="muted">Loading...</Body>
                  ) : getOperatingBankAccount() ? (
                    <div>
                      <Body as="div" className="font-medium">
                        {getOperatingBankAccount()?.name}
                      </Body>
                      <Body tone="muted" size="sm">
                        {getOperatingBankAccount()?.account_number
                          ? `****${getOperatingBankAccount()?.account_number?.slice(-4) || ''}`
                          : 'No account number'}
                      </Body>
                    </div>
                  ) : (
                    <Body tone="muted">Not configured</Body>
                  )}
                </div>
              </div>
              <div>
                <Label tone="muted" size="xs" className="mb-2 block tracking-wide uppercase">
                  DEPOSIT TRUST ACCOUNT
                </Label>
                <div className="flex items-center">
                  <div className="bg-muted mr-3 flex h-8 w-8 items-center justify-center rounded-full">
                    <Banknote className="text-muted-foreground h-4 w-4" />
                  </div>
                  {isLoadingBankAccounts ? (
                    <Body tone="muted">Loading...</Body>
                  ) : getDepositTrustBankAccount() ? (
                    <div>
                      <Body as="div" className="font-medium">
                        {getDepositTrustBankAccount()?.name}
                      </Body>
                      <Body tone="muted" size="sm">
                        {getDepositTrustBankAccount()?.account_number
                          ? `****${getDepositTrustBankAccount()?.account_number?.slice(-4) || ''}`
                          : 'No account number'}
                      </Body>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:text-primary h-auto p-0"
                    >
                      Setup
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Notes */}
          <PropertyNotes propertyId={property.id} />
        </div>
      </div>

      {/* Edit Property Modal */}
      <EditPropertyModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={handleEditSuccess}
        property={property}
      />

      {/* Banking Details Modal */}
      <BankingDetailsModal
        isOpen={showBankingModal}
        onClose={() => setShowBankingModal(false)}
        onSuccess={handleBankingEditSuccess}
        property={property}
      />
    </div>
  );
}
