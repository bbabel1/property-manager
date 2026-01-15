'use client';

import React, { useEffect, useState } from 'react';
import { Save, Building2 } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import type { BankGlAccountSummary, CreateBankAccountFormValues } from '@/components/forms/types';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';
import type { Database } from '@/types/database';
import { Select } from '@/ui/select';
import { Body, Heading, Label } from '@/ui/typography';

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

const COUNTRIES: Database['public']['Enums']['countries'][] = [
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
  bank_information_lines: ['', '', '', '', ''],
  company_information_lines: ['', '', '', '', ''],
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
  const [isLoadingOrg, setIsLoadingOrg] = useState(false);
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

  const handleLineChange = (
    section: 'bank_information_lines' | 'company_information_lines',
    index: number,
    value: string,
  ) => {
    setFormData((prev) => {
      const nextLines = [...prev[section]];
      nextLines[index] = value;
      return { ...prev, [section]: nextLines };
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const fetchOrgDefaults = async () => {
      setIsLoadingOrg(true);
      try {
        const response = await fetchWithSupabaseAuth('/api/organization');
        if (!response.ok) return;
        const data = await response.json().catch(() => null);
        const org = data?.organization;
        const contact = org?.Contact;
        const addr = contact?.Address;
        const cityStatePostal = [addr?.City, addr?.State, addr?.PostalCode]
          .filter((part: string | null | undefined) => typeof part === 'string' && part.trim().length)
          .join(', ');
        const defaults = [
          (org?.CompanyName as string | null) ?? '',
          (addr?.AddressLine1 as string | null) ?? '',
          (addr?.AddressLine2 as string | null) ?? (addr?.AddressLine3 as string | null) ?? '',
          cityStatePostal,
          '',
        ];

        if (cancelled) return;
        setFormData((prev) => {
          const current = prev.company_information_lines || [];
          const hasUserInput = current.some((line) => line && line.trim().length > 0);
          if (hasUserInput) return prev;
          const merged = Array.from({ length: 5 }).map((_, idx) => current[idx] || defaults[idx] || '');
          return { ...prev, company_information_lines: merged };
        });
      } catch {
        /* ignore org defaults load failures */
      } finally {
        if (!cancelled) setIsLoadingOrg(false);
      }
    };

    fetchOrgDefaults();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

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
          <DialogTitle>
            <Heading as="h2" size="h4" className="text-foreground">
              Create New Bank Account
            </Heading>
          </DialogTitle>
        </DialogHeader>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 p-4">
            <Body as="p" size="sm" className="text-red-600">
              {error}
            </Body>
          </div>
        )}

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {/* Account Information */}
          <div className="space-y-4">
            <Heading as="h3" size="h5" className="flex items-center gap-2 text-gray-900">
              <Building2 className="h-4 w-4" />
              Account Information
            </Heading>

            <div className="space-y-4">
              <div>
                <Label htmlFor="bank-account-name" className="mb-1 block text-gray-700">
                  Account Name *
                </Label>
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
                <Label htmlFor="bank-account-description" className="mb-1 block text-gray-700">
                  Description
                </Label>
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
                <Label htmlFor="bank-account-type" className="mb-1 block text-gray-700">
                  Account Type *
                </Label>
                <Select
                  id="bank-account-type"
                  value={formData.bank_account_type}
                  onChange={(e) => handleInputChange('bank_account_type', e.target.value)}
                  required
                >
                  <option value="">
                    Select account type...
                  </option>
                  {BANK_ACCOUNT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bank-account-number" className="mb-1 block text-gray-700">
                    Account Number *
                  </Label>
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
                  <Label htmlFor="bank-routing-number" className="mb-1 block text-gray-700">
                    Routing Number *
                  </Label>
                  <input
                    id="bank-routing-number"
                    type="text"
                    value={formData.routing_number}
                    onChange={(e) => handleInputChange('routing_number', e.target.value)}
                    inputMode="numeric"
                    pattern="^[0-9]{9}$"
                    maxLength={9}
                    minLength={9}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="e.g., 021000021"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="bank-account-country" className="mb-1 block text-gray-700">
                  Country *
                </Label>
                <Select
                  id="bank-account-country"
                  value={formData.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  required
                >
                  {COUNTRIES.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label as="p" size="xs" tone="muted" className="uppercase tracking-wide">
                  Bank Information
                </Label>
                {formData.bank_information_lines.map((line, idx) => (
                  <input
                    key={`bank-info-${idx}`}
                    type="text"
                    value={line}
                    onChange={(e) => handleLineChange('bank_information_lines', idx, e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label as="p" size="xs" tone="muted" className="uppercase tracking-wide">
                    Company Information
                  </Label>
                  {isLoadingOrg && (
                    <Body as="span" size="sm" tone="muted" className="text-[11px]">
                      Loading defaults…
                    </Body>
                  )}
                </div>
                {formData.company_information_lines.map((line, idx) => (
                  <input
                    key={`company-info-${idx}`}
                    type="text"
                    value={line}
                    onChange={(e) =>
                      handleLineChange('company_information_lines', idx, e.target.value)
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                ))}
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
