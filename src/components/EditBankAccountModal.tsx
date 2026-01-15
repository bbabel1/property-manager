'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Save } from 'lucide-react';

import type { BankAccountFormValues } from '@/components/forms/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogTitle, FullscreenDialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';
import type { Database } from '@/types/database';
import { Body, Heading, Label } from '@/ui/typography';

type BankAccountInitialData = {
  name: string | null;
  description: string | null;
  bank_account_type: string | null;
  bank_account_number: string | null;
  bank_routing_number: string | null;
  bank_country: Database['public']['Enums']['countries'] | null;
  bank_check_printing_info?: Record<string, unknown> | null;
};

type EditBankAccountModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accountId: string;
  initialData: BankAccountInitialData;
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

const emptyLines = () => Array.from({ length: 5 }).map(() => '');

const toFormAccountType = (value: string | null) => {
  if (!value) return '';
  const normalized = value.trim().toLowerCase().replace(/_/g, ' ');
  if (normalized.startsWith('business checking')) return 'Business Checking';
  if (normalized.startsWith('business savings')) return 'Business Savings';
  if (normalized.startsWith('money market')) return 'Money Market';
  if (normalized.startsWith('certificate of deposit')) return 'Certificate of Deposit';
  if (normalized === 'checking') return 'Checking';
  if (normalized === 'savings') return 'Savings';
  return value;
};

const extractLines = (info: unknown, prefix: 'BankInformationLine' | 'CompanyInformationLine') => {
  if (!info || typeof info !== 'object') return emptyLines();
  const source = info as Record<string, unknown>;
  return Array.from({ length: 5 }).map((_, idx) => {
    const raw = source[`${prefix}${idx + 1}`];
    return typeof raw === 'string' ? raw : '';
  });
};

const buildInitialForm = (initialData: BankAccountInitialData): BankAccountFormValues => ({
  name: initialData.name ?? '',
  description: initialData.description ?? '',
  bank_account_type: toFormAccountType(initialData.bank_account_type),
  account_number: initialData.bank_account_number ?? '',
  routing_number: initialData.bank_routing_number ?? '',
  country: initialData.bank_country ?? 'United States',
  bank_information_lines: extractLines(initialData.bank_check_printing_info, 'BankInformationLine'),
  company_information_lines: extractLines(initialData.bank_check_printing_info, 'CompanyInformationLine'),
});

export default function EditBankAccountModal({
  isOpen,
  onClose,
  onSuccess,
  accountId,
  initialData,
}: EditBankAccountModalProps) {
  const [formData, setFormData] = useState<BankAccountFormValues>(() => buildInitialForm(initialData));
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOrg, setIsLoadingOrg] = useState(false);
  const [orgDefaultsApplied, setOrgDefaultsApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useMemo(() => buildInitialForm(initialData), [initialData]);

  useEffect(() => {
    if (!isOpen) return;
    setFormData(resetForm);
    setError(null);
    setOrgDefaultsApplied(false);
  }, [isOpen, resetForm]);

  useEffect(() => {
    if (!isOpen || orgDefaultsApplied) return;
    const hasCompanyLines =
      formData.company_information_lines?.some((line) => line && line.trim().length > 0) ?? false;
    if (hasCompanyLines) {
      setOrgDefaultsApplied(true);
      return;
    }

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
          const merged = Array.from({ length: 5 }).map(
            (__, idx) => current[idx] || defaults[idx] || '',
          );
          return { ...prev, company_information_lines: merged };
        });
      } catch {
        // ignore defaults fetch failure
      } finally {
        if (!cancelled) {
          setOrgDefaultsApplied(true);
          setIsLoadingOrg(false);
        }
      }
    };

    fetchOrgDefaults();
    return () => {
      cancelled = true;
    };
  }, [formData.company_information_lines, isOpen, orgDefaultsApplied]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!formData.bank_account_type) {
      setError('Please select an account type.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetchWithSupabaseAuth(`/api/gl-accounts/bank-accounts/${accountId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to update bank account';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      onSuccess();
      onClose();
    } catch (caughtError: unknown) {
      console.error('Error updating bank account:', caughtError);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to update bank account. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = <K extends keyof BankAccountFormValues>(
    field: K,
    value: BankAccountFormValues[K],
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
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

  const handleClose = () => {
    setFormData(resetForm);
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
      <FullscreenDialogContent className="bg-card">
        <DialogHeader className="border-border sticky top-0 z-10 border-b bg-card p-6">
          <DialogTitle>
            <Heading as="h2" size="h4" className="text-foreground">
              Edit Bank Account
            </Heading>
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 p-4">
            <Body as="p" size="sm" className="text-red-600">
              {error}
            </Body>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-[1100px] space-y-6 p-6">
          <div className="space-y-4">
            <Heading as="h3" size="h5" className="flex items-center gap-2 text-foreground">
              <Building2 className="h-4 w-4" />
              Account Information
            </Heading>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-bank-account-name" className="text-foreground">
                  Account Name *
                </Label>
                <Input
                  id="edit-bank-account-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="e.g., Chase Business Account"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-bank-account-description" className="text-foreground">
                  Description
                </Label>
                <Textarea
                  id="edit-bank-account-description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Optional description of the account"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-bank-account-type" className="text-foreground">
                  Account Type *
                </Label>
                <Select
                  value={formData.bank_account_type || ''}
                  onValueChange={(value) => handleInputChange('bank_account_type', value)}
                >
                  <SelectTrigger id="edit-bank-account-type" className="h-10">
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BANK_ACCOUNT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-bank-account-number" className="text-foreground">
                    Account Number *
                  </Label>
                  <Input
                    id="edit-bank-account-number"
                    type="text"
                    value={formData.account_number}
                    onChange={(e) => handleInputChange('account_number', e.target.value)}
                    inputMode="numeric"
                    placeholder="e.g., 1234567890"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-bank-routing-number" className="text-foreground">
                    Routing Number *
                  </Label>
                  <Input
                    id="edit-bank-routing-number"
                    type="text"
                    value={formData.routing_number}
                    onChange={(e) => handleInputChange('routing_number', e.target.value)}
                    inputMode="numeric"
                    pattern="^[0-9]{9}$"
                    maxLength={9}
                    minLength={9}
                    placeholder="e.g., 021000021"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-bank-account-country" className="text-foreground">
                  Country *
                </Label>
                <Select
                  value={formData.country}
                  onValueChange={(value) => handleInputChange('country', value)}
                >
                  <SelectTrigger id="edit-bank-account-country" className="h-10">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label as="p" size="xs" tone="muted" className="uppercase tracking-wide">
                  Bank Information
                </Label>
                {formData.bank_information_lines.map((line, idx) => (
                  <Input
                    key={`edit-bank-info-${idx}`}
                    value={line}
                    onChange={(e) => handleLineChange('bank_information_lines', idx, e.target.value)}
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
                  <Input
                    key={`edit-company-info-${idx}`}
                    value={line}
                    onChange={(e) =>
                      handleLineChange('company_information_lines', idx, e.target.value)
                    }
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <Button variant="outline" type="button" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>

            <Button type="submit" disabled={isLoading} className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              {isLoading ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </form>
      </FullscreenDialogContent>
    </Dialog>
  );
}
