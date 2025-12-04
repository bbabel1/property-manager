'use client';

import { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  Camera,
  CheckCircle,
  XCircle,
  Home,
  Users,
  DollarSign,
  Banknote,
} from 'lucide-react';
import EditLink from '@/components/ui/EditLink';
import { Button } from '@/components/ui/button';
import type { BankAccountSummary } from '@/components/forms/types';
import EditPropertyModal from '@/components/EditPropertyModal';
import BankingDetailsModal from '@/components/BankingDetailsModal';
import PropertyNotes from '@/components/property/PropertyNotes';
import { type PropertyWithDetails } from '@/lib/property-service';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';

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
  const accentPanelClass = `${panelBaseClass} border-[0.75px] border-[var(--color-surface-primary-soft-border)] bg-[var(--color-surface-primary-soft)] shadow-[0_3px_8px_rgba(22,74,172,0.06)]`;
  const panelHeaderClass = 'border-b border-[var(--color-border-subtle)] bg-card px-6 py-4';
  const accentPanelHeaderClass =
    'border-b border-[0.75px] border-[var(--color-surface-primary-soft-border)] bg-[var(--color-surface-primary-soft-highlight)] px-6 py-4';

  const handleEditSuccess = () => {
    console.log('Property updated successfully');
    // Call the callback to refresh the property data
    if (onPropertyUpdate) {
      onPropertyUpdate();
    }
  };

  const handleBankingEditSuccess = () => {
    console.log('Banking details updated successfully');
    // Call the callback to refresh the property data
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
    if (!property.operating_bank_account_id) return null;
    return bankAccounts.find((account) => account.id === property.operating_bank_account_id);
  };

  const getDepositTrustBankAccount = () => {
    if (!property.deposit_trust_account_id) return null;
    return bankAccounts.find((account) => account.id === property.deposit_trust_account_id);
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
                <h2 className="text-foreground text-lg font-semibold">Property Details</h2>
                <EditLink onClick={() => setShowEditModal(true)} />
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
                {/* Column 1: Property Image */}
                <div className="space-y-4 md:col-span-2">
                  <div className="relative">
                    <div className="flex h-64 w-full items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[var(--color-gray-100)] to-[var(--color-gray-200)]">
                      <div className="text-center">
                        <div className="bg-card mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full">
                          <Home className="h-10 w-10 text-[var(--color-brand-500)]" />
                        </div>
                        <p className="text-muted-foreground text-sm">Property Image</p>
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
                    <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                      ADDRESS
                    </p>
                    <p className="text-foreground mb-3 text-lg">
                      {property.address_line1}
                      <br />
                      {property.city}, {property.state} {property.postal_code}
                    </p>
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
                    <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                      PROPERTY MANAGER
                    </p>
                    <p className="text-foreground">No manager assigned</p>
                  </div>

                  {/* Property Type */}
                  <div>
                    <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                      PROPERTY TYPE
                    </p>
                    <p className="text-foreground font-semibold">
                      {(property as any).property_type || 'None'}
                    </p>
                  </div>

                  {/* Status */}
                  <div>
                    <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                      STATUS
                    </p>
                    <p
                      className={`font-semibold ${property.status === 'Active' ? 'text-[var(--color-action-500)]' : 'text-[var(--color-danger-500)]'}`}
                    >
                      {property.status || 'Unknown'}
                    </p>
                  </div>

                  {/* Rental Owners */}
                  <div>
                    <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                      RENTAL OWNERS
                    </p>
                    {property.owners && property.owners.length > 0 ? (
                      <div className="space-y-2">
                        {property.owners.map((owner, index) => (
                          <div
                            key={owner.id}
                            className="border-l-2 border-[var(--color-brand-500)] pl-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-foreground font-medium">
                                {owner.is_company
                                  ? owner.company_name
                                  : `${owner.first_name} ${owner.last_name}`}
                                {owner.primary && (
                                  <span className="ml-2 inline-flex items-center rounded-full bg-[var(--color-action-50)] px-2 py-0.5 text-xs font-medium text-[var(--color-action-600)]">
                                    Primary
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="text-muted-foreground mt-1 text-sm">
                              <span className="mr-4">
                                Ownership: {owner.ownership_percentage || 0}%
                              </span>
                              <span>Disbursement: {owner.disbursement_percentage || 0}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No ownership information available</p>
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
                <h2 className="text-foreground text-lg font-semibold">Location</h2>
                <EditLink />
              </div>
            </div>
            <div className="p-6">
              <div className="text-muted-foreground py-8 text-center">
                <MapPin className="text-muted-foreground/50 mx-auto mb-3 h-12 w-12" />
                <p>Location information will appear here</p>
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
                <span className="text-foreground">Cash balance:</span>
                <span className="text-foreground font-semibold">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                    fin?.cash_balance ?? 0,
                  )}
                </span>
              </div>
              <div className="text-muted-foreground flex items-center justify-between">
                <span className="pl-4">- Security deposits and early payments:</span>
                <span>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                    fin?.security_deposits ?? 0,
                  )}
                </span>
              </div>
              <div className="text-muted-foreground flex items-center justify-between">
                <span className="pl-4">- Property reserve:</span>
                <span>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                    fin?.reserve ?? (property.reserve || 0),
                  )}
                </span>
              </div>
              <div className="border-border border-t pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-foreground font-semibold">Available:</span>
                  <span className="text-foreground text-xl font-bold">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                      fin?.available_balance ?? 0,
                    )}
                  </span>
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
                <h2 className="text-foreground text-lg font-semibold">Banking details</h2>
                <EditLink onClick={() => setShowBankingModal(true)} />
              </div>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                  OPERATING ACCOUNT
                </p>
                <div className="flex items-center">
                  <div className="bg-muted mr-3 flex h-8 w-8 items-center justify-center rounded-full">
                    <Banknote className="text-muted-foreground h-4 w-4" />
                  </div>
                  {isLoadingBankAccounts ? (
                    <span className="text-muted-foreground">Loading...</span>
                  ) : getOperatingBankAccount() ? (
                    <div>
                      <div className="text-foreground font-medium">
                        {getOperatingBankAccount()?.name}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {getOperatingBankAccount()?.account_number
                          ? `****${getOperatingBankAccount()?.account_number?.slice(-4) || ''}`
                          : 'No account number'}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Not configured</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                  DEPOSIT TRUST ACCOUNT
                </p>
                <div className="flex items-center">
                  <div className="bg-muted mr-3 flex h-8 w-8 items-center justify-center rounded-full">
                    <Banknote className="text-muted-foreground h-4 w-4" />
                  </div>
                  {isLoadingBankAccounts ? (
                    <span className="text-muted-foreground">Loading...</span>
                  ) : getDepositTrustBankAccount() ? (
                    <div>
                      <div className="text-foreground font-medium">
                        {getDepositTrustBankAccount()?.name}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {getDepositTrustBankAccount()?.account_number
                          ? `****${getDepositTrustBankAccount()?.account_number?.slice(-4) || ''}`
                          : 'No account number'}
                      </div>
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
