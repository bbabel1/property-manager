'use client';

import React, { useState } from 'react';
import { Save, Building2 } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import type { BankGlAccountSummary, CreateBankAccountFormValues } from '@/components/forms/types';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';

type CreateBankAccountModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newAccount: BankGlAccountSummary) => void;
};

const BANK_ACCOUNT_TYPES = [
  'Checking',
  'Savings',
  'Money Market',
  'Certificate of Deposit',
  'Business Checking',
  'Business Savings',
];

const COUNTRIES = [
  'United States',
  'Canada',
  'United Kingdom',
  'Australia',
  'Germany',
  'France',
  'Japan',
  'Mexico',
  'Brazil',
  'India',
];

const INITIAL_FORM: CreateBankAccountFormValues = {
  name: '',
  description: '',
  bank_account_type: '',
  account_number: '',
  routing_number: '',
  country: 'United States',
};

export default function CreateBankAccountModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateBankAccountModalProps) {
  const [formData, setFormData] = useState<CreateBankAccountFormValues>(() => ({
    ...INITIAL_FORM,
  }));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchWithSupabaseAuth('/api/gl-accounts/bank-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create bank account';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const newAccount = (await response.json()) as BankGlAccountSummary;

      onSuccess(newAccount);
      onClose();
    } catch (caughtError: unknown) {
      console.error('Error creating bank account:', caughtError);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to create bank account. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = <K extends keyof CreateBankAccountFormValues>(
    field: K,
    value: CreateBankAccountFormValues[K],
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleClose = () => {
    setFormData(() => ({ ...INITIAL_FORM }));
    setError(null);
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="bg-card border-border/80 max-h-[90vh] w-[680px] max-w-[680px] overflow-y-auto rounded-none border p-0 shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <DialogHeader className="border-border border-b p-6">
          <DialogTitle className="text-foreground text-xl font-semibold">
            Create New Bank Account
          </DialogTitle>
        </DialogHeader>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {/* Account Information */}
          <div className="space-y-4">
            <h4 className="flex items-center gap-2 font-medium text-gray-900">
              <Building2 className="h-4 w-4" />
              Account Information
            </h4>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="bank-account-name"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Account Name *
                </label>
                <input
                  id="bank-account-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g., Chase Business Account"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="bank-account-description"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Description
                </label>
                <textarea
                  id="bank-account-description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Optional description of the account"
                  rows={3}
                />
              </div>

              <div>
                <label
                  htmlFor="bank-account-type"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Account Type *
                </label>
                <select
                  id="bank-account-type"
                  value={formData.bank_account_type}
                  onChange={(e) => handleInputChange('bank_account_type', e.target.value)}
                  className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                >
                  <option value="" className="bg-white text-gray-500">
                    Select account type...
                  </option>
                  {BANK_ACCOUNT_TYPES.map((type) => (
                    <option key={type} value={type} className="bg-white text-gray-900">
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="bank-account-number"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Account Number *
                  </label>
                  <input
                    id="bank-account-number"
                    type="text"
                    value={formData.account_number}
                    onChange={(e) => handleInputChange('account_number', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="e.g., 1234567890"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="bank-routing-number"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Routing Number *
                  </label>
                  <input
                    id="bank-routing-number"
                    type="text"
                    value={formData.routing_number}
                    onChange={(e) => handleInputChange('routing_number', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="e.g., 021000021"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="bank-account-country"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Country *
                </label>
                <select
                  id="bank-account-country"
                  value={formData.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                >
                  {COUNTRIES.map((country) => (
                    <option key={country} value={country} className="bg-white text-gray-900">
                      {country}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
            <Button variant="outline" type="button" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>

            <Button type="submit" disabled={isLoading} className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              {isLoading ? 'Creating...' : 'Create Account'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
