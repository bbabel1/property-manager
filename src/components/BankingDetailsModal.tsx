'use client';

import React, { useState, useEffect } from 'react';
import { Save, DollarSign } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { type PropertyWithDetails } from '@/lib/property-service';
import CreateBankAccountModal from './CreateBankAccountModal';
import { Dropdown } from './ui/Dropdown';
import type { BankGlAccountSummary, BankingDetailsFormValues } from '@/components/forms/types';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';

type BankingDetailsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  property: PropertyWithDetails;
};

export default function BankingDetailsModal({
  isOpen,
  onClose,
  onSuccess,
  property,
}: BankingDetailsModalProps) {
  const [formData, setFormData] = useState<BankingDetailsFormValues>({
    reserve: 0,
    operating_bank_gl_account_id: '',
    deposit_trust_gl_account_id: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankGlAccountSummary[]>([]);
  const [isLoadingBankAccounts, setIsLoadingBankAccounts] = useState(false);
  const [showCreateBankAccountModal, setShowCreateBankAccountModal] = useState(false);
  const [selectedAccountType, setSelectedAccountType] = useState<'operating' | 'trust' | null>(
    null,
  );

  // Fetch bank accounts when modal opens
  useEffect(() => {
    if (isOpen && bankAccounts.length === 0) {
      fetchBankAccounts();
    }
  }, [isOpen, bankAccounts.length]);

  // Initialize form data when property changes
  useEffect(() => {
    if (isOpen && property) {
      setFormData({
        reserve: property.reserve || 0,
        operating_bank_gl_account_id: (property as any).operating_bank_gl_account_id || '',
        deposit_trust_gl_account_id: (property as any).deposit_trust_gl_account_id || '',
      });
      setError(null);
    }
  }, [isOpen, property]);

  const fetchBankAccounts = async () => {
    try {
      setIsLoadingBankAccounts(true);
      const response = await fetchWithSupabaseAuth('/api/gl-accounts/bank-accounts');

      if (!response.ok) {
        throw new Error('Failed to fetch bank accounts');
      }

      const bankAccountsData = (await response.json()) as BankGlAccountSummary[];
      setBankAccounts(bankAccountsData);
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
      setError('Failed to fetch bank accounts');
    } finally {
      setIsLoadingBankAccounts(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      console.log('🔍 BankingDetailsModal: Submitting form data:', formData);

      const response = await fetchWithSupabaseAuth(`/api/properties/${property.id}/banking`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update banking details');
      }

      const result = await response.json();
      console.log('Banking details updated successfully:', result);

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating banking details:', error);
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to update banking details. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = <K extends keyof BankingDetailsFormValues>(
    field: K,
    value: BankingDetailsFormValues[K],
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleBankAccountChange = (
    field: 'operating_bank_gl_account_id' | 'deposit_trust_gl_account_id',
    value: string,
  ) => {
    if (value === 'create-new-account') {
      setSelectedAccountType(field === 'operating_bank_gl_account_id' ? 'operating' : 'trust');
      setShowCreateBankAccountModal(true);
    } else {
      handleInputChange(field, value);
    }
  };

  const handleCreateBankAccountSuccess = (newAccount: BankGlAccountSummary) => {
    // Add the new account to the list
    setBankAccounts((prev) => [...prev, newAccount]);

    // Auto-select the new account for the appropriate field
    if (selectedAccountType === 'operating') {
      handleInputChange('operating_bank_gl_account_id', newAccount.id);
    } else if (selectedAccountType === 'trust') {
      handleInputChange('deposit_trust_gl_account_id', newAccount.id);
    }

    setSelectedAccountType(null);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="border-border border-l-primary max-h-[90vh] w-[680px] max-w-[680px] overflow-y-auto rounded-none border border-l-2 bg-white p-0 shadow-lg sm:rounded-2xl">
        {/* Header */}
        <DialogHeader className="border-border border-b p-6">
          <DialogTitle className="text-foreground text-xl font-semibold">
            Edit Banking Details
          </DialogTitle>
        </DialogHeader>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Form Content */}
        <form
          id="banking-details-modal-form"
          onSubmit={handleSubmit}
          className="relative space-y-4 p-6"
        >
          <div className="bg-primary absolute top-0 bottom-0 left-0 w-0.5" />
          {/* Banking Information */}
          <div className="space-y-4">
            <h4 className="flex items-center gap-2 font-medium text-gray-900">
              <DollarSign className="h-4 w-4" />
              Banking Information
            </h4>

            <div className="space-y-4">
              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">
                  Property Reserve ($)
                </label>
                <div className="relative">
                  <span className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={formData.reserve}
                    onChange={(e) => handleInputChange('reserve', parseFloat(e.target.value) || 0)}
                    className="border-input focus-visible:ring-primary focus-visible:border-primary w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                    placeholder="e.g., 50000.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">
                  Operating Bank Account
                </label>
                <Dropdown
                  value={formData.operating_bank_gl_account_id}
                  onChange={(value) => handleBankAccountChange('operating_bank_gl_account_id', value)}
                  disabled={isLoadingBankAccounts}
                  options={[
                    ...bankAccounts.map((account) => ({
                      value: account.id,
                      label: `${account.name} - ${account.account_number ? `****${account.account_number.slice(-4)}` : 'No account number'}`,
                    })),
                    { value: 'create-new-account', label: '✓ Create New Bank Account' },
                  ]}
                  placeholder={isLoadingBankAccounts ? 'Loading accounts…' : 'Select a bank account...'}
                />
              </div>

              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">
                  Deposit Trust Account
                </label>
                <Dropdown
                  value={formData.deposit_trust_gl_account_id}
                  onChange={(value) => handleBankAccountChange('deposit_trust_gl_account_id', value)}
                  disabled={isLoadingBankAccounts}
                  options={[
                    ...bankAccounts.map((account) => ({
                      value: account.id,
                      label: `${account.name} - ${account.account_number ? `****${account.account_number.slice(-4)}` : 'No account number'}`,
                    })),
                    { value: 'create-new-account', label: '✓ Create New Bank Account' },
                  ]}
                  placeholder={isLoadingBankAccounts ? 'Loading accounts…' : 'Select a bank account...'}
                />
              </div>
            </div>
          </div>
        </form>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 pt-6 pb-6">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>

          <Button
            type="submit"
            form="banking-details-modal-form"
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
      {/* Create Bank Account Modal */}
      <CreateBankAccountModal
        isOpen={showCreateBankAccountModal}
        onClose={() => {
          setShowCreateBankAccountModal(false);
          setSelectedAccountType(null);
        }}
        onSuccess={handleCreateBankAccountSuccess}
      />
    </Dialog>
  );
}
