'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Select } from '@/ui/select';
import { Body, Heading, Label } from '@/ui/typography';

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

type ContactValues = {
  first_name?: string | null;
  last_name?: string | null;
  is_company?: boolean | null;
  company_name?: string | null;
  primary_email?: string | null;
  alt_email?: string | null;
  primary_phone?: string | null;
  alt_phone?: string | null;
  date_of_birth?: string | null;
  primary_address_line_1?: string | null;
  primary_address_line_2?: string | null;
  primary_city?: string | null;
  primary_state?: string | null;
  primary_postal_code?: string | null;
  primary_country?: string | null;
};

export default function EditTenantContactModal({
  open,
  onOpenChange,
  contactId,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contactId: number;
  initial: ContactValues;
  onSaved?: (updated: ContactValues) => void;
}) {
  const [values, setValues] = useState<ContactValues>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAltPhone, setShowAltPhone] = useState(false);
  const [showCompanyName, setShowCompanyName] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(initial);
      setShowAltPhone(Boolean(initial.alt_phone));
      setShowCompanyName(Boolean(initial.is_company));
    }
  }, [open, initial]);

  const supa = getSupabaseBrowserClient();

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const payload: Partial<ContactValues> & { updated_at: string } = {
        first_name: values.first_name ?? null,
        last_name: values.last_name ?? null,
        is_company: Boolean(values.is_company ?? false),
        company_name: values.company_name ?? null,
        primary_email: values.primary_email ?? null,
        alt_email: values.alt_email ?? null,
        primary_phone: values.primary_phone ?? null,
        alt_phone: values.alt_phone ?? null,
        date_of_birth: values.date_of_birth ?? null,
        primary_address_line_1: values.primary_address_line_1 ?? null,
        primary_address_line_2: values.primary_address_line_2 ?? null,
        primary_city: values.primary_city ?? null,
        primary_state: values.primary_state ?? null,
        primary_postal_code: values.primary_postal_code ?? null,
        primary_country: values.primary_country ?? 'United States',
        updated_at: new Date().toISOString(),
      };
      const { error } = await supa.from('contacts').update(payload).eq('id', contactId);
      if (error) throw new Error(error.message);
      const { updated_at: _ignored, ...nextValues } = payload;
      setValues(nextValues);
      setShowAltPhone(Boolean(nextValues.alt_phone));
      setShowCompanyName(Boolean(nextValues.is_company));
      onOpenChange(false);
      onSaved?.(nextValues);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-l-primary w-[680px] max-w-[680px] border-l-4">
        <DialogHeader>
          <DialogTitle>
            <Heading as="h2" size="h4">
              Edit contact information
            </Heading>
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left Column - Personal Information */}
          <div className="space-y-4">
            <Heading as="h3" size="h5" className="text-foreground border-b pb-2 font-medium">
              Personal Information
            </Heading>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label as="div" size="xs" className="mb-1">
                  First name
                </Label>
                <Input
                  value={values.first_name ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, first_name: e.target.value }))}
                />
              </div>
              <div>
                <Label as="div" size="xs" className="mb-1">
                  Last name
                </Label>
                <Input
                  value={values.last_name ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, last_name: e.target.value }))}
                />
              </div>
            </div>

            <Label as="label" htmlFor="edit-tenant-is-company" className="flex items-center gap-2">
              <Checkbox
                id="edit-tenant-is-company"
                checked={Boolean(values.is_company)}
                onCheckedChange={(checked) => {
                  const isCompany = Boolean(checked);
                  setValues((val) => ({ ...val, is_company: isCompany }));
                  setShowCompanyName(isCompany);
                }}
              />
              Is company
            </Label>

            {showCompanyName && (
              <div>
                <Label as="div" size="xs" className="mb-1">
                  Company name
                </Label>
                <Input
                  value={values.company_name ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, company_name: e.target.value }))}
                />
              </div>
            )}

            <div>
              <Label as="div" size="xs" className="mb-1">
                Date of Birth
              </Label>
              <DatePicker
                value={values.date_of_birth ?? null}
                onChange={(date) =>
                  setValues((v) => ({
                    ...v,
                    date_of_birth: date ?? undefined,
                  }))
                }
                placeholder="Select date of birth"
              />
            </div>

            <div className="space-y-3">
              <Heading as="h4" size="h6" className="text-foreground font-medium">
                Email Addresses
              </Heading>
              <div>
                <Label as="div" size="xs" className="mb-1">
                  Primary Email
                </Label>
                <Input
                  type="email"
                  value={values.primary_email ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, primary_email: e.target.value }))}
                />
              </div>
              <div>
                <Label as="div" size="xs" className="mb-1">
                  Alternative Email
                </Label>
                <Input
                  type="email"
                  value={values.alt_email ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, alt_email: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Heading as="h4" size="h6" className="text-foreground font-medium">
                Phone Numbers
              </Heading>
              <div>
                <Label as="div" size="xs" className="mb-1">
                  Primary Phone
                </Label>
                <Input
                  value={values.primary_phone ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, primary_phone: e.target.value }))}
                />
              </div>
              <div>
                {showAltPhone ? (
                  <div>
                    <Label as="div" size="xs" className="mb-1">
                      Alternative Phone
                    </Label>
                    <Input
                      value={values.alt_phone ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, alt_phone: e.target.value }))}
                    />
                  </div>
                ) : (
                  <div>
                    <Label as="div" size="xs" className="mb-1">
                      Alternative Phone
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      className="text-muted-foreground w-full justify-start"
                      onClick={() => setShowAltPhone(true)}
                    >
                      + Add alternate phone
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Address Information */}
          <div className="space-y-4">
            <Heading as="h3" size="h5" className="text-foreground border-b pb-2 font-medium">
              Address Information
            </Heading>

            <div className="space-y-3">
              <Heading as="h4" size="h6" className="text-foreground font-medium">
                Street Address
              </Heading>
              <div>
                <Label as="div" size="xs" className="mb-1">
                  Address line 1
                </Label>
                <Input
                  value={values.primary_address_line_1 ?? ''}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, primary_address_line_1: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label as="div" size="xs" className="mb-1">
                  Address line 2
                </Label>
                <Input
                  value={values.primary_address_line_2 ?? ''}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, primary_address_line_2: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-3">
              <Heading as="h4" size="h6" className="text-foreground font-medium">
                City, State & ZIP
              </Heading>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label as="div" size="xs" className="mb-1">
                    City
                  </Label>
                  <Input
                    value={values.primary_city ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, primary_city: e.target.value }))}
                  />
                </div>
                <div>
                  <Label as="div" size="xs" className="mb-1">
                    State
                  </Label>
                  <Input
                    value={values.primary_state ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, primary_state: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label as="div" size="xs" className="mb-1">
                    Postal code
                  </Label>
                  <Input
                    value={values.primary_postal_code ?? ''}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, primary_postal_code: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label as="div" size="xs" className="mb-1">
                    Country
                  </Label>
                  <Select
                    value={values.primary_country ?? 'United States'}
                    onChange={(e) => setValues((v) => ({ ...v, primary_country: e.target.value }))}
                    aria-label="Primary address country"
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
          </div>
        </div>
        {error ? <div className="text-destructive text-sm">{error}</div> : null}
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
