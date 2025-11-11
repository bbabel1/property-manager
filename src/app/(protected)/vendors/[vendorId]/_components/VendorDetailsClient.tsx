'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, Mail, Smartphone, type LucideIcon } from 'lucide-react';

import EditFormPanel from '@/components/form/EditFormPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
import { Textarea } from '@/components/ui/textarea';
import {
  NavTabs,
  NavTabsHeader,
  NavTabsList,
  NavTabsTrigger,
  NavTabsContent,
} from '@/components/ui/nav-tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/components/ui/utils';
import type { Database } from '@/types/database';

type ContactRow = Database['public']['Tables']['contacts']['Row'];
type VendorCategoryRow = Database['public']['Tables']['vendor_categories']['Row'];

type TaxPayerType = 'SSN' | 'EIN' | '';

const TAX_PAYER_TYPE_OPTIONS = [
  { value: 'SSN', label: 'SSN (Social Security Number)' },
  { value: 'EIN', label: 'EIN (Employer Identification Number)' },
] as const;

const TAXPAYER_TYPE_UNSPECIFIED_OPTION_VALUE = '__taxpayer_type_unspecified__';

type CategoryOption = {
  id: string;
  name: string;
};

type VendorDetails = {
  id: string;
  buildium_vendor_id: number | null;
  vendor_category: string | null;
  contact_id: number | null;
  is_active: boolean;
  account_number: string | null;
  expense_gl_account_id: number | null;
  website: string | null;
  notes: string | null;
  include_1099: boolean | null;
  tax_id: string | null;
  tax_payer_name1: string | null;
  tax_payer_name2: string | null;
  tax_payer_type: string | null;
  tax_address_line1: string | null;
  tax_address_line2: string | null;
  tax_address_line3: string | null;
  tax_address_city: string | null;
  tax_address_state: string | null;
  tax_address_postal_code: string | null;
  tax_address_country: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  insurance_expiration_date: string | null;
  contact: (ContactRow & { is_company?: boolean | null }) | null;
  category: Pick<VendorCategoryRow, 'id' | 'name'> | null;
};

type ExpenseAccountOption = {
  id: number;
  name: string;
  accountNumber: string | null;
};

export type RecentVendorWorkOrder = {
  id: string;
  subject: string;
  status: string | null;
  priority: string | null;
  scheduledDate: string | null;
  updatedAt: string | null;
  propertyId: string | null;
  propertyName: string | null;
};

type VendorsDetailsClientProps = {
  vendor: VendorDetails;
  categories: CategoryOption[];
  expenseAccounts: ExpenseAccountOption[];
  recentWorkOrders: RecentVendorWorkOrder[];
};

type EditFormState = {
  firstName: string;
  lastName: string;
  companyName: string;
  categoryId: string | null;
  accountNumber: string;
  expenseAccountId: string;
  website: string;
  notes: string;
  phone: string;
  workPhone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressState: string;
  addressPostalCode: string;
};

type TaxFormState = {
  taxId: string;
  taxpayerName1: string;
  taxpayerName2: string;
  taxpayerType: string;
  include1099: boolean;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

type InsuranceFormState = {
  provider: string;
  policyNumber: string;
  expirationDate: string;
};

function toDateInputValue(value: string | null): string {
  if (!value) return '';
  const isoCandidate = value.includes('T') ? value : `${value}T00:00:00`;
  const parsed = new Date(isoCandidate);
  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

function toInitialState(vendor: VendorDetails): EditFormState {
  return {
    firstName: vendor.contact?.first_name ?? '',
    lastName: vendor.contact?.last_name ?? '',
    companyName:
      vendor.contact?.company_name ??
      vendor.contact?.display_name ??
      [vendor.contact?.first_name, vendor.contact?.last_name].filter(Boolean).join(' ') ??
      '',
    categoryId: vendor.vendor_category,
    accountNumber: vendor.account_number ?? '',
    expenseAccountId:
      vendor.expense_gl_account_id != null ? String(vendor.expense_gl_account_id) : '',
    website: vendor.website ?? '',
    notes: vendor.notes ?? '',
    phone: vendor.contact?.primary_phone ?? '',
    workPhone: vendor.contact?.alt_phone ?? '',
    email: vendor.contact?.primary_email ?? vendor.contact?.alt_email ?? '',
    addressLine1: vendor.contact?.primary_address_line_1 ?? '',
    addressLine2: vendor.contact?.primary_address_line_2 ?? '',
    addressCity: vendor.contact?.primary_city ?? '',
    addressState: vendor.contact?.primary_state ?? '',
    addressPostalCode: vendor.contact?.primary_postal_code ?? '',
  };
}

function toInitialTaxState(vendor: VendorDetails): TaxFormState {
  return {
    taxId: vendor.tax_id ?? '',
    taxpayerName1: vendor.tax_payer_name1 ?? '',
    taxpayerName2: vendor.tax_payer_name2 ?? '',
    taxpayerType: vendor.tax_payer_type ?? '',
    include1099: Boolean(vendor.include_1099),
    addressLine1: vendor.tax_address_line1 ?? '',
    addressLine2: vendor.tax_address_line2 ?? '',
    addressLine3: vendor.tax_address_line3 ?? '',
    city: vendor.tax_address_city ?? '',
    state: vendor.tax_address_state ?? '',
    postalCode: vendor.tax_address_postal_code ?? '',
    country: vendor.tax_address_country ?? '',
  };
}

function toInitialInsuranceState(vendor: VendorDetails): InsuranceFormState {
  return {
    provider: vendor.insurance_provider ?? '',
    policyNumber: vendor.insurance_policy_number ?? '',
    expirationDate: toDateInputValue(vendor.insurance_expiration_date),
  };
}

const workOrderDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function formatWorkOrderDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return workOrderDateFormatter.format(date);
}

function formatWorkOrderLabel(value: string | null | undefined): string {
  if (!value) return '—';
  const cleaned = value.replace(/_/g, ' ').trim();
  if (!cleaned) return '—';
  return cleaned
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function VendorInlineEditCard({
  state,
  onChange,
  onCancel,
  onSave,
  saving,
  categories,
  error,
  showExtendedFields = true,
  showIdentityFields = true,
  showContactFields = true,
  expenseAccounts = [],
}: {
  state: EditFormState;
  onChange: (update: Partial<EditFormState>) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  categories: CategoryOption[];
  error: string | null;
  showExtendedFields?: boolean;
  showIdentityFields?: boolean;
  showContactFields?: boolean;
  expenseAccounts: ExpenseAccountOption[];
}) {
  const extended = showExtendedFields !== false;
  const showIdentity = showIdentityFields !== false;
  const showContact = showContactFields !== false;

  return (
    <EditFormPanel onClose={onCancel}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {showIdentity ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                First name
              </div>
              <Input
                value={state.firstName}
                onChange={(event) => onChange({ firstName: event.target.value })}
                placeholder="First name"
              />
            </div>
            <div className="space-y-1.5">
              <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Last name
              </div>
              <Input
                value={state.lastName}
                onChange={(event) => onChange({ lastName: event.target.value })}
                placeholder="Last name"
              />
            </div>
          </div>
        ) : null}
        <div className="space-y-4">
          {showIdentity ? (
            <>
              <div className="space-y-1.5">
                <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Category
                </div>
                <select
                  className="border-border/60 bg-background focus-visible:ring-primary h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-1 focus-visible:outline-none"
                  value={state.categoryId ?? ''}
                  onChange={(event) => onChange({ categoryId: event.target.value || null })}
                  aria-label="Select vendor category"
                  title="Select vendor category"
                >
                  <option value="">Uncategorized</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Company name
                </div>
                <Input
                  value={state.companyName}
                  onChange={(event) => onChange({ companyName: event.target.value })}
                  placeholder="Company name"
                />
              </div>
            </>
          ) : null}
          {extended ? (
            <div className="space-y-1.5">
              <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Expense account
              </div>
              <select
                className="border-border/60 bg-background focus-visible:ring-primary h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-1 focus-visible:outline-none"
                value={state.expenseAccountId}
                onChange={(event) => onChange({ expenseAccountId: event.target.value })}
                aria-label="Select expense account"
                title="Select expense account"
              >
                <option value="">No default</option>
                {expenseAccounts.map((account) => (
                  <option key={account.id} value={String(account.id)}>
                    {[account.accountNumber, account.name].filter(Boolean).join(' • ') ||
                      account.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {showContact ? (
            <>
              <div className="space-y-1.5">
                <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Cell phone
                </div>
                <Input
                  value={state.phone}
                  onChange={(event) => onChange({ phone: event.target.value })}
                  placeholder="Cell phone"
                />
              </div>
              <div className="space-y-1.5">
                <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Work phone
                </div>
                <Input
                  value={state.workPhone}
                  onChange={(event) => onChange({ workPhone: event.target.value })}
                  placeholder="Work phone"
                />
              </div>
              <div className="space-y-1.5">
                <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Email
                </div>
                <Input
                  type="email"
                  value={state.email}
                  onChange={(event) => onChange({ email: event.target.value })}
                  placeholder="Email address"
                />
              </div>
            </>
          ) : null}
          {extended ? (
            <div className="space-y-1.5">
              <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Website
              </div>
              <Input
                value={state.website}
                onChange={(event) => onChange({ website: event.target.value })}
                placeholder="Website URL"
              />
            </div>
          ) : null}
        </div>
        {showContact ? (
          <div className="space-y-4 lg:col-span-2">
            <div className="space-y-1.5">
              <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Address line 1
              </div>
              <Input
                value={state.addressLine1}
                onChange={(event) => onChange({ addressLine1: event.target.value })}
                placeholder="Street address"
              />
            </div>
            <div className="space-y-1.5">
              <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Address line 2
              </div>
              <Input
                value={state.addressLine2}
                onChange={(event) => onChange({ addressLine2: event.target.value })}
                placeholder="Apartment, suite, etc."
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  City
                </div>
                <Input
                  value={state.addressCity}
                  onChange={(event) => onChange({ addressCity: event.target.value })}
                  placeholder="City"
                />
              </div>
              <div className="space-y-1.5">
                <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  State
                </div>
                <Input
                  value={state.addressState}
                  onChange={(event) => onChange({ addressState: event.target.value })}
                  placeholder="State"
                />
              </div>
              <div className="space-y-1.5">
                <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Postal code
                </div>
                <Input
                  value={state.addressPostalCode}
                  onChange={(event) => onChange({ addressPostalCode: event.target.value })}
                  placeholder="ZIP / Postal code"
                />
              </div>
            </div>
          </div>
        ) : null}
        {extended ? (
          <div className="space-y-1.5 lg:col-span-2">
            <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Notes
            </div>
            <Textarea
              value={state.notes}
              onChange={(event) => onChange({ notes: event.target.value })}
              placeholder="Notes"
              rows={4}
            />
          </div>
        ) : null}
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="flex items-center gap-3">
        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="cancel" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </EditFormPanel>
  );
}

export function VendorsDetailsClient({
  vendor,
  categories,
  expenseAccounts,
  recentWorkOrders,
}: VendorsDetailsClientProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [formState, setFormState] = useState<EditFormState>(() => toInitialState(vendor));
  const [headerEditing, setHeaderEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingTax, setEditingTax] = useState(false);
  const [taxFormState, setTaxFormState] = useState<TaxFormState>(() => toInitialTaxState(vendor));
  const [savingTax, setSavingTax] = useState(false);
  const [taxError, setTaxError] = useState<string | null>(null);

  const [editingInsurance, setEditingInsurance] = useState(false);
  const [insuranceFormState, setInsuranceFormState] = useState<InsuranceFormState>(() =>
    toInitialInsuranceState(vendor),
  );
  const [savingInsurance, setSavingInsurance] = useState(false);
  const [insuranceError, setInsuranceError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  const contact = vendor.contact;
  const categoryName = vendor.category?.name || 'Uncategorized';

  const vendorName = useMemo(() => {
    return (
      contact?.display_name ||
      contact?.company_name ||
      [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') ||
      'Vendor'
    );
  }, [contact]);

  const companyName = contact?.company_name?.trim() || null;

  const companyLabel = companyName || '—';

  const addressLine = useMemo(() => {
    const parts = [
      contact?.primary_address_line_1,
      contact?.primary_city,
      contact?.primary_state,
      contact?.primary_postal_code,
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }, [contact]);

  const primaryEmail = contact?.primary_email?.trim() || null;
  const alternateEmail = contact?.alt_email?.trim() || null;
  const emailList = Array.from(
    new Set([primaryEmail, alternateEmail].filter((value): value is string => Boolean(value))),
  );

  const cellPhone = contact?.primary_phone?.trim() || null;
  const workPhoneValue = contact?.alt_phone?.trim() || null;
  const phoneEntries = [
    workPhoneValue ? { key: 'work', value: workPhoneValue, Icon: Briefcase } : null,
    cellPhone ? { key: 'cell', value: cellPhone, Icon: Smartphone } : null,
  ].filter(
    (entry): entry is { key: 'work' | 'cell'; value: string; Icon: LucideIcon } => entry !== null,
  );

  const emailDisplay =
    emailList.length > 0 ? (
      <div className="space-y-2">
        {emailList.map((item) => (
          <a
            key={item}
            href={`mailto:${item}`}
            className="text-primary flex items-center gap-2 hover:underline"
          >
            <Mail className="text-muted-foreground h-4 w-4" />
            <span>{item}</span>
          </a>
        ))}
      </div>
    ) : (
      '—'
    );

  const phoneDisplay =
    phoneEntries.length > 0 ? (
      <div className="space-y-2">
        {phoneEntries.map(({ key, value, Icon }) => {
          const telHref = value.replace(/[^\d+]/g, '');
          return (
            <a
              key={key}
              href={`tel:${telHref}`}
              className="text-foreground hover:text-primary flex items-center gap-2"
            >
              <Icon className="text-muted-foreground h-4 w-4" />
              <span>{value}</span>
            </a>
          );
        })}
      </div>
    ) : (
      '—'
    );

  const address =
    [
      contact?.primary_address_line_1,
      contact?.primary_address_line_2,
      [contact?.primary_city, contact?.primary_state].filter(Boolean).join(', ') || null,
      contact?.primary_postal_code,
    ]
      .filter(Boolean)
      .join('\n') || '—';

  const website = vendor.website || null;
  const websiteHref =
    website && /^(http|https):\/\//i.test(website)
      ? website
      : website
        ? `https://${website}`
        : null;

  const taxAddressParts = [
    vendor.tax_address_line1,
    vendor.tax_address_line2,
    vendor.tax_address_line3,
    [vendor.tax_address_city, vendor.tax_address_state].filter(Boolean).join(', ') || null,
    vendor.tax_address_postal_code,
    vendor.tax_address_country,
  ].filter(Boolean);
  const taxAddress = taxAddressParts.join(', ');
  const include1099Label =
    vendor.include_1099 === true ? 'Yes' : vendor.include_1099 === false ? 'No' : '—';

  const expenseAccountMap = useMemo(() => {
    const map = new Map<number, ExpenseAccountOption>();
    for (const account of expenseAccounts) {
      map.set(account.id, account);
    }
    return map;
  }, [expenseAccounts]);

  const expenseAccountLabel = useMemo(() => {
    if (vendor.expense_gl_account_id == null) return '—';
    const option = expenseAccountMap.get(vendor.expense_gl_account_id);
    if (!option) return '—';
    return [option.accountNumber, option.name].filter(Boolean).join(' • ') || option.name;
  }, [expenseAccountMap, vendor.expense_gl_account_id]);

  const cancelHeaderEditing = () => {
    setHeaderEditing(false);
    setFormState(toInitialState(vendor));
    setError(null);
  };

  const openHeaderEditing = () => {
    setFormState(toInitialState(vendor));
    setError(null);
    setEditing(false);
    setHeaderEditing(true);
  };

  const handleHeaderEditClick = () => {
    if (headerEditing) {
      cancelHeaderEditing();
    } else {
      openHeaderEditing();
    }
  };

  const toggleEditing = () => {
    setFormState(toInitialState(vendor));
    setError(null);
    setHeaderEditing(false);
    setEditing((prev) => !prev);
  };

  const toggleTaxEditing = () => {
    setTaxFormState(toInitialTaxState(vendor));
    setTaxError(null);
    setEditingTax((prev) => !prev);
  };

  const toggleInsuranceEditing = () => {
    setInsuranceFormState(toInitialInsuranceState(vendor));
    setInsuranceError(null);
    setEditingInsurance((prev) => !prev);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const expenseAccountId = formState.expenseAccountId
        ? Number(formState.expenseAccountId)
        : null;

      const response = await fetch(`/api/vendors/${vendor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: vendor.contact_id,
          firstName: formState.firstName,
          lastName: formState.lastName,
          companyName: formState.companyName.trim() || null,
          categoryId: formState.categoryId,
          accountNumber: formState.accountNumber.trim() || null,
          website: formState.website.trim() || null,
          notes: formState.notes.trim() || null,
          phone: formState.phone.trim() || null,
          workPhone: formState.workPhone.trim() || null,
          email: formState.email.trim() || null,
          addressLine1: formState.addressLine1.trim() || null,
          addressLine2: formState.addressLine2.trim() || null,
          addressCity: formState.addressCity.trim() || null,
          addressState: formState.addressState.trim() || null,
          addressPostalCode: formState.addressPostalCode.trim() || null,
          expenseAccountId,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save vendor');
      }

      setEditing(false);
      setHeaderEditing(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save vendor');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTax = async () => {
    try {
      setSavingTax(true);
      setTaxError(null);

      const response = await fetch(`/api/vendors/${vendor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxId: taxFormState.taxId.trim() || null,
          taxPayerName1: taxFormState.taxpayerName1.trim() || null,
          taxPayerName2: taxFormState.taxpayerName2.trim() || null,
          taxPayerType: taxFormState.taxpayerType.trim() || null,
          include1099: taxFormState.include1099,
          taxAddressLine1: taxFormState.addressLine1.trim() || null,
          taxAddressLine2: taxFormState.addressLine2.trim() || null,
          taxAddressLine3: taxFormState.addressLine3.trim() || null,
          taxAddressCity: taxFormState.city.trim() || null,
          taxAddressState: taxFormState.state.trim() || null,
          taxAddressPostalCode: taxFormState.postalCode.trim() || null,
          taxAddressCountry: taxFormState.country.trim() || null,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save tax details');
      }

      setEditingTax(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setTaxError(err instanceof Error ? err.message : 'Failed to save tax details');
    } finally {
      setSavingTax(false);
    }
  };

  const handleSaveInsurance = async () => {
    try {
      setSavingInsurance(true);
      setInsuranceError(null);

      const response = await fetch(`/api/vendors/${vendor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insuranceProvider: insuranceFormState.provider.trim() || null,
          insurancePolicyNumber: insuranceFormState.policyNumber.trim() || null,
          insuranceExpirationDate: insuranceFormState.expirationDate || null,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save insurance details');
      }

      setEditingInsurance(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setInsuranceError(err instanceof Error ? err.message : 'Failed to save insurance details');
    } finally {
      setSavingInsurance(false);
    }
  };

  const renderHeader = () => {
    if (headerEditing) {
      return (
        <VendorInlineEditCard
          state={formState}
          onChange={(update) => setFormState((prev) => ({ ...prev, ...update }))}
          onCancel={cancelHeaderEditing}
          onSave={handleSave}
          saving={saving || isPending}
          categories={categories}
          error={error}
          showExtendedFields={false}
          showContactFields={false}
          expenseAccounts={expenseAccounts}
        />
      );
    }

    return (
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-foreground text-2xl font-semibold">{vendorName}</h1>
            {vendor.is_active !== null ? (
              <Badge
                variant="outline"
                className={
                  vendor.is_active
                    ? 'border-[var(--color-action-200)] bg-[var(--color-action-50)] text-xs text-[var(--color-action-600)]'
                    : 'border-slate-200 bg-slate-100 text-xs text-slate-600'
                }
              >
                {vendor.is_active ? 'Active' : 'Inactive'}
              </Badge>
            ) : null}
            {vendor.buildium_vendor_id ? (
              <Badge variant="secondary" className="text-xs">
                {vendor.buildium_vendor_id}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                Not in Buildium
              </Badge>
            )}
          </div>
          <div className="text-muted-foreground space-y-1 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span>{companyLabel}</span>
              <span aria-hidden className="text-muted-foreground">
                |
              </span>
              <span>{categoryName}</span>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto px-0 text-sm font-medium"
                onClick={handleHeaderEditClick}
                disabled={saving || isPending}
              >
                Edit
              </Button>
            </div>
            {addressLine ? <p>{addressLine}</p> : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <NavTabs defaultValue="summary" className="space-y-6 p-6">
      {renderHeader()}
      <NavTabsHeader>
        <NavTabsList>
          <NavTabsTrigger value="summary">Summary</NavTabsTrigger>
          <NavTabsTrigger value="financials">Financials</NavTabsTrigger>
          <NavTabsTrigger value="communications">Communications</NavTabsTrigger>
          <NavTabsTrigger value="files">Files</NavTabsTrigger>
          <NavTabsTrigger value="notes">Notes</NavTabsTrigger>
        </NavTabsList>
      </NavTabsHeader>

      <NavTabsContent value="summary" className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <SectionCard
              title="Vendor information"
              actionLabel="Edit"
              onAction={toggleEditing}
              editing={editing}
              gridClassName="sm:grid-cols-2 lg:grid-cols-3"
              editContent={
                <VendorInlineEditCard
                  state={formState}
                  onChange={(update) => setFormState((prev) => ({ ...prev, ...update }))}
                  onCancel={toggleEditing}
                  onSave={handleSave}
                  saving={saving || isPending}
                  categories={categories}
                  error={error}
                  showIdentityFields={false}
                  expenseAccounts={expenseAccounts}
                />
              }
              rows={[
                { label: 'Expense account', value: expenseAccountLabel },
                {
                  label: 'Website',
                  value: websiteHref ? (
                    <a href={websiteHref} className="text-primary hover:underline">
                      {website}
                    </a>
                  ) : (
                    '—'
                  ),
                  className: 'lg:col-span-2',
                },
                { label: 'Phone', value: phoneDisplay },
                { label: 'Email', value: emailDisplay },
                { label: 'Address', value: <span className="whitespace-pre-line">{address}</span> },
              ]}
              bottomContent={
                <div>
                  <div className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                    Comments
                  </div>
                  <div className="text-foreground">{vendor.notes || '—'}</div>
                </div>
              }
            />
            <SectionCard
              title="1099-NEC tax filing"
              actionLabel="Edit"
              onAction={toggleTaxEditing}
              editing={editingTax}
              editContent={
                <VendorTaxEditCard
                  state={taxFormState}
                  onChange={(update) => setTaxFormState((prev) => ({ ...prev, ...update }))}
                  onCancel={toggleTaxEditing}
                  onSave={handleSaveTax}
                  saving={savingTax || isPending}
                  error={taxError}
                />
              }
              rows={[
                { label: 'Tax ID', value: vendor.tax_id || '—' },
                {
                  label: 'Taxpayer name',
                  value: vendor.tax_payer_name1 || vendor.tax_payer_name2 || '—',
                },
                { label: 'Taxpayer type', value: vendor.tax_payer_type || '—' },
                { label: 'Include 1099', value: include1099Label },
                { label: 'Address', value: taxAddress || 'Same as above' },
              ]}
            />
            <SectionCard
              title="Vendor insurance"
              actionLabel="Edit"
              onAction={toggleInsuranceEditing}
              editing={editingInsurance}
              editContent={
                <VendorInsuranceEditCard
                  state={insuranceFormState}
                  onChange={(update) =>
                    setInsuranceFormState((prev) => ({
                      ...prev,
                      ...update,
                    }))
                  }
                  onCancel={toggleInsuranceEditing}
                  onSave={handleSaveInsurance}
                  saving={savingInsurance || isPending}
                  error={insuranceError}
                />
              }
              rows={[
                { label: 'Provider', value: vendor.insurance_provider || '—' },
                { label: 'Policy number', value: vendor.insurance_policy_number || '—' },
                { label: 'Expiration', value: vendor.insurance_expiration_date || '—' },
              ]}
            />
            <Card className="border-border overflow-hidden border shadow-sm">
              <CardHeader className="border-border bg-muted/40 border-b px-4 py-3">
                <CardTitle className="text-base font-semibold">Recent work orders</CardTitle>
              </CardHeader>
              {recentWorkOrders.length === 0 ? (
                <CardContent className="text-muted-foreground py-8 text-center text-sm">
                  No work orders linked to this vendor yet.
                </CardContent>
              ) : (
                <CardContent className="p-0">
                  <Table className="text-sm">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[34%]">Subject</TableHead>
                        <TableHead className="w-[16%]">Status</TableHead>
                        <TableHead className="w-[16%]">Priority</TableHead>
                        <TableHead className="w-[18%]">Property</TableHead>
                        <TableHead className="w-[16%]">Scheduled</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentWorkOrders.map((workOrder) => (
                        <TableRow key={workOrder.id}>
                          <TableCell className="text-foreground font-medium">
                            {workOrder.subject}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatWorkOrderLabel(workOrder.status)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatWorkOrderLabel(workOrder.priority)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {workOrder.propertyId ? (
                              <Link
                                href={`/properties/${workOrder.propertyId}`}
                                className="text-primary hover:underline"
                              >
                                {workOrder.propertyName || 'View property'}
                              </Link>
                            ) : (
                              workOrder.propertyName || '—'
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatWorkOrderDate(workOrder.scheduledDate || workOrder.updatedAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          </div>
          <aside className="space-y-4">
            <Card className="border border-blue-100 bg-blue-50 text-sm text-blue-800">
              <CardContent className="space-y-2 p-4">
                <div className="font-medium text-blue-900">{vendorName}</div>
                <div>Category: {categoryName}</div>
                <div>Account #: {vendor.account_number || '—'}</div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </NavTabsContent>

      <NavTabsContent value="financials">
        <EmptyPanel message="Financial details coming soon." />
      </NavTabsContent>

      <NavTabsContent value="communications">
        <EmptyPanel message="No communications yet." />
      </NavTabsContent>

      <NavTabsContent value="files">
        <EmptyPanel message="Files for this vendor will show here once document uploads are enabled." />
      </NavTabsContent>

      <NavTabsContent value="notes">
        <EmptyPanel message="Keep track of vendor notes and follow-ups. Notes support will be added shortly." />
      </NavTabsContent>
    </NavTabs>
  );
}

function VendorTaxEditCard({
  state,
  onChange,
  onCancel,
  onSave,
  saving,
  error,
}: {
  state: TaxFormState;
  onChange: (update: Partial<TaxFormState>) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
}) {
  const handleTaxpayerTypeChange = (value: string) => {
    onChange({
      taxpayerType: value === TAXPAYER_TYPE_UNSPECIFIED_OPTION_VALUE ? '' : (value as TaxPayerType),
    });
  };

  return (
    <EditFormPanel onClose={onCancel}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Tax ID
            </div>
            <Input
              value={state.taxId}
              onChange={(event) => onChange({ taxId: event.target.value })}
              placeholder="Tax ID"
            />
          </div>
          <div className="space-y-1.5">
            <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Taxpayer name 1
            </div>
            <Input
              value={state.taxpayerName1}
              onChange={(event) => onChange({ taxpayerName1: event.target.value })}
              placeholder="Primary taxpayer name"
            />
          </div>
          <div className="space-y-1.5">
            <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Taxpayer name 2
            </div>
            <Input
              value={state.taxpayerName2}
              onChange={(event) => onChange({ taxpayerName2: event.target.value })}
              placeholder="Optional secondary name"
            />
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Taxpayer type
            </div>
            <Select
              value={state.taxpayerType || TAXPAYER_TYPE_UNSPECIFIED_OPTION_VALUE}
              onValueChange={handleTaxpayerTypeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TAXPAYER_TYPE_UNSPECIFIED_OPTION_VALUE}>
                  Not specified
                </SelectItem>
                {TAX_PAYER_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="text-foreground flex items-center gap-2 text-sm">
            <Checkbox
              checked={state.include1099}
              onCheckedChange={(checked) => onChange({ include1099: Boolean(checked) })}
            />
            Include 1099
          </label>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Address line 1
            </div>
            <Input
              value={state.addressLine1}
              onChange={(event) => onChange({ addressLine1: event.target.value })}
              placeholder="Street address"
            />
          </div>
          <div className="space-y-1.5">
            <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Address line 2
            </div>
            <Input
              value={state.addressLine2}
              onChange={(event) => onChange({ addressLine2: event.target.value })}
              placeholder="Apartment, suite, etc."
            />
          </div>
          <div className="space-y-1.5">
            <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Address line 3
            </div>
            <Textarea
              value={state.addressLine3}
              onChange={(event) => onChange({ addressLine3: event.target.value })}
              placeholder="Additional address details"
            />
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              City
            </div>
            <Input
              value={state.city}
              onChange={(event) => onChange({ city: event.target.value })}
              placeholder="City"
            />
          </div>
          <div className="space-y-1.5">
            <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              State
            </div>
            <Input
              value={state.state}
              onChange={(event) => onChange({ state: event.target.value })}
              placeholder="State"
            />
          </div>
          <div className="space-y-1.5">
            <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Postal code
            </div>
            <Input
              value={state.postalCode}
              onChange={(event) => onChange({ postalCode: event.target.value })}
              placeholder="Postal code"
            />
          </div>
          <div className="space-y-1.5">
            <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Country
            </div>
            <Input
              value={state.country}
              onChange={(event) => onChange({ country: event.target.value })}
              placeholder="Country"
            />
          </div>
        </div>
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="flex items-center gap-3">
        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="cancel" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </EditFormPanel>
  );
}
function VendorInsuranceEditCard({
  state,
  onChange,
  onCancel,
  onSave,
  saving,
  error,
}: {
  state: InsuranceFormState;
  onChange: (update: Partial<InsuranceFormState>) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
}) {
  return (
    <EditFormPanel onClose={onCancel}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-1.5">
          <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Provider
          </div>
          <Input
            value={state.provider}
            onChange={(event) => onChange({ provider: event.target.value })}
            placeholder="Insurance provider"
          />
        </div>
        <div className="space-y-1.5">
          <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Policy number
          </div>
          <Input
            value={state.policyNumber}
            onChange={(event) => onChange({ policyNumber: event.target.value })}
            placeholder="Policy number"
          />
        </div>
        <div className="space-y-1.5">
          <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Expiration
          </div>
          <DateInput
            value={state.expirationDate}
            onChange={(nextValue) => onChange({ expirationDate: nextValue })}
          />
        </div>
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="flex items-center gap-3">
        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="cancel" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </EditFormPanel>
  );
}

function SectionCard({
  title,
  actionLabel,
  onAction,
  rows,
  editing,
  editContent,
  gridClassName = 'sm:grid-cols-3',
  bottomContent,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  rows: Array<{ label: string; value: React.ReactNode; className?: string }>;
  editing?: boolean;
  editContent?: React.ReactNode;
  gridClassName?: string;
  bottomContent?: React.ReactNode;
}) {
  return (
    <div className="border-border border-b pb-6">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-foreground text-lg font-semibold">{title}</h2>
        {actionLabel && !editing && onAction ? (
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0 text-sm font-medium"
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        ) : null}
      </div>
      {editing && editContent ? (
        editContent
      ) : (
        <div className={cn('grid grid-cols-1 gap-6 text-sm', gridClassName)}>
          {rows.map((row) => (
            <div key={row.label} className={row.className}>
              <div className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                {row.label}
              </div>
              <div className="text-foreground">{row.value}</div>
            </div>
          ))}
          {bottomContent ? <div className="col-span-full">{bottomContent}</div> : null}
        </div>
      )}
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="text-muted-foreground py-6 text-sm">{message}</CardContent>
    </Card>
  );
}
