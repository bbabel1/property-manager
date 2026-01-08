'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
import { Dropdown } from '@/components/ui/Dropdown';
import { groupGlAccounts } from '@/lib/gl-accounts/grouping';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Loader2, Plus, UploadCloud, XCircle } from 'lucide-react';
import ActionButton from '@/components/ui/ActionButton';
import AddLink from '@/components/ui/AddLink';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  FullscreenDialogContent,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { Database } from '@/types/database';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf'];
const ALLOWED_MIME_TYPES = new Set<string>([
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.template',
  'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  'text/plain',
]);
const UNSUPPORTED_FILE_MESSAGE =
  'Unsupported file type. Allowed formats: PDF, images, and Office documents.';

type LeaseRow = Database['public']['Tables']['lease']['Row'];
type UnitRow = Database['public']['Tables']['units']['Row'];
type PropertyRow = Database['public']['Tables']['properties']['Row'];

type LeaseListItem = LeaseRow & {
  tenant_name?: string | null;
  last_sync_error?: string | null;
};

type UnitSummary = Pick<UnitRow, 'id' | 'unit_number' | 'status'>;
type PropertySummary = Pick<PropertyRow, 'id' | 'name' | 'org_id' | 'status'> & {
  units?: UnitSummary[] | null;
};

type UnitOption = { id: string; unit_number: string };
type PropertyOption = { id: string; name: string };

type TenantOption = { id: string; name: string; email?: string | null };

type GlAccountOption = {
  id: string;
  name: string;
  account_number?: string | null;
  type?: string | null;
  is_security_deposit_liability?: boolean | null;
};

type TenantSearchRow = {
  id: string | number;
  contacts?: {
    first_name?: string | null;
    last_name?: string | null;
    primary_email?: string | null;
  } | null;
};

type StagedPerson = {
  first_name: string;
  last_name: string;
  phone?: string | null;
  email?: string | null;
  alt_phone?: string | null;
  alt_email?: string | null;
  same_as_unit?: boolean | null;
  same_as_unit_address?: boolean | null;
  addr1?: string | null;
  addr2?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal?: string | null;
  country?: string | null;
  alt_addr1?: string | null;
  alt_addr2?: string | null;
  alt_city?: string | null;
  alt_state?: string | null;
  alt_postal?: string | null;
  alt_country?: string | null;
  postal_code?: string | null;
  country_name?: string | null;
  city_name?: string | null;
  state_name?: string | null;
  alt_postal_code?: string | null;
  alt_address_line1?: string | null;
  alt_address_line2?: string | null;
};

type LeaseContactPayload = { tenant_id: string; role: string; is_rent_responsible: boolean };

type RecurringTransactionPayload = {
  amount: number;
  memo: string;
  frequency: string;
  start_date: string;
  end_date?: string;
  gl_account_id?: string | null;
};

type LeaseCreatePayload = {
  property_id: string | undefined;
  unit_id: string | undefined;
  lease_from_date: string;
  lease_to_date: string | null;
  rent_amount: number | null;
  lease_charges?: string | null;
  security_deposit: number | null;
  payment_due_day: number | null;
  unit_number: string | null;
  lease_type: string;
  rent_schedules?: Array<{
    start_date: string | null;
    end_date?: string | null;
    total_amount?: number | null;
    rent_cycle?: string;
    status?: string;
    backdate_charges?: boolean;
  }>;
  prorated_first_month_rent?: number;
  prorated_last_month_rent?: number;
  recurring_transactions?: RecurringTransactionPayload[];
  contacts?: LeaseContactPayload[];
  new_people?: Array<StagedPerson & { role: string }>;
  // Control Buildium sync on create
  syncBuildium?: boolean;
  // Buildium: send Resident Center welcome email
  send_welcome_email?: boolean;
};

type PendingLeaseFile = {
  id: string;
  file: File;
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  error?: string | null;
};

type LeaseSectionProps = {
  leases: LeaseListItem[];
  unit: (Pick<UnitRow, 'id' | 'unit_number'> & { status?: string | null }) | null;
  property: PropertySummary | null;
};

type RentFrequency = 'Monthly' | 'Weekly' | 'Biweekly' | 'Quarterly' | 'Annually';

function isLeaseList(value: unknown): value is LeaseListItem[] {
  return Array.isArray(value);
}

function isPropertyApiList(
  value: unknown,
): value is Array<{ id: string | number; name?: string | null; status?: string | null }> {
  return Array.isArray(value);
}

const toNumericId = (value: unknown): number | null => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
};

const parseDateOnly = (input?: string | null): Date | null => {
  if (!input) return null;
  const datePart = typeof input === 'string' ? input.slice(0, 10) : '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (match) {
    const [, y, m, d] = match;
    const parsed = new Date(Number(y), Number(m) - 1, Number(d));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const extractLeaseIdFromLeaseResponse = (response: unknown): number | null => {
  if (!response || typeof response !== 'object') return null;

  const root = response as {
    lease?: unknown;
    Lease?: unknown;
    lease_id?: unknown;
    leaseId?: unknown;
  };

  const candidateLease = (root.lease ?? root.Lease) as
    | { id?: unknown; Id?: unknown; ID?: unknown }
    | null
    | undefined;

  const rawIdFromLease =
    candidateLease?.id ?? candidateLease?.Id ?? candidateLease?.ID ?? null;

  const rawId = rawIdFromLease ?? root.lease_id ?? root.leaseId ?? null;

  return toNumericId(rawId);
};

// UI component

export default function LeaseSection({ leases: initialLeases, unit, property }: LeaseSectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchString = searchParams?.toString() || '';
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncToBuildium, setSyncToBuildium] = useState(true);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [syncingLeaseId, setSyncingLeaseId] = useState<string | null>(null);
  const [leaseSyncError, setLeaseSyncError] = useState<{ id: string; message: string } | null>(
    null,
  );
  const [leases, setLeases] = useState<LeaseListItem[]>(initialLeases || []);

  // Form fields
  const [propertyId, setPropertyId] = useState<string>(property?.id ? String(property.id) : '');
  const [unitId, setUnitId] = useState<string>(unit?.id ? String(unit.id) : '');
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rent, setRent] = useState('');
  const [rentCycle, setRentCycle] = useState<RentFrequency>('Monthly');
  const [nextDueDate, setNextDueDate] = useState<string>('');
  const [paymentDueDay, setPaymentDueDay] = useState<string>('');
  const [depositDate, setDepositDate] = useState<string>('');
  const [rentMemo, setRentMemo] = useState<string>('');
  const [depositMemo, setDepositMemo] = useState<string>('');
  const [leaseType, setLeaseType] = useState<string>('Fixed');
  const [depositAmt, setDepositAmt] = useState('');
  const [leaseCharges, setLeaseCharges] = useState<string>('');
  const [depositTouched, setDepositTouched] = useState(false);
  // Proration controls
  const [prorateFirstMonth, setProrateFirstMonth] = useState(false);
  const [prorateLastMonth, setProrateLastMonth] = useState(false);
  const [firstProrationDays, setFirstProrationDays] = useState<number>(0);
  const [firstProrationAmount, setFirstProrationAmount] = useState<number | null>(null);
  const [lastProrationDays, setLastProrationDays] = useState<number>(0);
  const [lastProrationAmount, setLastProrationAmount] = useState<number | null>(null);
  const [showAddTenant, setShowAddTenant] = useState(false);
  // Existing-tenant selection UI state
  const [chooseExisting, setChooseExisting] = useState(false);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<TenantOption[]>([]);
  const [selectedExistingTenantIds, setSelectedExistingTenantIds] = useState<string[]>([]);
  const [sameAsUnitAddress, setSameAsUnitAddress] = useState(true);
  const [showAltPhone, setShowAltPhone] = useState(false);
  const [altPhone, setAltPhone] = useState('');
  const [showAltEmail, setShowAltEmail] = useState(false);
  const [altEmail, setAltEmail] = useState('');
  const prevStartDateRef = useRef<string>('');
  // New tenant form fields
  const [tenantFirstName, setTenantFirstName] = useState('');
  const [tenantLastName, setTenantLastName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  // Primary address (blank by default)
  const [addr1, setAddr1] = useState<string>('');
  const [addr2, setAddr2] = useState<string>('');
  const [cityField, setCityField] = useState<string>('');
  const [stateField, setStateField] = useState<string>('');
  const [postalField, setPostalField] = useState<string>('');
  const [countryField, setCountryField] = useState<string>('');
  // Alternate address fields (hidden until link clicked)
  const [showAltAddress, setShowAltAddress] = useState(false);
  const [altAddr1, setAltAddr1] = useState<string>('');
  const [altAddr2, setAltAddr2] = useState<string>('');
  const [altCity, setAltCity] = useState<string>('');
  const [altState, setAltState] = useState<string>('');
  const [altPostal, setAltPostal] = useState<string>('');
  const [altCountry, setAltCountry] = useState<string>('');
  const [pendingTenants, setPendingTenants] = useState<StagedPerson[]>([]);

  // Cosigner: replicate Contact Information + Address sections
  const [coShowAltPhone, setCoShowAltPhone] = useState(false);
  const [coAltPhone, setCoAltPhone] = useState('');
  const [coShowAltEmail, setCoShowAltEmail] = useState(false);
  const [coAltEmail, setCoAltEmail] = useState('');
  const [coFirstName, setCoFirstName] = useState('');
  const [coLastName, setCoLastName] = useState('');
  const [coEmail, setCoEmail] = useState('');
  const [coPhone, setCoPhone] = useState('');
  const [coSameAsUnitAddress, setCoSameAsUnitAddress] = useState(true);
  const [coAddr1, setCoAddr1] = useState<string>('');
  const [coAddr2, setCoAddr2] = useState<string>('');
  const [coCity, setCoCity] = useState<string>('');
  const [coState, setCoState] = useState<string>('');
  const [coPostal, setCoPostal] = useState<string>('');
  const [coCountry, setCoCountry] = useState<string>('');
  const [coShowAltAddress, setCoShowAltAddress] = useState(false);
  const [coAltAddr1, setCoAltAddr1] = useState<string>('');
  const [coAltAddr2, setCoAltAddr2] = useState<string>('');
  const [coAltCity, setCoAltCity] = useState<string>('');
  const [coAltState, setCoAltState] = useState<string>('');
  const [coAltPostal, setCoAltPostal] = useState<string>('');
  const [coAltCountry, setCoAltCountry] = useState<string>('');
  const [pendingCosigners, setPendingCosigners] = useState<StagedPerson[]>([]);
  const [pendingLeaseFiles, setPendingLeaseFiles] = useState<PendingLeaseFile[]>([]);
  const [createdLeaseId, setCreatedLeaseId] = useState<number | null>(null);
  const leaseFileInputRef = useRef<HTMLInputElement | null>(null);
  const [glAccounts, setGlAccounts] = useState<GlAccountOption[]>([]);
  const [glAccountsLoading, setGlAccountsLoading] = useState(false);
  const [glAccountsError, setGlAccountsError] = useState<string | null>(null);
  const [rentGlAccountId, setRentGlAccountId] = useState<string>('');
  const [depositGlAccountId, setDepositGlAccountId] = useState<string>('');
  // Additional recurring charges (user-added)
  type RecurringFormRow = {
    gl_account_id: string;
    frequency: RentFrequency;
    start_date: string;
    amount: string;
    memo: string;
  };
  const [extraRecurring, setExtraRecurring] = useState<RecurringFormRow[]>([]);
  type OneTimeFormRow = {
    gl_account_id: string;
    date: string;
    amount: string;
    memo: string;
  };
  const [extraOneTime, setExtraOneTime] = useState<OneTimeFormRow[]>([]);

  const parseCurrencyValue = (value: string | number | null | undefined): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace(/[^0-9.-]/g, '');
    if (!normalized || normalized === '.' || normalized === '-' || normalized === '-.') return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  function resetCosignerForm() {
    setCoFirstName('');
    setCoLastName('');
    setCoEmail('');
    setCoPhone('');
    setCoShowAltPhone(false);
    setCoAltPhone('');
    setCoShowAltEmail(false);
    setCoAltEmail('');
    setCoSameAsUnitAddress(true);
    setCoAddr1('');
    setCoAddr2('');
    setCoCity('');
    setCoState('');
    setCoPostal('');
    setCoCountry('');
    setCoShowAltAddress(false);
    setCoAltAddr1('');
    setCoAltAddr2('');
    setCoAltCity('');
    setCoAltState('');
    setCoAltPostal('');
    setCoAltCountry('');
  }

  function resetForm() {
    setFrom('');
    setTo('');
    setRent('');
    setRentCycle('Monthly');
    setNextDueDate('');
    setPaymentDueDay('');
    setDepositDate('');
    setRentMemo('');
    setDepositMemo('');
    setLeaseType('Fixed');
    setDepositAmt('');
    setLeaseCharges('');
    setDepositTouched(false);
    setProrateFirstMonth(false);
    setProrateLastMonth(false);
    setFirstProrationDays(0);
    setFirstProrationAmount(null);
    setLastProrationDays(0);
    setLastProrationAmount(null);
    setPendingTenants([]);
    setPendingCosigners([]);
    setShowAddTenant(false);
    setChooseExisting(false);
    setSelectedExistingTenantIds([]);
    setSearch('');
    setResults([]);
    setSearching(false);
    setSameAsUnitAddress(true);
    setShowAltPhone(false);
    setAltPhone('');
    setShowAltEmail(false);
    setAltEmail('');
    setTenantFirstName('');
    setTenantLastName('');
    setTenantPhone('');
    setTenantEmail('');
    setAddr1('');
    setAddr2('');
    setCityField('');
    setStateField('');
    setPostalField('');
    setCountryField('');
    setShowAltAddress(false);
    setAltAddr1('');
    setAltAddr2('');
    setAltCity('');
    setAltState('');
    setAltPostal('');
    setAltCountry('');
    resetCosignerForm();
    setCoShowAltPhone(false);
    setCoAltPhone('');
    setCoShowAltEmail(false);
    setCoAltEmail('');
    setCoSameAsUnitAddress(true);
    setRentGlAccountId('');
    setDepositGlAccountId('');
    setExtraRecurring([]);
    setExtraOneTime([]);
    setPendingLeaseFiles([]);
    setCreatedLeaseId(null);
    setSyncToBuildium(true);
    setSendWelcomeEmail(true);
    prevStartDateRef.current = '';
  }

  function closeLeaseDialog() {
    resetForm();
    setSaving(false);
    setError(null);
    setOpen(false);
  }

  const fmt = (d?: string | null) => {
    const parsed = parseDateOnly(d);
    return parsed ? parsed.toLocaleDateString() : '—';
  };
  const fmtUsd = (n?: number | null) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);

  const formatFileSize = (bytes: number) => {
    if (!Number.isFinite(bytes)) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const navigateToAddLease = useCallback(() => {
    const baseReturnTo =
      pathname && pathname.length > 0 ? pathname + (searchString ? `?${searchString}` : '') : '/leases';
    const params = new URLSearchParams({ returnTo: baseReturnTo });
    if (property?.id != null) params.set('propertyId', String(property.id));
    if (unit?.id != null) params.set('unitId', String(unit.id));
    router.push(`/leases/add?${params.toString()}`);
  }, [pathname, property?.id, router, searchString, unit?.id]);

  const isAllowedMimeType = useCallback(
    (mimeType: string | undefined | null) => {
      if (!mimeType) return true;
      for (const prefix of ALLOWED_MIME_PREFIXES) {
        if (mimeType.startsWith(prefix)) return true;
      }
      if (ALLOWED_MIME_TYPES.has(mimeType)) return true;
      if (mimeType.startsWith('application/vnd.openxmlformats-officedocument')) return true;
      return false;
    },
    [],
  );

  const handleLeaseFileSelection = useCallback(
    (list: FileList | null) => {
      if (!list || !list.length) return;
      setPendingLeaseFiles((prev) => {
        const maxFiles = 10;
        const next: PendingLeaseFile[] = [...prev];
        for (const file of Array.from(list)) {
          if (next.length >= maxFiles) {
            setError((prevError) => prevError ?? 'You can attach up to 10 documents per lease.');
            break;
          }
          if (file.size > MAX_UPLOAD_BYTES) {
            setError(`"${file.name}" is larger than 25 MB and was skipped.`);
            continue;
          }
          if (!isAllowedMimeType(file.type)) {
            setError(
              (prevError) =>
                prevError ??
                `"${file.name}" is not a supported file type. ${UNSUPPORTED_FILE_MESSAGE}`,
            );
            continue;
          }
          const duplicate = next.some(
            (entry) => entry.file.name === file.name && entry.file.size === file.size,
          );
          if (duplicate) continue;
          const id =
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          next.push({ id, file, name: file.name, size: file.size, status: 'pending', error: null });
        }
        return next;
      });
    },
    [isAllowedMimeType, setError],
  );

  const removePendingLeaseFile = useCallback((id: string) => {
    setPendingLeaseFiles((prev) => {
      const target = prev.find((file) => file.id === id);
      if (target?.status === 'uploading') return prev;
      return prev.filter((file) => file.id !== id);
    });
  }, []);

  const uploadLeaseFiles = useCallback(async (leaseId: number, files: PendingLeaseFile[]) => {
    const results: Array<{ id: string; success: boolean; message?: string }> = [];
    for (const pending of files) {
      setPendingLeaseFiles((prev) =>
        prev.map((file) =>
          file.id === pending.id ? { ...file, status: 'uploading', error: null } : file,
        ),
      );
      try {
        if (pending.file.size > MAX_UPLOAD_BYTES) {
          throw new Error('File exceeds the 25 MB upload limit.');
        }
        if (!isAllowedMimeType(pending.file.type)) {
          throw new Error(UNSUPPORTED_FILE_MESSAGE);
        }

        const formData = new FormData();
        formData.append('file', pending.file);
        formData.append('entityType', 'lease');
        formData.append('entityId', String(leaseId));
        formData.append('fileName', pending.name);
        if (pending.file.type) {
          formData.append('mimeType', pending.file.type);
        }
        formData.append('category', 'Lease');
        formData.append('isPrivate', 'true');

        let response: Response;
        try {
          response = await fetchWithSupabaseAuth('/api/files/upload', {
            method: 'POST',
            body: formData,
          });
        } catch (authError) {
          console.warn(
            'fetchWithSupabaseAuth failed for lease section upload; falling back.',
            authError,
          );
          response = await fetch('/api/files/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include',
          });
        }

        if (!response.ok) {
          const details = await response.json().catch(() => ({}));
          const message =
            typeof details?.error === 'string' ? details.error : 'Failed to upload file';
          throw new Error(message);
        }

        setPendingLeaseFiles((prev) =>
          prev.map((file) =>
            file.id === pending.id ? { ...file, status: 'uploaded', error: null } : file,
          ),
        );
        results.push({ id: pending.id, success: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to upload file';
        setPendingLeaseFiles((prev) =>
          prev.map((file) =>
            file.id === pending.id ? { ...file, status: 'error', error: message } : file,
          ),
        );
        results.push({ id: pending.id, success: false, message });
      }
    }
    return results;
  }, [isAllowedMimeType]);

  // Load Active properties list when form opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const loadProps = async () => {
      try {
        const res = await fetch('/api/properties');
        const json: unknown = await res.json().catch(() => []);
        const list = isPropertyApiList(json) ? json : [];
        const active = list
          .filter((p) => String(p?.status ?? '').toLowerCase() === 'active')
          .map<PropertyOption>((p) => ({ id: String(p.id), name: p?.name ?? 'Property' }));
        if (!cancelled) setProperties(active);
      } catch {}
    };
    loadProps();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const controller = new AbortController();
    const ensureAccounts = async () => {
      try {
        setGlAccountsLoading(true);
        setGlAccountsError(null);
        const orgId = property?.org_id ? String(property.org_id) : null;
        const path = orgId
          ? `/api/gl-accounts?${new URLSearchParams({ orgId }).toString()}`
          : `/api/gl-accounts`;
        const res = await fetch(path, {
          signal: controller.signal,
          credentials: 'include',
          headers: orgId ? { 'x-org-id': orgId } : undefined,
        });
        const json: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          const msg =
            json &&
            typeof json === 'object' &&
            json !== null &&
            'error' in json &&
            typeof (json as { error?: unknown }).error === 'string'
              ? String((json as { error?: string }).error)
              : 'Failed to load GL accounts';
          throw new Error(msg);
        }
        const rows =
          json &&
          typeof json === 'object' &&
          'data' in json &&
          Array.isArray((json as { data?: unknown }).data)
            ? (json as { data: Array<Record<string, unknown>> }).data
            : [];
        const list = rows
          .filter(
            (
              row,
            ): row is {
              id: unknown;
              name: unknown;
              account_number?: unknown;
              type?: unknown;
              is_active?: unknown;
              is_security_deposit_liability?: unknown;
            } => {
              if (!row) return false;
              if (row.is_active === false) return false;
              const hasId = typeof row.id === 'string' || typeof row.id === 'number';
              return hasId && typeof row.name === 'string';
            },
          )
          .map<GlAccountOption>((row) => ({
            id: String(row.id),
            name: String(row.name),
            account_number: row.account_number ? String(row.account_number) : null,
            type: row.type ? String(row.type) : null,
            is_security_deposit_liability:
              typeof row.is_security_deposit_liability === 'boolean'
                ? row.is_security_deposit_liability
                : null,
          }));
        if (!cancelled) {
          setGlAccounts(list);
          if (!list.length) {
            setRentGlAccountId('');
            setDepositGlAccountId('');
          }
        }
      } catch (err) {
        if (!cancelled)
          setGlAccountsError(err instanceof Error ? err.message : 'Failed to load GL accounts');
      } finally {
        if (!cancelled) setGlAccountsLoading(false);
      }
    };
    ensureAccounts();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, property?.org_id]);

  useEffect(() => {
    if (!glAccounts.length) return;
    const incomeAccountsForDefault = glAccounts.filter(
      (acc) => (acc.type ?? '').toLowerCase() === 'income',
    );
    if (!rentGlAccountId) {
      if (incomeAccountsForDefault.length) {
        const rentDefault =
          incomeAccountsForDefault.find((acc) => acc.name?.toLowerCase() === 'rent income') ||
          incomeAccountsForDefault[0];
        if (rentDefault) setRentGlAccountId(rentDefault.id);
      } else {
        setRentGlAccountId('');
      }
    }
    if (!depositGlAccountId) {
      const depositCandidates = glAccounts.filter((acc) => acc.is_security_deposit_liability);
      const depositSourceAll = depositCandidates.length ? depositCandidates : glAccounts;
      const depositDefault =
        depositSourceAll.find((acc) => acc.name?.toLowerCase().includes('deposit')) ||
        depositSourceAll[0];
      if (depositDefault) setDepositGlAccountId(depositDefault.id);
    }
  }, [glAccounts, rentGlAccountId, depositGlAccountId]);

  // Load Units for selected property (status != Inactive)
  useEffect(() => {
    if (!open || !propertyId) return;
    let cancelled = false;
    const primeFromProp = () => {
      if (!property || String(property.id) !== String(propertyId)) return false;
      const propertyUnits = Array.isArray(property.units) ? property.units : [];
      const list = propertyUnits
        .filter((unitItem) => String(unitItem?.status ?? '').toLowerCase() !== 'inactive')
        .map<UnitOption>((unitItem) => ({
          id: String(unitItem.id),
          unit_number: unitItem.unit_number ?? 'Unit',
        }));
      if (list.length) {
        setUnits(list);
        return true;
      }
      return false;
    };
    const loadUnits = async () => {
      if (primeFromProp()) return;
      try {
        const supa = getSupabaseBrowserClient();
        const { data } = await supa
          .from('units')
          .select('id, unit_number, status')
          .eq('property_id', propertyId)
          .not('status', 'eq', 'Inactive')
          .order('unit_number');
        const list = (data || []).map<UnitOption>((u) => ({
          id: String(u.id),
          unit_number: u.unit_number || 'Unit',
        }));
        if (!cancelled) setUnits(list);
      } catch {}
    };
    loadUnits();
    return () => {
      cancelled = true;
    };
  }, [open, propertyId, property]);

  useEffect(() => {
    setLeases(initialLeases || []);
  }, [initialLeases]);

  const loadLeases = useCallback(async (): Promise<LeaseListItem[] | null> => {
    if (!unit?.id) return null;
    try {
      const params = new URLSearchParams({ unitId: String(unit.id) });
      const res = await fetch(`/api/leases?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return null;
      const data: unknown = await res.json().catch(() => null);
      if (isLeaseList(data)) return data;
    } catch {}
    return null;
  }, [unit?.id]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!unit?.id) {
        if (!cancelled) setLeases(initialLeases || []);
        return;
      }
      const data = await loadLeases();
      if (!cancelled && data) setLeases(data);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [unit?.id, initialLeases, loadLeases]);

  async function syncLease(leaseId: string) {
    try {
      setSyncingLeaseId(leaseId);
      setLeaseSyncError(null);
      const res = await fetch(`/api/leases/${leaseId}/sync`, { method: 'POST' });
      if (!res.ok) {
        const json: unknown = await res.json().catch(() => null);
        const errorMessage =
          typeof json === 'object' &&
          json &&
          'error' in json &&
          typeof (json as { error?: unknown }).error === 'string'
            ? (json as { error: string }).error
            : 'Failed to sync lease to Buildium';
        throw new Error(errorMessage);
      }
      await res.json().catch(() => null);
      const refreshed = await loadLeases();
      if (refreshed) setLeases(refreshed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync lease to Buildium';
      setLeaseSyncError({ id: leaseId, message });
    } finally {
      setSyncingLeaseId(null);
    }
  }

  async function save() {
    const finalizeLease = async () => {
      resetForm();
      setPendingLeaseFiles([]);
      setCreatedLeaseId(null);
      setError(null);
      setOpen(false);
      const refreshed = await loadLeases();
      if (refreshed) setLeases(refreshed);
    };

    try {
      setSaving(true);
      setError(null);

      if (createdLeaseId) {
        const filesToUpload = pendingLeaseFiles.filter((file) => file.status !== 'uploaded');
        if (!filesToUpload.length) {
          await finalizeLease();
          return;
        }
        const uploadResults = await uploadLeaseFiles(createdLeaseId, filesToUpload);
        const failedUploads = uploadResults.filter((result) => !result.success);
        if (failedUploads.length === 0) {
          await finalizeLease();
        } else {
          setError('Lease created, but some documents failed to upload. Please review and retry.');
        }
        return;
      }

      if (!from) throw new Error('Start date is required');
      const totalTenants =
        selectedExistingTenantIds.length + pendingTenants.length + pendingCosigners.length;
      if (totalTenants === 0) throw new Error('Add at least one tenant or cosigner');
      const tenantOnlyCount = selectedExistingTenantIds.length + pendingTenants.length;
      if (syncToBuildium && tenantOnlyCount === 0) {
        throw new Error('Add at least one tenant to sync to Buildium');
      }
      const rentAmount = parseCurrencyValue(rent);
      const depositAmount = parseCurrencyValue(depositAmt);
      const rentHasAmount = rentAmount != null && rentAmount > 0;
      const depositHasAmount = depositAmount != null && depositAmount > 0;

      if (rentHasAmount && !nextDueDate)
        throw new Error('Rent next due date is required when amount is set');
      if (depositHasAmount && !depositDate)
        throw new Error('Deposit due date is required when amount is set');
      const propertyIdValue = propertyId || (property?.id ? String(property.id) : undefined);
      const unitIdValue = unitId || (unit?.id ? String(unit.id) : undefined);
      const paymentDueDayValue = (() => {
        if (paymentDueDay) {
          const asNum = Number(paymentDueDay);
          return Number.isFinite(asNum) ? asNum : null;
        }
        if (!nextDueDate) return null;
        const parsed = new Date(`${nextDueDate}T00:00:00`);
        return Number.isNaN(parsed.getTime()) ? null : parsed.getDate();
      })();

      if (rentHasAmount && !paymentDueDayValue)
        throw new Error('Rent due day is required when amount is set');

      if (rentHasAmount && rentAccountOptions.length > 0 && !rentGlAccountId) {
        throw new Error('Select a GL account for rent charges');
      }
      if (depositHasAmount && glAccounts.length > 0 && !depositGlAccountId) {
        throw new Error('Select a GL account for security deposits');
      }

      const leaseChargesValue = leaseCharges.trim();

      const payload: LeaseCreatePayload = {
        property_id: propertyIdValue,
        unit_id: unitIdValue,
        lease_from_date: from,
        lease_to_date: to || null,
        rent_amount: Number.isFinite(rentAmount) ? rentAmount : null,
        lease_charges: leaseChargesValue ? leaseChargesValue : null,
        security_deposit: Number.isFinite(depositAmount) ? depositAmount : null,
        payment_due_day: paymentDueDayValue,
        unit_number: unit?.unit_number ?? null,
        lease_type: leaseType || 'Fixed',
        send_welcome_email: sendWelcomeEmail,
      };

      const recurringTransactions: RecurringTransactionPayload[] = [];
      if (rentHasAmount && nextDueDate && rentAmount != null) {
        recurringTransactions.push({
          amount: rentAmount,
          memo: rentMemo || 'Rent',
          frequency: rentCycle,
          start_date: nextDueDate,
          gl_account_id: rentGlAccountId || null,
        });
      }
      if (depositHasAmount && depositDate && depositAmount != null) {
        recurringTransactions.push({
          amount: depositAmount,
          memo: depositMemo || 'Security Deposit',
          frequency: 'OneTime',
          start_date: depositDate,
          end_date: depositDate,
          gl_account_id: depositGlAccountId || null,
        });
      }
      // Append any user-added recurring charges
      if (extraRecurring.length) {
        for (const row of extraRecurring) {
          const amt = parseCurrencyValue(row.amount);
          if (!row.start_date || amt == null || !row.gl_account_id) continue;
          recurringTransactions.push({
            amount: amt,
            memo: row.memo || 'Recurring charge',
            frequency: row.frequency,
            start_date: row.start_date,
            gl_account_id: row.gl_account_id,
          });
        }
      }
      if (extraOneTime.length) {
        for (const row of extraOneTime) {
          const amt = parseCurrencyValue(row.amount);
          if (!row.date || amt == null || !row.gl_account_id) continue;
          recurringTransactions.push({
            amount: amt,
            memo: row.memo || 'One-time charge',
            frequency: 'OneTime',
            start_date: row.date,
            end_date: row.date,
            gl_account_id: row.gl_account_id,
          });
        }
      }
      if (recurringTransactions.length) {
        payload.recurring_transactions = recurringTransactions;
      }
      // Also include a rent schedule row for reporting if rent is present
      if (rentHasAmount && rentAmount != null) {
        const mapRentCycleToDb = (v: string): string => {
          switch ((v || '').toLowerCase()) {
            case 'weekly':
              return 'Weekly';
            case 'biweekly':
              return 'Every2Weeks';
            case 'quarterly':
              return 'Quarterly';
            case 'annually':
            case 'annual':
              return 'Yearly';
            case 'every2months':
              return 'Every2Months';
            case 'daily':
              return 'Daily';
            case 'every6months':
              return 'Every6Months';
            default:
              return 'Monthly';
          }
        };
        const scheduleStart = nextDueDate || from || null;
        const scheduleEnd = to || null;
        const scheduleStatus = (() => {
          const start = scheduleStart || '';
          if (!start) return 'Current';
          const startDate = new Date(`${start}T00:00:00`);
          if (Number.isNaN(startDate.getTime())) return 'Current';
          const today = new Date();
          const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          return startDate > todayMidnight ? 'Future' : 'Current';
        })();
        payload.rent_schedules = [
          {
            start_date: scheduleStart,
            end_date: scheduleEnd,
            total_amount: rentAmount,
            rent_cycle: mapRentCycleToDb(rentCycle),
            status: scheduleStatus,
            backdate_charges: false,
          },
        ];
      }
      if (prorateFirstMonth && firstProrationAmount != null && firstProrationAmount > 0) {
        payload.prorated_first_month_rent = firstProrationAmount;
      }
      if (prorateLastMonth && lastProrationAmount != null && lastProrationAmount > 0) {
        payload.prorated_last_month_rent = lastProrationAmount;
      }

      if (pendingCosigners.length || pendingTenants.length) {
        const staged: Array<StagedPerson & { role: string }> = [
          ...pendingTenants.map((tenant) => ({ ...tenant, role: 'Tenant' })),
          ...pendingCosigners.map((cosigner) => ({ ...cosigner, role: 'Cosigner' })),
        ];
        payload.new_people = staged.map((person) => ({
          first_name: person.first_name,
          last_name: person.last_name,
          role: person.role,
          email: person.email ?? null,
          phone: person.phone ?? null,
          alt_email: person.alt_email ?? null,
          alt_phone: person.alt_phone ?? null,
          same_as_unit: person.same_as_unit ?? person.same_as_unit_address ?? true,
          same_as_unit_address: person.same_as_unit ?? person.same_as_unit_address ?? true,
          addr1: person.address_line1 ?? person.addr1 ?? null,
          addr2: person.address_line2 ?? person.addr2 ?? null,
          city: person.city ?? null,
          state: person.state ?? null,
          postal: person.postal_code ?? null,
          country: person.country ?? null,
          alt_addr1: person.alt_address_line1 ?? person.alt_addr1 ?? null,
          alt_addr2: person.alt_address_line2 ?? person.alt_addr2 ?? null,
          alt_city: person.alt_city ?? null,
          alt_state: person.alt_state ?? null,
          alt_postal: person.alt_postal_code ?? person.alt_postal ?? null,
          alt_country: person.alt_country ?? null,
        }));
      }

      if (selectedExistingTenantIds.length) {
        const contacts: LeaseContactPayload[] = selectedExistingTenantIds.map((id) => ({
          tenant_id: id,
          role: 'Tenant',
          is_rent_responsible: true,
        }));
        payload.contacts = contacts;
      }

      const endpoint = syncToBuildium ? '/api/leases?syncBuildium=true' : '/api/leases';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          syncBuildium: syncToBuildium,
          send_welcome_email: sendWelcomeEmail,
        }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        console.error('Lease create failed:', json);
        const errorMessage =
          typeof json === 'object' &&
          json &&
          'error' in json &&
          typeof (json as { error?: unknown }).error === 'string'
            ? (json as { error: string }).error
            : 'Failed to create lease';
        throw new Error(errorMessage);
      }

      const leaseIdNumber = extractLeaseIdFromLeaseResponse(json);

      if (Number.isFinite(leaseIdNumber)) {
        setCreatedLeaseId(Number(leaseIdNumber));
      }

      if (Number.isFinite(leaseIdNumber) && pendingLeaseFiles.length) {
        const uploadResults = await uploadLeaseFiles(Number(leaseIdNumber), pendingLeaseFiles);
        const failedUploads = uploadResults.filter((result) => !result.success);
        if (failedUploads.length > 0) {
          setError('Lease saved, but some documents failed to upload. Please review and retry.');
          return;
        }
        await finalizeLease();
        return;
      }

      await finalizeLease();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create lease');
    } finally {
      setSaving(false);
    }
  }

  // Search existing tenants/applicants by contact first/last/email
  useEffect(() => {
    if (!showAddTenant || !chooseExisting) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const supa = getSupabaseBrowserClient();
        let query = supa
          .from('tenants')
          .select('id, contact_id, contacts:contact_id ( first_name, last_name, primary_email )')
          .limit(10);
        const term = search.trim();
        if (term) {
          const like = `%${term}%`;
          // Filter on related contacts table fields
          query = query.or(
            `first_name.ilike.${like},last_name.ilike.${like},primary_email.ilike.${like}`,
            { foreignTable: 'contacts' },
          );
        }
        const { data } = await query.returns<TenantSearchRow[]>();
        if (!cancelled) {
          const mapped = (data || []).map<TenantOption>((row) => {
            const nameParts = [row.contacts?.first_name, row.contacts?.last_name].filter(
              (part): part is string => Boolean(part),
            );
            const fullName = nameParts.join(' ') || 'Unnamed';
            return {
              id: String(row.id),
              name: fullName,
              email: row.contacts?.primary_email ?? null,
            };
          });
          setResults(mapped);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [showAddTenant, chooseExisting, search]);

  // Compute first-month proration when toggled or dependencies change
  useEffect(() => {
    if (!prorateFirstMonth || !from || !rent) {
      setFirstProrationDays(0);
      setFirstProrationAmount(null);
      return;
    }
    const start = new Date(from + 'T00:00:00');
    const startDay = start.getDate();
    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    if (startDay <= 1) {
      setFirstProrationDays(0);
      setFirstProrationAmount(null);
      return;
    }
    const days = daysInMonth - startDay + 1;
    const monthly = parseCurrencyValue(rent) ?? 0;
    const amount = monthly * (days / daysInMonth);
    setFirstProrationDays(days);
    setFirstProrationAmount(Number(amount.toFixed(2)));
  }, [prorateFirstMonth, from, rent]);

  // Compute last-month proration when toggled or dependencies change
  useEffect(() => {
    if (!prorateLastMonth || !to || !rent) {
      setLastProrationDays(0);
      setLastProrationAmount(null);
      return;
    }
    const end = new Date(to + 'T00:00:00');
    const endDay = end.getDate();
    const daysInMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
    if (endDay >= daysInMonth) {
      setLastProrationDays(0);
      setLastProrationAmount(null);
      return;
    }
    const days = endDay; // inclusive days occupied in last month
    const monthly = parseCurrencyValue(rent) ?? 0;
    const amount = monthly * (days / daysInMonth);
    setLastProrationDays(days);
    setLastProrationAmount(Number(amount.toFixed(2)));
  }, [prorateLastMonth, to, rent]);

  // Reset proration toggles if section should be hidden
  useEffect(() => {
    const rentNum = parseCurrencyValue(rent) ?? 0;
    const start = from ? new Date(from + 'T00:00:00') : null;
    const end = to ? new Date(to + 'T00:00:00') : null;
    const showFirst = !!start && start.getDate() > 1;
    let showLast = false;
    if (end) {
      const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
      showLast = end.getDate() < lastDay;
    }
    const shouldShow = rentNum > 0 && (showFirst || showLast);
    if (!shouldShow) {
      if (prorateFirstMonth) setProrateFirstMonth(false);
      if (prorateLastMonth) setProrateLastMonth(false);
      setFirstProrationDays(0);
      setFirstProrationAmount(null);
      setLastProrationDays(0);
      setLastProrationAmount(null);
    }
  }, [rent, from, to, prorateFirstMonth, prorateLastMonth]);

  useEffect(() => {
    const prev = prevStartDateRef.current;
    if (from) {
      if (!nextDueDate || nextDueDate === prev) setNextDueDate(from);
      if (!depositDate || depositDate === prev) setDepositDate(from);
    }
    prevStartDateRef.current = from;
  }, [from, nextDueDate, depositDate]);

  useEffect(() => {
    if (paymentDueDay || !nextDueDate) return;
    const parsed = new Date(`${nextDueDate}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      setPaymentDueDay(String(parsed.getDate()));
    }
  }, [nextDueDate, paymentDueDay]);

  const describeGlAccount = (account: GlAccountOption) => account.name || 'Account';

  const incomeAccounts = glAccounts.filter((acc) => (acc.type ?? '').toLowerCase() === 'income');
  const rentAccountOptions = incomeAccounts.map((acc) => ({
    value: acc.id,
    label: describeGlAccount(acc),
  }));
  const depositSource = glAccounts.filter((acc) => acc.is_security_deposit_liability);
  const depositAccountOptions = (depositSource.length ? depositSource : glAccounts).map((acc) => ({
    value: acc.id,
    label: describeGlAccount(acc),
  }));
  const rentAccountPlaceholder = glAccountsLoading
    ? 'Loading accounts…'
    : rentAccountOptions.length
      ? 'Select account'
      : 'No income accounts found';
  const requiresRentAccount = rentAccountOptions.length > 0;
  const showRentAccountEmptyState = !requiresRentAccount && !glAccountsLoading && !glAccountsError;
  const depositAccountPlaceholder = glAccountsLoading
    ? 'Loading accounts…'
    : depositAccountOptions.length
      ? 'Select account'
      : 'No GL accounts found';
  const paymentDueDayOptions = Array.from({ length: 31 }, (_, idx) => {
    const day = idx + 1;
    return { value: String(day), label: `${day}` };
  });
  // Hide property/unit selectors when the modal is scoped to a specific unit
  const hidePropertyUnitFields =
    property?.id !== undefined &&
    property?.id !== null &&
    unit?.id !== undefined &&
    unit?.id !== null;
  const rentGridClass =
    'grid grid-cols-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,12rem)_max-content_max-content_minmax(0,16rem)] gap-3';
  // Security deposit defaults come from org settings; keep them but hide account/memo controls in this modal
  const hideDepositAccountMemoFields = true;
  const depositGridClass = hideDepositAccountMemoFields
    ? 'grid grid-cols-1 sm:grid-cols-[minmax(0,14rem)_max-content] gap-3'
    : 'grid grid-cols-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,12rem)_max-content_minmax(0,16rem)] gap-3';

  return (
    <section className="relative">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-foreground text-base font-semibold">Leases</h3>
        <AddLink onClick={navigateToAddLease} aria-label="Add lease" />
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Start - End</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Rent</TableHead>
              <TableHead className="w-[50px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!leases || leases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground text-sm">
                  You don't have any leases for this unit right now.
                </TableCell>
              </TableRow>
            ) : (
              leases.map((lease) => (
                <TableRow
                  key={lease.id}
                  className="hover:bg-muted cursor-pointer"
                  onClick={() => {
                    if (lease?.id != null) window.location.href = `/leases/${lease.id}`;
                  }}
                >
                  <TableCell className="text-foreground text-sm">{lease.status || '—'}</TableCell>
                  <TableCell className="text-foreground text-sm">
                    <span>
                      {fmt(lease.lease_from_date)} – {fmt(lease.lease_to_date)}
                    </span>
                  </TableCell>
                  <TableCell className="text-foreground text-sm">
                    {lease.tenant_name ? (
                      <span className="text-foreground">{lease.tenant_name}</span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-foreground text-sm">
                    {fmtUsd(lease.rent_amount)}
                  </TableCell>
                  <TableCell className="text-foreground text-sm">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <ActionButton onClick={(e) => e.stopPropagation()} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `/leases/${lease.id}`;
                          }}
                        >
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            syncLease(String(lease.id));
                          }}
                          disabled={syncingLeaseId === String(lease.id)}
                        >
                          {syncingLeaseId === String(lease.id)
                            ? 'Syncing…'
                            : lease.buildium_lease_id
                              ? 'Re-sync'
                              : 'Sync to Buildium'}
                        </DropdownMenuItem>
                        {lease.buildium_lease_id && (
                          <>
                            <DropdownMenuSeparator />
                            <div className="text-muted-foreground px-2 py-1.5 text-xs">
                              Buildium ID: {lease.buildium_lease_id}
                            </div>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {leaseSyncError?.id === String(lease.id) ? (
                      <p className="text-destructive mt-1 text-xs">{leaseSyncError.message}</p>
                    ) : null}
                    {lease.last_sync_error ? (
                      <p className="text-destructive mt-1 text-xs">
                        Last error: {lease.last_sync_error}
                      </p>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeLeaseDialog();
        }}
      >
        <FullscreenDialogContent className="bg-background text-foreground">
          <DialogTitle className="sr-only">Add lease</DialogTitle>
          <div className="flex flex-col gap-0">
            <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
              <div className="space-y-1">
                <div className="text-xl font-semibold">Add lease</div>
                {pendingCosigners.length > 0 && (
                  <div className="text-muted-foreground text-xs">
                    {pendingCosigners.length} cosigner{pendingCosigners.length > 1 ? 's' : ''} added
                  </div>
                )}
              </div>
              <label className="text-foreground mr-2 flex items-center gap-2 text-xs select-none">
                <Checkbox
                  id="syncBuildiumOnSave"
                  checked={syncToBuildium}
                  onCheckedChange={(v) => setSyncToBuildium(Boolean(v))}
                />
                <span>Sync to Buildium on save</span>
              </label>
            </div>
            <div className="min-h-[320px] overflow-y-auto px-6 pb-8 pt-6">
              <div className="mx-auto max-w-5xl space-y-6">
            {/* Lease details (Property, Unit, Type, Dates) */}
            <div>
              <h3 className="text-foreground mb-4 text-sm font-semibold">Lease details</h3>
              <div className="w-full">
                {/* Row 1: Property + Unit (compact widths) */}
                {!hidePropertyUnitFields && (
                  <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(20rem,40rem)_max-content]">
                    <div className="w-full sm:justify-self-start">
                      <label className="mb-1 block text-xs">Property *</label>
                      <Dropdown
                        value={propertyId}
                        onChange={(v) => {
                          setPropertyId(v);
                          /* reset unit selection when property changes */ setUnitId('');
                        }}
                        options={(properties.length
                          ? properties
                          : property
                            ? [{ id: String(property.id), name: property.name || 'Property' }]
                            : []
                        ).map((p) => ({ value: String(p.id), label: p.name }))}
                        placeholder="Select property"
                        className="max-w-full sm:w-[40rem]"
                      />
                    </div>
                    <div className="w-full sm:w-auto sm:justify-self-start">
                      <label className="mb-1 block text-xs">Unit</label>
                      <Dropdown
                        value={unitId}
                        onChange={setUnitId}
                        options={(units.length
                          ? units
                          : unit
                            ? [{ id: String(unit.id), unit_number: unit.unit_number ?? 'Unit' }]
                            : []
                        ).map((u) => ({ value: String(u.id), label: u.unit_number || 'Unit' }))}
                        placeholder="Select unit"
                        className="sm:w-32"
                      />
                    </div>
                  </div>
                )}
                {/* Row 2: Lease Type + Dates (compact date inputs) */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[max-content_max-content_max-content]">
                  <div className="w-full sm:w-64">
                    <label className="mb-1 block text-xs">Lease Type *</label>
                    <Dropdown
                      value={leaseType}
                      onChange={setLeaseType}
                      options={[
                        { value: 'Fixed', label: 'Fixed' },
                        { value: 'FixedWithRollover', label: 'Fixed w/rollover' },
                        { value: 'AtWill', label: 'At-will (month-to-month)' },
                      ]}
                      placeholder="Select"
                    />
                  </div>
                  <div className="w-full sm:w-fit sm:justify-self-start">
                    <label className="mb-1 block text-xs">Start date *</label>
                    <DateInput
                      value={from}
                      onChange={(nextValue) => {
                        setFrom(nextValue);
                        if (nextValue) {
                          const d = new Date(`${nextValue}T00:00:00`);
                          const d2 = new Date(d.getTime() + 365 * 24 * 3600 * 1000);
                          d2.setDate(d2.getDate() - 1);
                          const iso = d2.toISOString().slice(0, 10);
                          setTo(iso);
                        }
                      }}
                      containerClassName="sm:w-fit sm:max-w-[12rem] sm:min-w-[9.5rem]"
                    />
                  </div>
                  <div className="w-full sm:w-fit sm:justify-self-start">
                    <label className="mb-1 block text-xs">End date</label>
                    <DateInput
                      value={to}
                      onChange={setTo}
                      containerClassName="sm:w-fit sm:max-w-[12rem] sm:min-w-[9.5rem]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Lease contacts */}
            <div className="border-border bg-muted/30 rounded-md border p-4">
              <h3 className="text-foreground mb-3 text-sm font-semibold">Lease Contacts</h3>
              <button
                type="button"
                className="text-primary inline-flex items-center gap-2 text-sm underline"
                onClick={() => setShowAddTenant(true)}
              >
                <Plus className="text-muted-foreground h-4 w-4" />
                Add tenant or cosigner
              </button>
              {(pendingTenants.length > 0 || pendingCosigners.length > 0) && (
                <div className="mt-3 space-y-2">
                  {pendingTenants.map((t, idx) => (
                    <div
                      key={`pt-${idx}`}
                      className="flex items-center justify-between rounded-md border px-4 py-3"
                    >
                      <div className="flex items-center gap-6">
                        <div className="text-primary bg-muted flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold">
                          {(t.first_name?.[0] || '').toUpperCase()}
                          {(t.last_name?.[0] || '').toUpperCase()}
                        </div>
                        <div className="grid grid-cols-3 gap-6 text-sm">
                          <div>
                            <div className="text-muted-foreground text-xs uppercase">Tenant</div>
                            <div className="text-foreground">
                              {t.first_name} {t.last_name}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs uppercase">
                              Email address
                            </div>
                            <div className="text-foreground">{t.email || '—'}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs uppercase">
                              Mobile phone
                            </div>
                            <div className="text-foreground">{t.phone || '—'}</div>
                          </div>
                        </div>
                      </div>
                      <button
                        className="text-muted-foreground"
                        onClick={() =>
                          setPendingTenants((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {pendingCosigners.map((t, idx) => (
                    <div
                      key={`pc-${idx}`}
                      className="flex items-center justify-between rounded-md border px-4 py-3"
                    >
                      <div className="flex items-center gap-6">
                        <div className="text-primary bg-muted flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold">
                          {(t.first_name?.[0] || '').toUpperCase()}
                          {(t.last_name?.[0] || '').toUpperCase()}
                        </div>
                        <div className="grid grid-cols-3 gap-6 text-sm">
                          <div>
                            <div className="text-muted-foreground text-xs uppercase">Cosigner</div>
                            <div className="text-foreground">
                              {t.first_name} {t.last_name}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs uppercase">
                              Email address
                            </div>
                            <div className="text-foreground">{t.email || '—'}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs uppercase">
                              Mobile phone
                            </div>
                            <div className="text-foreground">{t.phone || '—'}</div>
                          </div>
                        </div>
                      </div>
                      <button
                        className="text-muted-foreground"
                        onClick={() =>
                          setPendingCosigners((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section separator removed – using bordered cards instead */}

            {/* Rent */}
            <div>
              <h3 className="text-foreground mb-3 text-sm font-semibold">
                Rent <span className="text-muted-foreground font-normal">(optional)</span>
              </h3>
              {glAccountsError ? (
                <p className="text-destructive mb-2 text-xs">
                  Failed to load GL accounts: {glAccountsError}
                </p>
              ) : null}
              <div className="mb-4 sm:w-64">
                <label className="mb-1 block text-xs">Rent cycle</label>
                <Dropdown
                  value={rentCycle}
                  onChange={(value) => setRentCycle(value as RentFrequency)}
                  options={[
                    { value: 'Monthly', label: 'Monthly' },
                    { value: 'Weekly', label: 'Weekly' },
                    { value: 'Biweekly', label: 'Biweekly' },
                    { value: 'Quarterly', label: 'Quarterly' },
                    { value: 'Annually', label: 'Annually' },
                  ]}
                />
              </div>
              <div className="overflow-hidden rounded-lg border border-blue-200 bg-blue-50/30">
                <div className="border-l-4 border-l-blue-500 px-4 py-3">
                  <div className={rentGridClass}>
                    <div>
                      <label className="mb-1 block text-xs">Amount</label>
                      <Input
                        inputMode="decimal"
                        placeholder="$0.00"
                        value={rent}
                        className="sm:w-[14rem]"
                        onChange={(e) => {
                          const value = e.target.value;
                          setRent(value);
                          if (!depositTouched) {
                            setDepositAmt(value);
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs">
                        {requiresRentAccount ? 'Account *' : 'Account (optional)'}
                      </label>
                      <Dropdown
                        value={rentGlAccountId}
                        onChange={setRentGlAccountId}
                        options={rentAccountOptions}
                        placeholder={rentAccountPlaceholder}
                        className="sm:w-[12rem]"
                      />
                      {showRentAccountEmptyState ? (
                        <p className="text-muted-foreground mt-1 text-xs">
                          No income GL accounts available. Rent will be saved without linking an
                          account.
                        </p>
                      ) : null}
                    </div>
                    <div className="w-full sm:w-fit sm:justify-self-start">
                      <label className="mb-1 block text-xs">Next due date *</label>
                      <DateInput
                        value={nextDueDate}
                        onChange={setNextDueDate}
                        placeholder="m/d/yyyy"
                        containerClassName="sm:w-fit sm:max-w-[12rem] sm:min-w-[9.5rem]"
                      />
                    </div>
                    <div className="w-full sm:w-fit sm:justify-self-start">
                      <label className="mb-1 block text-xs">Due day *</label>
                      <Dropdown
                        value={paymentDueDay}
                        onChange={(value) => setPaymentDueDay(String(value))}
                        options={paymentDueDayOptions}
                        placeholder="Select"
                        className="sm:w-[8rem]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs">Memo</label>
                      <Input
                        placeholder={'If left blank, will show "Rent"'}
                        value={rentMemo}
                        onChange={(e) => setRentMemo(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section separator removed – using bordered cards instead */}

            {/* Rent proration */}
            {(function () {
              const start = from ? new Date(from + 'T00:00:00') : null;
              const end = to ? new Date(to + 'T00:00:00') : null;
              const showFirst = !!start && start.getDate() > 1;
              let showLast = false;
              if (end) {
                const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
                showLast = end.getDate() < lastDay;
              }
              const rentNum = parseCurrencyValue(rent) ?? 0;
              if (!(rentNum > 0) || (!showFirst && !showLast)) return null;
              return (
                <div className="border-border bg-muted/30 rounded-md border p-4">
                  <h3 className="text-foreground mb-3 text-sm font-semibold">Rent proration</h3>
                  <div className="flex items-start gap-10">
                    {showFirst && (
                      <div>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={prorateFirstMonth}
                            onCheckedChange={(v) => setProrateFirstMonth(Boolean(v))}
                          />
                          Prorate first month's rent
                        </label>
                        {prorateFirstMonth && (
                          <div className="mt-3 sm:w-64">
                            <label className="mb-1 block text-xs">
                              First month's rent ({firstProrationDays} days)
                            </label>
                            <Input
                              readOnly
                              value={
                                firstProrationAmount != null ? fmtUsd(firstProrationAmount) : ''
                              }
                            />
                          </div>
                        )}
                      </div>
                    )}
                    {showLast && (
                      <div>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={prorateLastMonth}
                            onCheckedChange={(v) => setProrateLastMonth(Boolean(v))}
                          />
                          Prorate last month's rent
                        </label>
                        {prorateLastMonth && (
                          <div className="mt-3 sm:w-64">
                            <label className="mb-1 block text-xs">
                              Last month's rent ({lastProrationDays} days)
                            </label>
                            <Input
                              readOnly
                              value={lastProrationAmount != null ? fmtUsd(lastProrationAmount) : ''}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Section separator removed – using bordered cards instead */}

            {/* Security deposit */}
            <div>
              <h3 className="text-foreground mb-3 text-sm font-semibold">
                Security deposit{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </h3>
              <div className="overflow-hidden rounded-lg border border-blue-200 bg-blue-50/30">
                <div className="border-l-4 border-l-blue-500 px-4 py-3">
                  <div className={depositGridClass}>
                    <div>
                      <label className="mb-1 block text-xs">Amount</label>
                      <Input
                        inputMode="decimal"
                        placeholder="$0.00"
                        value={depositAmt}
                        className="sm:w-[14rem]"
                        onChange={(e) => {
                          setDepositTouched(true);
                          setDepositAmt(e.target.value);
                        }}
                      />
                    </div>
                    {!hideDepositAccountMemoFields && (
                      <div>
                        <label className="mb-1 block text-xs">Account *</label>
                        <Dropdown
                          value={depositGlAccountId}
                          onChange={setDepositGlAccountId}
                          options={depositAccountOptions}
                          placeholder={depositAccountPlaceholder}
                          className="sm:w-[12rem]"
                        />
                      </div>
                    )}
                    <div className="w-full sm:w-fit sm:justify-self-start">
                      <label className="mb-1 block text-xs">Next due date *</label>
                      <DateInput
                        value={depositDate}
                        onChange={setDepositDate}
                        placeholder="m/d/yyyy"
                        containerClassName="sm:w-fit sm:max-w-[12rem] sm:min-w-[9.5rem]"
                      />
                    </div>
                    {!hideDepositAccountMemoFields && (
                      <div>
                        <label className="mb-1 block text-xs">Memo</label>
                        <Input
                          placeholder="Optional memo"
                          value={depositMemo}
                          onChange={(e) => setDepositMemo(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-muted-foreground mt-2 text-xs">
                Don't forget to record the payment once you have collected the deposit.
              </p>
            </div>

            {/* Section separator removed – using bordered cards instead */}

            {/* Charges */}
            <div className="border-border bg-muted/30 rounded-md border p-4">
              <h3 className="text-foreground mb-3 text-sm font-semibold">
                Charges <span className="text-muted-foreground font-normal">(optional)</span>
              </h3>
              <p className="text-muted-foreground mb-4 text-sm">
                Create charges for tenants that are part of this lease
              </p>

              <div className="space-y-3">
                {extraRecurring.map((row, idx) => (
                  <div key={`rc-${idx}`} className="overflow-hidden rounded-md border">
                    <div className="border-l-4 border-l-blue-500 px-4 py-3">
                      <div className="flex items-start justify-between">
                        <div className="text-foreground mb-2 text-sm font-medium">Recurring</div>
                        <button
                          type="button"
                          aria-label="Remove recurring charge"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            setExtraRecurring((prev) => prev.filter((_, i) => i !== idx))
                          }
                        >
                          ×
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,12rem)_minmax(0,9rem)_minmax(0,16rem)]">
                        <div>
                          <label className="mb-1 block text-xs">Account *</label>
                          <Dropdown
                            value={row.gl_account_id}
                            onChange={(v) =>
                              setExtraRecurring((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, gl_account_id: String(v) } : r,
                                ),
                              )
                            }
                            options={groupGlAccounts(
                              glAccounts.map((acc) => ({
                                id: acc.id,
                                label: describeGlAccount(acc),
                                type: acc.type ?? null,
                              })),
                            ).map((g) => ({
                              label: g.label,
                              options: g.accounts.map((a) => ({ value: a.id, label: a.label })),
                            }))}
                            placeholder={
                              glAccountsLoading
                                ? 'Loading accounts…'
                                : glAccounts.length
                                  ? 'Select'
                                  : 'No GL accounts found'
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs">Next due date *</label>
                          <DateInput
                            value={row.start_date}
                            onChange={(nextValue) =>
                              setExtraRecurring((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, start_date: nextValue } : r,
                                ),
                              )
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs">Amount</label>
                          <Input
                            placeholder="$0.00"
                            value={row.amount}
                            onChange={(e) =>
                              setExtraRecurring((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, amount: e.target.value } : r,
                                ),
                              )
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs">Memo</label>
                          <Input
                            placeholder="Optional memo"
                            value={row.memo}
                            onChange={(e) =>
                              setExtraRecurring((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, memo: e.target.value } : r,
                                ),
                              )
                            }
                          />
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,16rem)]">
                        <div>
                          <label className="mb-1 block text-xs">Frequency *</label>
                          <Dropdown
                            value={row.frequency}
                            onChange={(v) =>
                              setExtraRecurring((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, frequency: v as RentFrequency } : r,
                                ),
                              )
                            }
                            options={[
                              { value: 'Monthly', label: 'Monthly' },
                              { value: 'Weekly', label: 'Weekly' },
                              { value: 'Biweekly', label: 'Biweekly' },
                              { value: 'Quarterly', label: 'Quarterly' },
                              { value: 'Annually', label: 'Annually' },
                            ]}
                            placeholder="Select"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 space-y-3">
                {extraOneTime.map((row, idx) => (
                  <div key={`ot-${idx}`} className="overflow-hidden rounded-md border">
                    <div className="border-l-4 border-l-blue-500 px-4 py-3">
                      <div className="flex items-start justify-between">
                        <div className="text-foreground mb-2 text-sm font-medium">One-time</div>
                        <button
                          type="button"
                          aria-label="Remove one-time charge"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            setExtraOneTime((prev) => prev.filter((_, i) => i !== idx))
                          }
                        >
                          ×
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,12rem)_minmax(0,9rem)_minmax(0,1fr)]">
                        <div>
                          <label className="mb-1 block text-xs">Account *</label>
                          <Dropdown
                            value={row.gl_account_id}
                            onChange={(v) =>
                              setExtraOneTime((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, gl_account_id: String(v) } : r,
                                ),
                              )
                            }
                            options={groupGlAccounts(
                              glAccounts.map((acc) => ({
                                id: acc.id,
                                label: describeGlAccount(acc),
                                type: acc.type ?? null,
                              })),
                            ).map((g) => ({
                              label: g.label,
                              options: g.accounts.map((a) => ({ value: a.id, label: a.label })),
                            }))}
                            placeholder={
                              glAccountsLoading
                                ? 'Loading accounts…'
                                : glAccounts.length
                                  ? 'Select'
                                  : 'No GL accounts found'
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs">Due date *</label>
                          <DateInput
                            value={row.date}
                            onChange={(nextValue) =>
                              setExtraOneTime((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, date: nextValue } : r)),
                              )
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs">Amount</label>
                          <Input
                            placeholder="$0.00"
                            value={row.amount}
                            onChange={(e) =>
                              setExtraOneTime((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, amount: e.target.value } : r,
                                ),
                              )
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs">Memo</label>
                          <Input
                            placeholder="Optional memo"
                            value={row.memo}
                            onChange={(e) =>
                              setExtraOneTime((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, memo: e.target.value } : r,
                                ),
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-primary mt-3 flex items-center gap-4 text-sm">
                <button
                  type="button"
                  className="underline"
                  onClick={() =>
                    setExtraRecurring((prev) => [
                      ...prev,
                      {
                        gl_account_id: glAccounts[0]?.id || '',
                        frequency: 'Monthly',
                        start_date: from || '',
                        amount: '',
                        memo: '',
                      },
                    ])
                  }
                >
                  + Add recurring charge
                </button>
                <span className="text-muted-foreground">|</span>
                <button
                  type="button"
                  className="underline"
                  onClick={() =>
                    setExtraOneTime((prev) => [
                      ...prev,
                      {
                        gl_account_id: glAccounts[0]?.id || '',
                        date: from || '',
                        amount: '',
                        memo: '',
                      },
                    ])
                  }
                >
                  + Add one-time charge
                </button>
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-xs">Lease Charges</label>
                <textarea
                  value={leaseCharges}
                  onChange={(e) => setLeaseCharges(e.target.value)}
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/40 min-h-[100px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                  placeholder="Describe recurring or one-time charges beyond base rent…"
                />
              </div>
            </div>

            {/* Section separator removed – using bordered cards instead */}

            {/* Lease documents */}
            <div className="border-border bg-muted/30 rounded-md border p-4">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-foreground text-sm font-medium">
                    Lease documents{' '}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    Upload up to 10 documents (PDF or images). Files upload automatically once the
                    lease is saved.
                  </p>
                </div>
                {pendingLeaseFiles.length ? (
                  <span className="text-muted-foreground text-xs">
                    {pendingLeaseFiles.length} file{pendingLeaseFiles.length === 1 ? '' : 's'}{' '}
                    attached
                  </span>
                ) : null}
              </div>
              <input
                id="lease-file-input"
                ref={leaseFileInputRef}
                type="file"
                className="sr-only"
                aria-label="Upload lease documents"
                multiple
                accept="application/pdf,image/*"
                onChange={(event) => {
                  handleLeaseFileSelection(event.target.files);
                  if (event.target) event.target.value = '';
                }}
              />
              <label
                htmlFor="lease-file-input"
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ')
                    leaseFileInputRef.current?.click();
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  handleLeaseFileSelection(event.dataTransfer.files);
                }}
                className={`border-muted-foreground/40 bg-muted/40 hover:border-primary hover:text-primary flex h-32 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed text-sm transition ${pendingLeaseFiles.length ? 'bg-background' : ''}`}
              >
                <UploadCloud className="text-muted-foreground mb-2 h-6 w-6" />
                <div className="text-muted-foreground text-center">
                  Drag & drop files here or <span className="underline">Browse</span>
                </div>
              </label>

              {pendingLeaseFiles.length ? (
                <div className="mt-4 space-y-2">
                  {pendingLeaseFiles.map((file) => (
                    <div
                      key={file.id}
                      className="border-border bg-background flex items-start justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="flex flex-col">
                        <span className="text-foreground font-medium break-all">{file.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {formatFileSize(file.size)}
                          {file.status === 'uploading' && ' • Uploading…'}
                          {file.status === 'uploaded' && ' • Uploaded'}
                          {file.status === 'error' && (
                            <>
                              {' • '}
                              <span className="text-destructive">
                                {file.error || 'Upload failed'}
                              </span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {file.status === 'uploading' ? (
                          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                        ) : file.status === 'error' ? (
                          <XCircle className="text-destructive h-4 w-4" />
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            removePendingLeaseFile(file.id);
                          }}
                          disabled={file.status === 'uploading'}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground mt-3 text-xs">
                  Supported formats include PDF and common image types. Maximum size 25 MB per
                  document.
                </p>
              )}
            </div>

            {/* Section separator removed – using bordered cards instead */}

            {/* Welcome email toggle */}
            <div className="border-border bg-muted/30 rounded-md border p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-foreground text-sm font-semibold">
                  Resident Center Welcome Email
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs select-none">
                    {sendWelcomeEmail ? 'ON' : 'OFF'}
                  </span>
                  <Switch
                    checked={sendWelcomeEmail}
                    onCheckedChange={(v) => setSendWelcomeEmail(Boolean(v))}
                  />
                </div>
              </div>
              <p className="text-muted-foreground text-sm">
                We'll send a welcome email to anyone without Resident Center access. Once they sign
                in, they can make online payments, view important documents, submit requests, and
                more!
              </p>
                </div>
                {error ? <div className="text-destructive text-sm">{error}</div> : null}
                <div className="border-border flex flex-col gap-2 border-t pt-6 sm:flex-row sm:items-center sm:justify-start">
                  <Button variant="cancel" size="sm" onClick={closeLeaseDialog}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={save} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </FullscreenDialogContent>
      </Dialog>
      <Dialog open={showAddTenant} onOpenChange={setShowAddTenant}>
        <DialogContent className="w-[680px] max-w-[680px]">
          <DialogHeader>
            <DialogTitle>Add applicant, tenant or cosigner</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Tabs defaultValue="tenant">
              <TabsList className="w-full">
                <TabsTrigger value="tenant" className="flex-1">
                  Applicant/Tenant
                </TabsTrigger>
                <TabsTrigger value="cosigner" className="flex-1">
                  Cosigner
                </TabsTrigger>
              </TabsList>
              <TabsContent value="tenant" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="existing"
                      checked={chooseExisting}
                      onCheckedChange={(v) => setChooseExisting(Boolean(v))}
                    />
                    <label htmlFor="existing" className="text-foreground text-sm">
                      Choose existing tenant or applicant
                    </label>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {selectedExistingTenantIds.length} selected
                  </div>
                </div>

                {chooseExisting && (
                  <div className="space-y-2">
                    <Input
                      placeholder="Search by name or email…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <div className="overflow-hidden rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Type</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {!results.length && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-muted-foreground text-sm">
                                {searching ? 'Searching…' : 'No results'}
                              </TableCell>
                            </TableRow>
                          )}
                          {results.map((r) => {
                            const checked = selectedExistingTenantIds.includes(r.id);
                            return (
                              <TableRow
                                key={r.id}
                                className="cursor-pointer"
                                onClick={() => {
                                  setSelectedExistingTenantIds((prev) =>
                                    checked ? prev.filter((x) => x !== r.id) : [...prev, r.id],
                                  );
                                }}
                              >
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(v) => {
                                      setSelectedExistingTenantIds((prev) =>
                                        Boolean(v)
                                          ? Array.from(new Set([...prev, r.id]))
                                          : prev.filter((x) => x !== r.id),
                                      );
                                    }}
                                  />
                                </TableCell>
                                <TableCell className="text-primary text-sm underline">
                                  {r.name}
                                </TableCell>
                                <TableCell className="text-sm">{r.email || '—'}</TableCell>
                                <TableCell className="text-sm">Tenant</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex items-center justify-start gap-2">
                      <Button
                        size="sm"
                        onClick={() => setShowAddTenant(false)}
                        disabled={!selectedExistingTenantIds.length}
                      >
                        Add tenant
                      </Button>
                      <Button variant="cancel" size="sm" onClick={() => setShowAddTenant(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {!chooseExisting && (
                  <div className="overflow-hidden rounded-md border">
                    <div className="bg-muted px-4 py-2 text-sm font-medium">
                      Contact information
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs">First name *</label>
                          <Input
                            placeholder="First name"
                            value={tenantFirstName}
                            onChange={(e) => setTenantFirstName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs">Last name *</label>
                          <Input
                            placeholder="Last name"
                            value={tenantLastName}
                            onChange={(e) => setTenantLastName(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs">Mobile phone number</label>
                          <Input
                            placeholder="(555) 555-5555"
                            value={tenantPhone}
                            onChange={(e) => setTenantPhone(e.target.value)}
                          />
                        </div>
                        <div className="flex items-end">
                          {!showAltPhone ? (
                            <button
                              type="button"
                              onClick={() => setShowAltPhone(true)}
                              className="text-primary text-sm underline"
                            >
                              + Add alternate phone
                            </button>
                          ) : (
                            <div className="w-full">
                              <label className="mb-1 block text-xs">Alternate phone</label>
                              <div className="flex items-center gap-2">
                                <Input
                                  placeholder="(555) 555-1234"
                                  value={altPhone}
                                  onChange={(e) => setAltPhone(e.target.value)}
                                />
                                <button
                                  type="button"
                                  className="text-primary text-sm whitespace-nowrap underline"
                                  onClick={() => {
                                    setShowAltPhone(false);
                                    setAltPhone('');
                                  }}
                                >
                                  × Remove
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs">Email</label>
                          <Input
                            type="email"
                            placeholder="name@email.com"
                            value={tenantEmail}
                            onChange={(e) => setTenantEmail(e.target.value)}
                          />
                        </div>
                        <div className="flex items-end">
                          {!showAltEmail ? (
                            <button
                              type="button"
                              onClick={() => setShowAltEmail(true)}
                              className="text-primary text-sm underline"
                            >
                              + Add alternate email
                            </button>
                          ) : (
                            <div className="w-full">
                              <label className="mb-1 block text-xs">Alternate email</label>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="email"
                                  placeholder="alt@email.com"
                                  value={altEmail}
                                  onChange={(e) => setAltEmail(e.target.value)}
                                />
                                <button
                                  type="button"
                                  className="text-primary text-sm whitespace-nowrap underline"
                                  onClick={() => {
                                    setShowAltEmail(false);
                                    setAltEmail('');
                                  }}
                                >
                                  × Remove
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!chooseExisting && (
                  <div className="overflow-hidden rounded-md border">
                    <div className="bg-muted px-4 py-2 text-sm font-medium">Address *</div>
                    <div className="space-y-3 p-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="sameaddr"
                          checked={sameAsUnitAddress}
                          onCheckedChange={(v) => setSameAsUnitAddress(Boolean(v))}
                        />
                        <label htmlFor="sameaddr" className="text-sm">
                          Same as unit address
                        </label>
                      </div>
                      {!sameAsUnitAddress && (
                        <div className="space-y-3">
                          <div>
                            <label className="mb-1 block text-xs">Street Address *</label>
                            <Input
                              value={addr1}
                              onChange={(e) => setAddr1(e.target.value)}
                              placeholder="e.g., 123 Main Street"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs">Address Line 2 (Optional)</label>
                            <Input
                              value={addr2}
                              onChange={(e) => setAddr2(e.target.value)}
                              placeholder="Apartment, suite, unit, building, floor, etc."
                            />
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs">City *</label>
                              <Input
                                value={cityField}
                                onChange={(e) => setCityField(e.target.value)}
                                placeholder="Enter city"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs">State *</label>
                              <Input
                                value={stateField}
                                onChange={(e) => setStateField(e.target.value)}
                                placeholder="Enter state"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs">ZIP Code *</label>
                              <Input
                                value={postalField}
                                onChange={(e) => setPostalField(e.target.value)}
                                placeholder="Enter ZIP code"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs">Country *</label>
                              <Dropdown
                                value={countryField}
                                onChange={setCountryField}
                                options={[
                                  { value: 'United States', label: 'United States' },
                                  { value: 'Canada', label: 'Canada' },
                                  { value: 'Mexico', label: 'Mexico' },
                                ]}
                                placeholder="Select country"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      {!showAltAddress && (
                        <button
                          className="text-primary text-sm underline"
                          type="button"
                          onClick={() => setShowAltAddress(true)}
                        >
                          + Add alternate address
                        </button>
                      )}

                      {showAltAddress && (
                        <div className="mt-3 space-y-3 border-t pt-3">
                          <div className="flex items-center justify-between">
                            <div className="text-foreground text-sm font-medium">
                              Alternate address
                            </div>
                            <button
                              type="button"
                              className="text-primary inline-flex items-center gap-1 text-sm underline"
                              onClick={() => {
                                setShowAltAddress(false);
                                setAltAddr1('');
                                setAltAddr2('');
                                setAltCity('');
                                setAltState('');
                                setAltPostal('');
                                setAltCountry('');
                              }}
                            >
                              <span className="text-muted-foreground">×</span>
                              Remove alternate address
                            </button>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs">Street Address</label>
                            <Input value={altAddr1} onChange={(e) => setAltAddr1(e.target.value)} />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs">Address Line 2 (Optional)</label>
                            <Input value={altAddr2} onChange={(e) => setAltAddr2(e.target.value)} />
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs">City</label>
                              <Input value={altCity} onChange={(e) => setAltCity(e.target.value)} />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs">State</label>
                              <Input
                                value={altState}
                                onChange={(e) => setAltState(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs">ZIP Code</label>
                              <Input
                                value={altPostal}
                                onChange={(e) => setAltPostal(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs">Country</label>
                              <Dropdown
                                value={altCountry}
                                onChange={setAltCountry}
                                options={[
                                  { value: 'United States', label: 'United States' },
                                  { value: 'Canada', label: 'Canada' },
                                  { value: 'Mexico', label: 'Mexico' },
                                ]}
                                placeholder="Select country"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Collapsible sections (default collapsed) */}
                {!chooseExisting && (
                  <Accordion type="multiple" defaultValue={[]} className="space-y-2">
                    <AccordionItem value="personal">
                      <AccordionTrigger className="bg-muted rounded-md px-4">
                        Personal information
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 p-2">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="w-full sm:w-fit sm:justify-self-start">
                              <label className="mb-1 block text-xs">Date of birth</label>
                              <DateInput containerClassName="sm:w-fit sm:max-w-[12rem] sm:min-w-[9.5rem]" />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs">Taxpayer ID</label>
                              <Input placeholder="" />
                            </div>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs">Comments</label>
                            <textarea
                              className="border-border bg-background text-foreground min-h-[96px] w-full rounded-md border p-3 text-sm"
                              placeholder="Enter comments..."
                              aria-label="Comments"
                            />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="emergency">
                      <AccordionTrigger className="bg-muted rounded-md px-4">
                        Emergency contact
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 p-2">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs">Contact name</label>
                              <Input />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs">Relationship to tenant</label>
                              <Input />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs">Email</label>
                              <Input type="email" />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs">Phone</label>
                              <Input />
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
                {!chooseExisting && (
                  <div className="flex items-center justify-start gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!tenantFirstName || !tenantLastName) {
                          alert('First and last name are required');
                          return;
                        }
                        setPendingTenants((prev) => [
                          ...prev,
                          {
                            first_name: tenantFirstName,
                            last_name: tenantLastName,
                            phone: tenantPhone,
                            email: tenantEmail,
                            alt_phone: altPhone,
                            alt_email: altEmail,
                            same_as_unit: sameAsUnitAddress,
                            same_as_unit_address: sameAsUnitAddress,
                            addr1: sameAsUnitAddress ? null : addr1,
                            addr2: sameAsUnitAddress ? null : addr2,
                            address_line1: sameAsUnitAddress ? null : addr1,
                            address_line2: sameAsUnitAddress ? null : addr2,
                            city: sameAsUnitAddress ? null : cityField,
                            state: sameAsUnitAddress ? null : stateField,
                            postal: sameAsUnitAddress ? null : postalField,
                            country: sameAsUnitAddress ? null : countryField,
                            alt_addr1: altAddr1,
                            alt_addr2: altAddr2,
                            alt_address_line1: altAddr1,
                            alt_address_line2: altAddr2,
                            alt_city: altCity,
                            alt_state: altState,
                            alt_postal: altPostal,
                            alt_country: altCountry,
                          },
                        ]);
                        // Reset minimal fields and close
                        setTenantFirstName('');
                        setTenantLastName('');
                        setTenantPhone('');
                        setTenantEmail('');
                        setShowAddTenant(false);
                      }}
                    >
                      Add tenant
                    </Button>
                    <Button variant="cancel" size="sm" onClick={() => setShowAddTenant(false)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="cosigner" className="space-y-4">
                <div className="overflow-hidden rounded-md border">
                  <div className="bg-muted px-4 py-2 text-sm font-medium">Contact information</div>
                  <div className="space-y-3 p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs">First name *</label>
                        <Input
                          placeholder="First name"
                          value={coFirstName}
                          onChange={(e) => setCoFirstName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs">Last name *</label>
                        <Input
                          placeholder="Last name"
                          value={coLastName}
                          onChange={(e) => setCoLastName(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs">Mobile phone number</label>
                        <Input
                          placeholder="(555) 555-5555"
                          value={coPhone}
                          onChange={(e) => setCoPhone(e.target.value)}
                        />
                      </div>
                      <div className="flex items-end">
                        {!coShowAltPhone ? (
                          <button
                            type="button"
                            onClick={() => setCoShowAltPhone(true)}
                            className="text-primary text-sm underline"
                          >
                            + Add alternate phone
                          </button>
                        ) : (
                          <div className="w-full">
                            <label className="mb-1 block text-xs">Alternate phone</label>
                            <div className="flex items-center gap-2">
                              <Input
                                placeholder="(555) 555-1234"
                                value={coAltPhone}
                                onChange={(e) => setCoAltPhone(e.target.value)}
                              />
                              <button
                                type="button"
                                className="text-primary text-sm whitespace-nowrap underline"
                                onClick={() => {
                                  setCoShowAltPhone(false);
                                  setCoAltPhone('');
                                }}
                              >
                                × Remove
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs">Email</label>
                        <Input
                          type="email"
                          placeholder="name@email.com"
                          value={coEmail}
                          onChange={(e) => setCoEmail(e.target.value)}
                        />
                      </div>
                      <div className="flex items-end">
                        {!coShowAltEmail ? (
                          <button
                            type="button"
                            onClick={() => setCoShowAltEmail(true)}
                            className="text-primary text-sm underline"
                          >
                            + Add alternate email
                          </button>
                        ) : (
                          <div className="w-full">
                            <label className="mb-1 block text-xs">Alternate email</label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="email"
                                placeholder="alt@email.com"
                                value={coAltEmail}
                                onChange={(e) => setCoAltEmail(e.target.value)}
                              />
                              <button
                                type="button"
                                className="text-primary text-sm whitespace-nowrap underline"
                                onClick={() => {
                                  setCoShowAltEmail(false);
                                  setCoAltEmail('');
                                }}
                              >
                                × Remove
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-md border">
                  <div className="bg-muted px-4 py-2 text-sm font-medium">Address *</div>
                  <div className="space-y-3 p-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="cosameaddr"
                        checked={coSameAsUnitAddress}
                        onCheckedChange={(v) => setCoSameAsUnitAddress(Boolean(v))}
                      />
                      <label htmlFor="cosameaddr" className="text-sm">
                        Same as unit address
                      </label>
                    </div>
                    {!coSameAsUnitAddress && (
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1 block text-xs">Street Address *</label>
                          <Input
                            value={coAddr1}
                            onChange={(e) => setCoAddr1(e.target.value)}
                            placeholder="e.g., 123 Main Street"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs">Address Line 2 (Optional)</label>
                          <Input
                            value={coAddr2}
                            onChange={(e) => setCoAddr2(e.target.value)}
                            placeholder="Apartment, suite, unit, building, floor, etc."
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs">City *</label>
                            <Input
                              value={coCity}
                              onChange={(e) => setCoCity(e.target.value)}
                              placeholder="Enter city"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs">State *</label>
                            <Input
                              value={coState}
                              onChange={(e) => setCoState(e.target.value)}
                              placeholder="Enter state"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs">ZIP Code *</label>
                            <Input
                              value={coPostal}
                              onChange={(e) => setCoPostal(e.target.value)}
                              placeholder="Enter ZIP code"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs">Country *</label>
                            <Dropdown
                              value={coCountry}
                              onChange={setCoCountry}
                              options={[
                                { value: 'United States', label: 'United States' },
                                { value: 'Canada', label: 'Canada' },
                                { value: 'Mexico', label: 'Mexico' },
                              ]}
                              placeholder="Select country"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    {!coShowAltAddress && (
                      <button
                        className="text-primary text-sm underline"
                        type="button"
                        onClick={() => setCoShowAltAddress(true)}
                      >
                        + Add alternate address
                      </button>
                    )}

                    {coShowAltAddress && (
                      <div className="mt-3 space-y-3 border-t pt-3">
                        <div className="flex items-center justify-between">
                          <div className="text-foreground text-sm font-medium">
                            Alternate address
                          </div>
                          <button
                            type="button"
                            className="text-primary inline-flex items-center gap-1 text-sm underline"
                            onClick={() => {
                              setCoShowAltAddress(false);
                              setCoAltAddr1('');
                              setCoAltAddr2('');
                              setCoAltCity('');
                              setCoAltState('');
                              setCoAltPostal('');
                              setCoAltCountry('');
                            }}
                          >
                            <span className="text-muted-foreground">×</span>
                            Remove alternate address
                          </button>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs">Street Address</label>
                          <Input
                            value={coAltAddr1}
                            onChange={(e) => setCoAltAddr1(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs">Address Line 2 (Optional)</label>
                          <Input
                            value={coAltAddr2}
                            onChange={(e) => setCoAltAddr2(e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs">City</label>
                            <Input
                              value={coAltCity}
                              onChange={(e) => setCoAltCity(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs">State</label>
                            <Input
                              value={coAltState}
                              onChange={(e) => setCoAltState(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs">ZIP Code</label>
                            <Input
                              value={coAltPostal}
                              onChange={(e) => setCoAltPostal(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs">Country</label>
                            <Dropdown
                              value={coAltCountry}
                              onChange={setCoAltCountry}
                              options={[
                                { value: 'United States', label: 'United States' },
                                { value: 'Canada', label: 'Canada' },
                                { value: 'Mexico', label: 'Mexico' },
                              ]}
                              placeholder="Select country"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!coFirstName || !coLastName) {
                        alert('First and last name are required');
                        return;
                      }
                      setPendingCosigners((prev) => [
                        ...prev,
                        {
                          first_name: coFirstName,
                          last_name: coLastName,
                          email: coEmail,
                          phone: coPhone,
                          alt_phone: coAltPhone,
                          alt_email: coAltEmail,
                          same_as_unit: coSameAsUnitAddress,
                          same_as_unit_address: coSameAsUnitAddress,
                          addr1: coSameAsUnitAddress ? null : coAddr1,
                          addr2: coSameAsUnitAddress ? null : coAddr2,
                          address_line1: coSameAsUnitAddress ? null : coAddr1,
                          address_line2: coSameAsUnitAddress ? null : coAddr2,
                          city: coSameAsUnitAddress ? null : coCity,
                          state: coSameAsUnitAddress ? null : coState,
                          postal: coSameAsUnitAddress ? null : coPostal,
                          country: coSameAsUnitAddress ? null : coCountry,
                          alt_addr1: coAltAddr1,
                          alt_addr2: coAltAddr2,
                          alt_address_line1: coAltAddr1,
                          alt_address_line2: coAltAddr2,
                          alt_city: coAltCity,
                          alt_state: coAltState,
                          alt_postal: coAltPostal,
                          alt_country: coAltCountry,
                        },
                      ]);
                      resetCosignerForm();
                      setShowAddTenant(false);
                    }}
                  >
                    Add cosigner
                  </Button>
                  <Button variant="cancel" size="sm" onClick={() => setShowAddTenant(false)}>
                    Cancel
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
