'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dropdown } from '@/components/ui/Dropdown';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import AddTenantModal from '@/components/leases/AddTenantModal';
import LeaseFileUploadDialog, {
  type LeaseFileRow,
} from '@/components/leases/LeaseFileUploadDialog';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';
import { toast } from 'sonner';

type PropertyOption = { id: string; name: string };
type UnitOption = { id: string; unit_number: string | null };
type TenantOption = { id: string; name: string };
type GlAccountOption = {
  id: string;
  name: string;
  account_number?: string | null;
  type?: string | null;
  is_security_deposit_liability?: boolean | null;
};

type StagedPerson = {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  alt_phone?: string | null;
  alt_email?: string | null;
  addr1?: string | null;
  addr2?: string | null;
  city?: string | null;
  state?: string | null;
  postal?: string | null;
  alt_addr1?: string | null;
  alt_addr2?: string | null;
  alt_city?: string | null;
  alt_state?: string | null;
  alt_postal?: string | null;
  role: 'Tenant' | 'Cosigner';
  same_as_unit_address?: boolean;
};

type RentFrequency = 'Monthly' | 'Weekly' | 'Biweekly' | 'Quarterly' | 'Annually';

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
  'application/octet-stream',
]);
const isAllowedMimeType = (mimeType: string | undefined | null) => {
  if (!mimeType) return true;
  for (const prefix of ALLOWED_MIME_PREFIXES) {
    if (mimeType.startsWith(prefix)) return true;
  }
  if (ALLOWED_MIME_TYPES.has(mimeType)) return true;
  if (mimeType.startsWith('application/vnd.openxmlformats-officedocument')) return true;
  return false;
};

type AddLeaseFormProps = {
  onCancel: () => void;
  onSuccess?: () => void;
  onSubmitSuccess?: (leaseId?: number | null) => void;
  onSubmitError?: (message?: string | null) => void;
  prefillPropertyId?: string;
  prefillUnitId?: string;
  propertyOptions?: PropertyOption[];
  unitOptions?: UnitOption[];
  _tenantOptions?: TenantOption[];
  prefill?: {
    propertyId?: string | null;
    unitId?: string | null;
    from?: string | null;
    to?: string | null;
    rent?: number | null;
    rentMemo?: string | null;
    rentCycle?: RentFrequency;
    nextDueDate?: string | null;
    paymentDueDay?: number | null;
    depositAmt?: number | null;
    depositDate?: string | null;
    depositMemo?: string | null;
    leaseCharges?: string | null;
  };
};

const parseCurrencyValue = (value: string | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[^0-9.-]/g, '');
  if (!normalized || normalized === '.' || normalized === '-' || normalized === '-.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const fmtUsd = (n?: number | null) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);

export default function AddLeaseForm({
  onCancel,
  onSuccess,
  onSubmitSuccess,
  onSubmitError,
  prefillPropertyId,
  prefillUnitId,
  propertyOptions,
  unitOptions,
  _tenantOptions,
  prefill,
}: AddLeaseFormProps) {
  const router = useRouter();
  // Reserved for future existing-tenant selection support
  void _tenantOptions;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [propertyId, setPropertyId] = useState<string>(prefill?.propertyId ?? prefillPropertyId ?? '');
  const [unitId, setUnitId] = useState<string>(prefill?.unitId ?? prefillUnitId ?? '');
  const [properties, setProperties] = useState<PropertyOption[]>(propertyOptions ?? []);
  const [propertiesLoading, setPropertiesLoading] = useState(!propertyOptions?.length);
  const [propertiesLoadError, setPropertiesLoadError] = useState<string | null>(null);
  const [units, setUnits] = useState<UnitOption[]>(unitOptions ?? []);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsLoadError, setUnitsLoadError] = useState<string | null>(null);
  const [from, setFrom] = useState(prefill?.from ?? '');
  const [to, setTo] = useState(prefill?.to ?? '');
  const [propertyError, setPropertyError] = useState<string | null>(null);
  const [unitError, setUnitError] = useState<string | null>(null);
  const [rent, setRent] = useState(
    prefill?.rent != null && Number.isFinite(prefill.rent) ? String(prefill.rent) : '',
  );
  const [rentCycle, setRentCycle] = useState<RentFrequency>(prefill?.rentCycle ?? 'Monthly');
  const [nextDueDate, setNextDueDate] = useState<string>(prefill?.nextDueDate ?? '');
  const [paymentDueDay, setPaymentDueDay] = useState<string>(
    prefill?.paymentDueDay != null && Number.isFinite(prefill.paymentDueDay)
      ? String(prefill.paymentDueDay)
      : '',
  );
  const [depositDate, setDepositDate] = useState<string>(prefill?.depositDate ?? '');
  const [rentMemo, setRentMemo] = useState<string>(prefill?.rentMemo ?? '');
  const [depositMemo, setDepositMemo] = useState<string>(prefill?.depositMemo ?? '');
  const [leaseType, setLeaseType] = useState<string>('Fixed');
  const [depositAmt, setDepositAmt] = useState(
    prefill?.depositAmt != null && Number.isFinite(prefill.depositAmt)
      ? String(prefill.depositAmt)
      : '',
  );
  const [leaseCharges, setLeaseCharges] = useState<string>(prefill?.leaseCharges ?? '');
  const [depositTouched, setDepositTouched] = useState(false);

  // Proration
  const [prorateFirstMonth, setProrateFirstMonth] = useState(false);
  const [prorateLastMonth, setProrateLastMonth] = useState(false);
  const [firstProrationDays, setFirstProrationDays] = useState<number>(0);
  const [firstProrationAmount, setFirstProrationAmount] = useState<number | null>(null);
  const [lastProrationDays, setLastProrationDays] = useState<number>(0);
  const [lastProrationAmount, setLastProrationAmount] = useState<number | null>(null);

  // Tenants
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [selectedExistingTenantIds, setSelectedExistingTenantIds] = useState<string[]>([]);
  const [pendingTenants, setPendingTenants] = useState<StagedPerson[]>([]);
  const [pendingCosigners, setPendingCosigners] = useState<StagedPerson[]>([]);

  // GL Accounts
  const [glAccounts, setGlAccounts] = useState<GlAccountOption[]>([]);
  const [glAccountsLoading, setGlAccountsLoading] = useState(false);
  const [glAccountsError, setGlAccountsError] = useState<string | null>(null);
  const [rentGlAccountId, setRentGlAccountId] = useState<string>('');
  const [depositGlAccountId, setDepositGlAccountId] = useState<string>('');

  // Buildium sync
  const [syncToBuildium, setSyncToBuildium] = useState(true);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);

  // Files
  const [pendingLeaseFiles, setPendingLeaseFiles] = useState<
    Array<{
      id: string;
      file: File;
      name: string;
      size: number;
      status: 'pending' | 'uploading' | 'uploaded' | 'error';
      error?: string | null;
    }>
  >([]);
  const [uploadedLeaseFiles, setUploadedLeaseFiles] = useState<LeaseFileRow[]>([]);
  const [leaseFileDialogOpen, setLeaseFileDialogOpen] = useState(false);
  const [createdLeaseId, setCreatedLeaseId] = useState<number | null>(null);
  const [buildiumLeaseId, setBuildiumLeaseId] = useState<number | null>(null);
  const [uploadingPendingFiles, setUploadingPendingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const leaseFileInputRef = useRef<HTMLInputElement | null>(null);

  const prevStartDateRef = useRef<string>('');
  const propertiesAbortRef = useRef<AbortController | null>(null);
  const unitsRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const prefillAppliedRef = useRef(false);
  const prevPropertyIdRef = useRef<string | null>(null);

  // Keep units in sync when server-prefetched options arrive (e.g., deep link from unit page).
  useEffect(() => {
    if (unitOptions?.length) {
      setUnits(unitOptions);
      setUnitsLoadError(null);
      setUnitsLoading(false);
    }
  }, [unitOptions]);

  useEffect(() => {
    if (prefillPropertyId && !propertyId) {
      setPropertyId(prefillPropertyId);
    }
  }, [prefillPropertyId, propertyId]);

  useEffect(() => {
    if (prefillUnitId && !unitId) {
      setUnitId(prefillUnitId);
    }
  }, [prefillUnitId, unitId]);

  useEffect(() => {
    if (prefillAppliedRef.current) return;
    if (prefill) {
      if (prefill.depositAmt != null) setDepositTouched(true);
      if (prefill.paymentDueDay != null && Number.isFinite(prefill.paymentDueDay)) {
        setPaymentDueDay(String(prefill.paymentDueDay));
      }
    }
    prefillAppliedRef.current = true;
  }, [prefill]);

  // Reset form on mount (component will unmount when navigating away)
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      propertiesAbortRef.current?.abort();
      propertiesAbortRef.current = null;
      resetForm();
    };
  }, []);

  function resetForm() {
    setPropertyId('');
    setUnitId('');
    setFrom('');
    setTo('');
    setPropertyError(null);
    setUnitError(null);
    setPropertiesLoading(false);
    setPropertiesLoadError(null);
    setUnitsLoading(false);
    setUnitsLoadError(null);
    setRent('');
    setRentCycle('Monthly');
    setNextDueDate('');
    setDepositDate('');
    setRentMemo('');
    setDepositMemo('');
    setLeaseType('Fixed');
    setDepositAmt('');
    setLeaseCharges('');
    setDepositTouched(false);
    setPaymentDueDay('');
    setProrateFirstMonth(false);
    setProrateLastMonth(false);
    setFirstProrationDays(0);
    setFirstProrationAmount(null);
    setLastProrationDays(0);
    setLastProrationAmount(null);
    setPendingTenants([]);
    setPendingCosigners([]);
    setShowAddTenant(false);
    setSelectedExistingTenantIds([]);
    setRentGlAccountId('');
    setDepositGlAccountId('');
    setPendingLeaseFiles([]);
    setUploadedLeaseFiles([]);
    setLeaseFileDialogOpen(false);
    setCreatedLeaseId(null);
    setBuildiumLeaseId(null);
    setUploadingPendingFiles(false);
    setUploadProgress(null);
    setSyncToBuildium(true);
    setSendWelcomeEmail(true);
    setError(null);
    prevStartDateRef.current = '';
  }

  // Load properties
  const loadProperties = useCallback(async () => {
    if (propertyOptions?.length) {
      setProperties(propertyOptions);
      setPropertiesLoading(false);
      return;
    }
    if (!isMountedRef.current) return;
    if (propertiesAbortRef.current) {
      propertiesAbortRef.current.abort();
    }
    const controller = new AbortController();
    propertiesAbortRef.current = controller;
    setPropertiesLoading(true);
    setPropertiesLoadError(null);
    try {
      const res = await fetch('/api/properties', { signal: controller.signal });
      let json: unknown;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      if (!res.ok) {
        const message =
          json &&
          typeof json === 'object' &&
          json !== null &&
          'error' in json &&
          typeof (json as { error?: unknown }).error === 'string'
            ? String((json as { error?: unknown }).error)
            : 'Failed to load properties. Please try again.';
        throw new Error(message);
      }
      const list = Array.isArray(json) ? json : [];
      const active = list
        .filter(
          (p: Record<string, unknown>) => String(p?.status ?? '').toLowerCase() === 'active',
        )
        .map<PropertyOption>((p: Record<string, unknown>) => ({
          id: String(p.id),
          name: (p?.name as string) ?? 'Property',
        }));
      if (!isMountedRef.current || controller.signal.aborted) return;
      setProperties(active);
    } catch (err) {
      if (!isMountedRef.current || controller.signal.aborted) return;
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to load properties. Please try again.';
      setPropertiesLoadError(message);
      toast.error(message);
    } finally {
      if (!isMountedRef.current) return;
      if (propertiesAbortRef.current === controller) {
        setPropertiesLoading(false);
        propertiesAbortRef.current = null;
      }
    }
  }, [propertyOptions]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  // Load units when property changes
  const loadUnits = useCallback(async (targetPropertyId: string) => {
    const requestId = ++unitsRequestIdRef.current;
    setUnitsLoading(true);
    setUnitsLoadError(null);
    try {
      const supa = getSupabaseBrowserClient();
      const { data, error } = await supa
        .from('units')
        .select('id, unit_number, status')
        .eq('property_id', targetPropertyId)
        .not('status', 'eq', 'Inactive')
        .order('unit_number');
      let rows =
        data?.map((u) => ({
          id: String(u.id),
          unit_number: u.unit_number || 'Unit',
        })) ?? [];

      // Fallback: if Supabase returns no rows or errors (e.g., RLS hiccup), try server API.
      if ((error || !rows.length) && typeof fetch !== 'undefined') {
        try {
          const params = new URLSearchParams({ propertyId: targetPropertyId });
          const res = await fetch(`/api/units?${params.toString()}`, { credentials: 'include' });
          const json: unknown = await res.json().catch(() => null);
          if (res.ok && Array.isArray(json)) {
            rows =
              json
                .filter(
                  (u: Record<string, unknown>) =>
                    String(u?.status ?? '').toLowerCase() !== 'inactive',
                )
                .map((u: Record<string, unknown>) => ({
                  id: String(u.id),
                  unit_number: (u?.unit_number as string) || 'Unit',
                })) ?? [];
          } else if (!res.ok && !error) {
            throw new Error(
              (json as { error?: unknown })?.error
                ? String((json as { error?: unknown }).error)
                : 'Failed to load units.',
            );
          }
        } catch (fallbackErr) {
          if (!isMountedRef.current || unitsRequestIdRef.current !== requestId) return;
          const message =
            fallbackErr instanceof Error && fallbackErr.message
              ? fallbackErr.message
              : 'Failed to load units. Please try again.';
          setUnitsLoadError(message);
          toast.error(message);
        }
      } else if (error) {
        throw error;
      }

      if (!isMountedRef.current || unitsRequestIdRef.current !== requestId) return;
      setUnits(rows);
    } catch (err) {
      if (!isMountedRef.current || unitsRequestIdRef.current !== requestId) return;
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to load units. Please try again.';
      setUnitsLoadError(message);
      toast.error(message);
    } finally {
      if (!isMountedRef.current || unitsRequestIdRef.current !== requestId) return;
      setUnitsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!propertyId) {
      setUnits([]);
      setUnitId('');
      setUnitsLoadError(null);
      setUnitsLoading(false);
      prevPropertyIdRef.current = propertyId;
      return;
    }
    const previous = prevPropertyIdRef.current;
    const propertyChanged = previous && previous !== propertyId;
    prevPropertyIdRef.current = propertyId;
    if (propertyChanged) {
      setUnitId('');
    }
    // If we already have unit options for this property from the server, avoid refetching.
    if (unitOptions?.length && prefillPropertyId && propertyId === prefillPropertyId) {
      setUnits(unitOptions);
      setUnitsLoadError(null);
      setUnitsLoading(false);
      return;
    }
    loadUnits(propertyId);
  }, [propertyId, loadUnits, prefillPropertyId, unitOptions]);

  const handleRetryLoadProperties = useCallback(() => {
    loadProperties();
  }, [loadProperties]);

  const handleRetryLoadUnits = useCallback(() => {
    if (propertyId) {
      loadUnits(propertyId);
    }
  }, [propertyId, loadUnits]);

  // Load GL accounts
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const ensureAccounts = async () => {
      try {
        setGlAccountsLoading(true);
        setGlAccountsError(null);
        const res = await fetch(`/api/gl-accounts`, {
          signal: controller.signal,
          credentials: 'include',
        });
        const json: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          const message =
            json &&
            typeof json === 'object' &&
            json !== null &&
            'error' in json &&
            typeof (json as { error?: unknown }).error === 'string'
              ? String((json as { error?: unknown }).error)
              : 'Failed to load GL accounts';
          throw new Error(message);
        }
        const rows =
          json &&
          typeof json === 'object' &&
          'data' in json &&
          Array.isArray((json as { data: unknown }).data)
            ? (json as { data: Array<Record<string, unknown>> }).data
            : [];
        const list = rows
          .filter((row: Record<string, unknown>) => {
            if (!row || row.is_active === false) return false;
            return (
              (typeof row.id === 'string' || typeof row.id === 'number') &&
              typeof row.name === 'string'
            );
          })
          .map<GlAccountOption>((row: Record<string, unknown>) => ({
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
  }, []);

  // Auto-select rent GL account
  useEffect(() => {
    if (!glAccounts.length) return;
    const incomeAccounts = glAccounts.filter((acc) => (acc.type ?? '').toLowerCase() === 'income');
    if (!rentGlAccountId && incomeAccounts.length) {
      const rentDefault =
        incomeAccounts.find((acc) => acc.name?.toLowerCase() === 'rent income') ||
        incomeAccounts[0];
      if (rentDefault) setRentGlAccountId(rentDefault.id);
    }
    const depositCandidates = glAccounts.filter((acc) => acc.is_security_deposit_liability);
    const depositSourceAll = depositCandidates.length ? depositCandidates : glAccounts;
    if (!depositGlAccountId) {
      const depositDefault =
        depositSourceAll.find((acc) => acc.name?.toLowerCase().includes('deposit')) ||
        depositSourceAll[0];
      if (depositDefault) setDepositGlAccountId(depositDefault.id);
    }
  }, [glAccounts, rentGlAccountId, depositGlAccountId]);

  // Auto-set end date when start date changes
  useEffect(() => {
    const prev = prevStartDateRef.current;
    if (from) {
      if (!to || to === prev) {
        const d = new Date(from + 'T00:00:00');
        const d2 = new Date(d.getTime() + 365 * 24 * 3600 * 1000);
        d2.setDate(d2.getDate() - 1);
        const iso = d2.toISOString().slice(0, 10);
        setTo(iso);
      }
      if (!nextDueDate || nextDueDate === prev) setNextDueDate(from);
      if (!depositDate || depositDate === prev) setDepositDate(from);
    }
    prevStartDateRef.current = from;
  }, [from, to, nextDueDate, depositDate]);

  useEffect(() => {
    if (paymentDueDay || !nextDueDate) return;
    const parsed = new Date(`${nextDueDate}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      setPaymentDueDay(String(parsed.getDate()));
    }
  }, [nextDueDate, paymentDueDay]);

  // Calculate proration
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
    const days = endDay;
    const monthly = parseCurrencyValue(rent) ?? 0;
    const amount = monthly * (days / daysInMonth);
    setLastProrationDays(days);
    setLastProrationAmount(Number(amount.toFixed(2)));
  }, [prorateLastMonth, to, rent]);

  const handlePendingFileSelect = (files: FileList | null) => {
    if (!files?.length) return;
    const next: typeof pendingLeaseFiles = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_UPLOAD_BYTES) {
        setError('File size exceeds 25 MB limit.');
        continue;
      }
      if (!isAllowedMimeType(file.type)) {
        setError('Unsupported file type. Allowed formats: PDF, images, and Office documents.');
        continue;
      }
      next.push({
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        file,
        name: file.name,
        size: file.size,
        status: 'pending',
      });
    }
    if (next.length) {
      setPendingLeaseFiles((prev) => [...prev, ...next].slice(0, 10));
    }
    if (leaseFileInputRef.current) {
      leaseFileInputRef.current.value = '';
    }
  };

  const uploadPendingLeaseFiles = useCallback(
    async (leaseIdToUse: number, onlyIds?: Set<string>): Promise<{ success: boolean }> => {
      setUploadingPendingFiles(true);
      const filesToUpload = pendingLeaseFiles.filter(
        (file) => file.status !== 'uploaded' && (!onlyIds || onlyIds.has(file.id)),
      );
      if (!filesToUpload.length) {
        setUploadProgress(null);
        setUploadingPendingFiles(false);
        return { success: true };
      }

      setUploadProgress({ current: 0, total: filesToUpload.length });

      const markStatus = (id: string, status: 'uploading' | 'uploaded' | 'error', msg?: string) =>
        setPendingLeaseFiles((prev) =>
          prev.map((file) =>
            file.id === id ? { ...file, status, error: msg ?? null } : file,
          ),
        );

      let allSucceeded = true;
      for (const [index, file] of filesToUpload.entries()) {
        setUploadProgress({ current: index + 1, total: filesToUpload.length });
        markStatus(file.id, 'uploading');
        try {
          const formData = new FormData();
          formData.append('file', file.file);
          formData.append('entityType', 'lease');
          formData.append('entityId', String(leaseIdToUse));
          formData.append('fileName', file.name);
          if (file.file.type) formData.append('mimeType', file.file.type);
          formData.append('isPrivate', 'true');
          formData.append('category', 'Lease Documents');

          let response: Response;
          try {
            response = await fetchWithSupabaseAuth('/api/files/upload', {
              method: 'POST',
              body: formData,
            });
          } catch {
            response = await fetch('/api/files/upload', {
              method: 'POST',
              body: formData,
              credentials: 'include',
            });
          }

          const payload = await response.json().catch(() => ({}));
          if (!response.ok || payload?.error) {
            const message =
              typeof payload?.error === 'string' && payload.error.length
                ? payload.error
                : 'Failed to upload file';
            throw new Error(message);
          }

          const uploadedFile = payload?.file ?? null;
          const uploadedAt =
            (typeof uploadedFile?.created_at === 'string' && uploadedFile.created_at) ||
            new Date().toISOString();
          const buildiumFileId =
            typeof payload?.buildiumFileId === 'number'
              ? payload.buildiumFileId
              : typeof uploadedFile?.buildium_file_id === 'number'
                ? uploadedFile.buildium_file_id
                : null;
          const buildiumHref =
            typeof payload?.buildiumFile?.Href === 'string'
              ? payload.buildiumFile.Href
              : typeof uploadedFile?.buildium_href === 'string'
                ? uploadedFile.buildium_href
                : null;
          const buildiumSyncError =
            typeof payload?.buildiumSyncError === 'string' && payload.buildiumSyncError.length
              ? payload.buildiumSyncError
              : null;

          setUploadedLeaseFiles((prev) => [
            ...prev,
            {
              id:
                (uploadedFile?.id as string) ||
                (typeof crypto !== 'undefined' && crypto.randomUUID
                  ? crypto.randomUUID()
                  : `${Date.now()}`),
              title: uploadedFile?.file_name || file.name,
              category: uploadedFile?.category ?? 'Lease Documents',
              description: uploadedFile?.description ?? null,
              uploadedAt: new Date(uploadedAt),
              uploadedBy: 'Team member',
              buildiumFileId,
              buildiumHref,
              buildiumSyncError,
            },
          ]);

          markStatus(file.id, buildiumSyncError ? 'error' : 'uploaded', buildiumSyncError ?? null);
          if (buildiumSyncError) {
            allSucceeded = false;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to upload file';
          markStatus(file.id, 'error', message);
          allSucceeded = false;
        }
      }

      setUploadProgress(null);
      setUploadingPendingFiles(false);
      return { success: allSucceeded };
    },
    [pendingLeaseFiles],
  );

  const handleSave = async () => {
    setPropertyError(null);
    setUnitError(null);

    if (!propertyId) {
      setPropertyError('Select a property to continue');
    }
    if (!unitId) {
      setUnitError('Select a unit to continue');
    }
    if (!propertyId || !unitId) {
      setError(null);
      return;
    }

    const finalizeLease = async () => {
      resetForm();
      setPendingLeaseFiles([]);
      setCreatedLeaseId(null);
      setError(null);
      (onSuccess || onCancel)?.();
      router.refresh();
    };

    try {
      setSaving(true);
      setError(null);

      if (createdLeaseId) {
        const uploadResult = await uploadPendingLeaseFiles(createdLeaseId);
        if (!uploadResult.success) {
          setSaving(false);
          setError('Some files failed to upload. Please retry.');
          return;
        }
        await finalizeLease();
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
      if (rentHasAmount && !paymentDueDay && !nextDueDate)
        throw new Error('Rent due day is required when amount is set');
      if (depositHasAmount && !depositDate)
        throw new Error('Deposit due date is required when amount is set');

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

      const payload: {
        property_id: string;
        unit_id: string;
        lease_from_date: string;
        lease_to_date: string | null;
        rent_amount: number | null;
        lease_charges: string | null;
        security_deposit: number | null;
        payment_due_day: number | null;
        lease_type: string;
        send_welcome_email: boolean;
        contacts?: Array<{ tenant_id: string; role: string; is_rent_responsible: boolean }>;
        new_people?: Array<{
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          role: string;
          same_as_unit_address: boolean;
        }>;
        rent_schedules?: Array<{
          start_date: string;
          end_date: string | null;
          total_amount: number;
          rent_cycle: string;
          status: string;
          backdate_charges: boolean;
        }>;
        recurring_transactions?: Array<{
          amount: number;
          memo: string;
          frequency: string;
          start_date: string;
          gl_account_id: string | null;
        }>;
        prorated_first_month_rent?: number;
        prorated_last_month_rent?: number;
      } = {
        property_id: propertyId,
        unit_id: unitId,
        lease_from_date: from,
        lease_to_date: to || null,
        rent_amount: Number.isFinite(rentAmount) ? rentAmount : null,
        lease_charges: leaseCharges.trim() || null,
        security_deposit: Number.isFinite(depositAmount) ? depositAmount : null,
        payment_due_day: paymentDueDayValue,
        lease_type: leaseType || 'Fixed',
        send_welcome_email: sendWelcomeEmail,
      };

      const recurringTransactions: Array<{
        amount: number;
        memo: string;
        frequency: string;
        start_date: string;
        end_date?: string;
        gl_account_id: string | null;
      }> = [];
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
      if (recurringTransactions.length) {
        payload.recurring_transactions = recurringTransactions;
      }

      if (rentHasAmount && rentAmount != null) {
        const scheduleStatus = (() => {
          const start = nextDueDate || from || '';
          if (!start) return 'Current';
          const startDate = new Date(`${start}T00:00:00`);
          if (Number.isNaN(startDate.getTime())) return 'Current';
          const today = new Date();
          const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          return startDate > todayMidnight ? 'Future' : 'Current';
        })();
        const mapRentCycle = (v: string): string => {
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
            default:
              return 'Monthly';
          }
        };
        payload.rent_schedules = [
          {
            start_date: nextDueDate || from,
            end_date: to || null,
            total_amount: rentAmount,
            rent_cycle: mapRentCycle(rentCycle),
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
        const mapPerson = (person: StagedPerson, role: 'Tenant' | 'Cosigner') => ({
          first_name: person.first_name,
          last_name: person.last_name,
          role,
          email: person.email ?? null,
          phone: person.phone ?? null,
          alt_phone: person.alt_phone ?? null,
          alt_email: person.alt_email ?? null,
          same_as_unit_address: person.same_as_unit_address ?? true,
          addr1: person.addr1 ?? null,
          addr2: person.addr2 ?? null,
          city: person.city ?? null,
          state: person.state ?? null,
          postal: person.postal ?? null,
          alt_addr1: person.alt_addr1 ?? null,
          alt_addr2: person.alt_addr2 ?? null,
          alt_city: person.alt_city ?? null,
          alt_state: person.alt_state ?? null,
          alt_postal: person.alt_postal ?? null,
        });
        payload.new_people = [
          ...pendingTenants.map((tenant) => mapPerson(tenant, 'Tenant')),
          ...pendingCosigners.map((cosigner) => mapPerson(cosigner, 'Cosigner')),
        ];
      }

      if (selectedExistingTenantIds.length) {
        payload.contacts = selectedExistingTenantIds.map((id) => ({
          tenant_id: id,
          role: 'Tenant',
          is_rent_responsible: true,
        }));
      }

      const endpoint = syncToBuildium ? '/api/leases?syncBuildium=true' : '/api/leases';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          syncBuildium: syncToBuildium,
          send_welcome_email: sendWelcomeEmail,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        const errorMessage =
          typeof json === 'object' && json && 'error' in json && typeof json.error === 'string'
            ? json.error
            : 'Failed to create lease';
        throw new Error(errorMessage);
      }

      const responseLease =
        (json as Record<string, unknown>)?.lease ??
        (json as Record<string, unknown>)?.Lease ??
        null;
      const leaseObj = responseLease as Record<string, unknown> | null;
      const derivedLeaseId =
        leaseObj?.id ??
        leaseObj?.Id ??
        (json as Record<string, unknown>)?.lease_id ??
        (json as Record<string, unknown>)?.leaseId ??
        null;
      const derivedBuildiumLeaseId =
        leaseObj?.buildium_lease_id ??
        leaseObj?.buildiumLeaseId ??
        (json as Record<string, unknown>)?.buildium_lease_id ??
        (json as Record<string, unknown>)?.buildiumLeaseId ??
        null;
      const leaseIdNumber =
        typeof derivedLeaseId === 'number' ? derivedLeaseId : Number(derivedLeaseId);

      if (Number.isFinite(leaseIdNumber)) {
        setCreatedLeaseId(Number(leaseIdNumber));
        const buildiumIdNumber =
          typeof derivedBuildiumLeaseId === 'number'
            ? derivedBuildiumLeaseId
            : Number(derivedBuildiumLeaseId);
        if (Number.isFinite(buildiumIdNumber)) {
          setBuildiumLeaseId(Number(buildiumIdNumber));
        }
      }

      const numericLeaseId = Number.isFinite(leaseIdNumber) ? Number(leaseIdNumber) : null;
      if (numericLeaseId !== null) {
        const uploadResult = await uploadPendingLeaseFiles(numericLeaseId);
        if (!uploadResult.success) {
          setSaving(false);
          setError('Lease created, but some files failed to upload. Please retry.');
          return;
        }
      }

      onSubmitSuccess?.(numericLeaseId);
      await finalizeLease();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to create lease';
      setError(message);
      onSubmitError?.(message);
    } finally {
      setSaving(false);
    }
  };

  const describeGlAccount = (account: GlAccountOption) => account.name || 'Account';

  const incomeAccounts = glAccounts.filter((acc) => (acc.type ?? '').toLowerCase() === 'income');
  const rentAccountOptions = incomeAccounts.map((acc) => ({
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
  const paymentDueDayOptions = Array.from({ length: 31 }, (_, idx) => {
    const day = idx + 1;
    return { value: String(day), label: `${day}` };
  });

  const rentGridClass =
    'grid grid-cols-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,12rem)_max-content_max-content_minmax(0,16rem)] gap-3';
  const depositGridClass = 'grid grid-cols-1 sm:grid-cols-[minmax(0,14rem)_max-content] gap-3';

  // Show proration section
  const start = from ? new Date(from + 'T00:00:00') : null;
  const end = to ? new Date(to + 'T00:00:00') : null;
  const showFirst = !!start && start.getDate() > 1;
  let showLast = false;
  if (end) {
    const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
    showLast = end.getDate() < lastDay;
  }
  const rentNum = parseCurrencyValue(rent) ?? 0;
  const showProration = rentNum > 0 && (showFirst || showLast);

  return (
    <div className="border-border/60 bg-background space-y-6 rounded-xl border p-6">
      {/* Header with back button and actions */}
      <div className="border-border flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-foreground text-2xl font-semibold">Add Lease</h1>
          {pendingCosigners.length > 0 && (
            <div className="text-muted-foreground text-xs">
              {pendingCosigners.length} cosigner{pendingCosigners.length > 1 ? 's' : ''} added
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-foreground mr-2 flex items-center gap-2 text-xs select-none">
            <Checkbox
              id="syncBuildiumOnSave"
              checked={syncToBuildium}
              onCheckedChange={(v) => setSyncToBuildium(Boolean(v))}
            />
            <span>Sync to Buildium on save</span>
          </label>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || uploadingPendingFiles || !propertyId || !unitId}
          >
            {saving || uploadingPendingFiles ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {error && (
          <div className="bg-destructive/10 text-destructive border-destructive/20 rounded-md border p-4 text-sm">
            {error}
          </div>
        )}

        {/* Lease details */}
        <div>
          <h3 className="text-foreground mb-4 text-sm font-semibold">Lease details</h3>
          <div className="w-full">
            {/* Property + Unit */}
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(20rem,40rem)_max-content]">
              <div className="w-full sm:justify-self-start">
                <label className="mb-1 block text-xs">Property *</label>
                <Dropdown
                  value={propertyId}
                  onChange={(v) => {
                    setPropertyId(v);
                    setUnitId('');
                    setPropertyError(null);
                    setUnitError(null);
                  }}
                  options={properties.map((p) => ({ value: String(p.id), label: p.name }))}
                  placeholder="Select property"
                  className="max-w-full sm:w-[40rem]"
                />
                {propertyError && (
                  <p className="text-destructive mt-1 text-xs">{propertyError}</p>
                )}
                {propertiesLoading && !properties.length && (
                  <p className="text-muted-foreground mt-1 text-xs">Loading properties…</p>
                )}
                {propertiesLoadError && (
                  <div className="text-destructive mt-1 flex items-center gap-2 text-xs">
                    <span>{propertiesLoadError}</span>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="px-0"
                      onClick={handleRetryLoadProperties}
                    >
                      Retry
                    </Button>
                  </div>
                )}
              </div>
              <div className="w-full sm:w-auto sm:justify-self-start">
                <label className="mb-1 block text-xs">Unit *</label>
                <Dropdown
                  value={unitId}
                  onChange={(v) => {
                    setUnitId(v);
                    setUnitError(null);
                  }}
                  options={units.map((u) => ({
                    value: String(u.id),
                    label: u.unit_number || 'Unit',
                  }))}
                  placeholder="Select unit"
                  className="sm:w-32"
                />
                {unitError && <p className="text-destructive mt-1 text-xs">{unitError}</p>}
                {propertyId && unitsLoading && !units.length && (
                  <p className="text-muted-foreground mt-1 text-xs">Loading units…</p>
                )}
                {unitsLoadError && (
                  <div className="text-destructive mt-1 flex items-center gap-2 text-xs">
                    <span>{unitsLoadError}</span>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="px-0"
                      onClick={handleRetryLoadUnits}
                    >
                      Retry
                    </Button>
                  </div>
                )}
              </div>
            </div>
            {/* Lease Type + Dates */}
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
                        <div className="text-muted-foreground text-xs uppercase">Email address</div>
                        <div className="text-foreground">{t.email || '—'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs uppercase">Mobile phone</div>
                        <div className="text-foreground">{t.phone || '—'}</div>
                      </div>
                    </div>
                  </div>
                  <button
                    className="text-muted-foreground"
                    onClick={() => setPendingTenants((prev) => prev.filter((_, i) => i !== idx))}
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
                        <div className="text-muted-foreground text-xs uppercase">Email address</div>
                        <div className="text-foreground">{t.email || '—'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs uppercase">Mobile phone</div>
                        <div className="text-foreground">{t.phone || '—'}</div>
                      </div>
                    </div>
                  </div>
                  <button
                    className="text-muted-foreground"
                    onClick={() => setPendingCosigners((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

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
                      No income GL accounts available. Rent will be saved without linking an account.
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

        {/* Rent proration */}
        {showProration && (
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
                        value={firstProrationAmount != null ? fmtUsd(firstProrationAmount) : ''}
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
        )}

        {/* Security deposit */}
        <div>
          <h3 className="text-foreground mb-3 text-sm font-semibold">
            Security deposit <span className="text-muted-foreground font-normal">(optional)</span>
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
                <div className="w-full sm:w-fit sm:justify-self-start">
                  <label className="mb-1 block text-xs">Next due date *</label>
                  <DateInput
                    value={depositDate}
                    onChange={setDepositDate}
                    placeholder="m/d/yyyy"
                    containerClassName="sm:w-fit sm:max-w-[12rem] sm:min-w-[9.5rem]"
                  />
                </div>
              </div>
            </div>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Don't forget to record the payment once you have collected the deposit.
          </p>
        </div>

        {/* Charges */}
        <div className="border-border bg-muted/30 rounded-md border p-4">
          <h3 className="text-foreground mb-3 text-sm font-semibold">
            Charges <span className="text-muted-foreground font-normal">(optional)</span>
          </h3>
          <p className="text-muted-foreground mb-4 text-sm">
            Create charges for tenants that are part of this lease
          </p>
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

        {/* Lease documents */}
        <div className="border-border bg-muted/30 rounded-md border p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-foreground text-sm font-medium">
                Lease documents <span className="text-muted-foreground font-normal">(optional)</span>
              </h3>
              <p className="text-muted-foreground text-xs">
                Use the upload dialog (same flow as property files) to add documents. If the lease is
                not saved yet, attach files and we&apos;ll upload them right after save.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => {
                  if (!createdLeaseId) {
                    setError('Save the lease before uploading files.');
                    return;
                  }
                  setLeaseFileDialogOpen(true);
                }}
                disabled={!createdLeaseId || saving || uploadingPendingFiles}
              >
                <UploadCloud className="mr-2 h-4 w-4" />
                Upload file
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => leaseFileInputRef.current?.click()}
                disabled={pendingLeaseFiles.length >= 10 || saving || uploadingPendingFiles}
              >
                Add pending files (after save)
              </Button>
            </div>
          </div>

          {!createdLeaseId ? (
            <p className="text-muted-foreground text-xs">
              Save the lease to upload immediately. You can still attach files now and they&apos;ll
              upload right after save.
            </p>
          ) : null}

          <input
            ref={leaseFileInputRef}
            type="file"
            className="hidden"
            multiple
            accept="application/pdf,image/*"
            onChange={(event) => handlePendingFileSelect(event.target.files)}
          />

          {pendingLeaseFiles.length ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-foreground text-xs font-semibold uppercase tracking-wide">
                  Pending uploads ({pendingLeaseFiles.length})
                </p>
                <p className="text-muted-foreground text-xs">
                  {pendingLeaseFiles.length} file
                  {pendingLeaseFiles.length === 1 ? '' : 's'} will upload after save.
                </p>
              </div>
              {uploadingPendingFiles && uploadProgress ? (
                <p className="text-muted-foreground text-xs">
                  Uploading file {uploadProgress.current} of {uploadProgress.total}…
                </p>
              ) : null}
              {pendingLeaseFiles.map((file) => (
                <div
                  key={file.id}
                  className="border-border bg-background flex items-start justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex flex-col">
                    <span className="text-foreground font-medium break-all">{file.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {file.status === 'pending' && 'Pending'}
                      {file.status === 'uploading' && 'Uploading…'}
                      {file.status === 'uploaded' && 'Uploaded'}
                      {file.status === 'error' && (
                        <span className="text-destructive">{file.error || 'Upload failed'}</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {file.status === 'error' && createdLeaseId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          uploadPendingLeaseFiles(createdLeaseId, new Set([file.id]))
                        }
                        disabled={uploadingPendingFiles || saving}
                      >
                        {uploadingPendingFiles ? 'Retrying…' : 'Retry'}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setPendingLeaseFiles((prev) => prev.filter((f) => f.id !== file.id))
                      }
                      disabled={file.status === 'uploading' || uploadingPendingFiles}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              {pendingLeaseFiles.some((f) => f.status === 'error') && createdLeaseId ? (
                <div className="flex items-center justify-between rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <span>Some files failed to sync to Buildium. Retry?</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!createdLeaseId) return;
                      const failedIds = pendingLeaseFiles
                        .filter((f) => f.status === 'error')
                        .map((f) => f.id);
                      uploadPendingLeaseFiles(createdLeaseId, new Set(failedIds));
                    }}
                    disabled={uploadingPendingFiles || saving}
                  >
                    {uploadingPendingFiles ? 'Retrying…' : 'Retry uploads'}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              Supported formats include PDF and common image types. Maximum size 25 MB per document.
            </p>
          )}

          {uploadedLeaseFiles.length ? (
            <div className="mt-4 space-y-2">
              <p className="text-foreground text-xs font-semibold uppercase tracking-wide">
                Uploaded files ({uploadedLeaseFiles.length})
              </p>
              {uploadedLeaseFiles.map((file) => (
                <div
                  key={file.id}
                  className="border-border bg-background flex items-start justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex flex-col">
                    <span className="text-foreground font-medium break-all">{file.title}</span>
                    <span className="text-muted-foreground text-xs">
                      {file.category || 'Lease Documents'}
                    </span>
                    {file.description ? (
                      <span className="text-muted-foreground text-xs">{file.description}</span>
                    ) : null}
                    {file.buildiumSyncError ? (
                      <span className="text-destructive text-xs">
                        Buildium sync failed: {file.buildiumSyncError}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{file.uploadedAt.toLocaleDateString()}</div>
                    {file.buildiumFileId ? (
                      <div className="text-foreground">Buildium ID: {file.buildiumFileId}</div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {!createdLeaseId ? (
            <p className="text-muted-foreground mt-3 text-xs">
              Save the lease to upload immediately or keep files pending to upload after save.
            </p>
          ) : null}
        </div>
      </div>

      <AddTenantModal
        open={showAddTenant}
        onOpenChange={(open) => {
          setShowAddTenant(open);
        }}
        onAddTenant={(tenant) => {
          setPendingTenants((prev) => [...prev, { ...tenant, role: 'Tenant' }]);
          setShowAddTenant(false);
        }}
        onAddCosigner={(cosigner) => {
          setPendingCosigners((prev) => [...prev, { ...cosigner, role: 'Cosigner' }]);
          setShowAddTenant(false);
        }}
      />
      <LeaseFileUploadDialog
        open={leaseFileDialogOpen}
        onOpenChange={setLeaseFileDialogOpen}
        leaseId={createdLeaseId}
        buildiumLeaseId={buildiumLeaseId}
        orgId={null}
        onSaved={(file) => {
          setUploadedLeaseFiles((prev) => [...prev, file]);
        }}
      />
    </div>
  );
}
