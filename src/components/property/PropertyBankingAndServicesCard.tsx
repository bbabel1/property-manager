'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dropdown } from '@/components/ui/Dropdown';
import { SelectWithDescription } from '@/components/ui/SelectWithDescription';
import CreateBankAccountModal from '@/components/CreateBankAccountModal';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type BankAccount = { id: string; name: string; account_number?: string | null };

// Management Services Types
type MgmtScope = 'Building' | 'Unit';
type AssignmentLevel = 'Property Level' | 'Unit Level';
type ServicePlan = 'Full' | 'Basic' | 'A-la-carte';
type ServiceName =
  | 'Rent Collection'
  | 'Maintenance'
  | 'Turnovers'
  | 'Compliance'
  | 'Bill Pay'
  | 'Condition Reports'
  | 'Renewals';
type FeeAssignment = 'Building' | 'Unit';
type FeeType = 'Percentage' | 'Flat Rate';
type BillingFrequency = 'Annual' | 'Monthly';

const ALL_SERVICES: ServiceName[] = [
  'Rent Collection',
  'Maintenance',
  'Turnovers',
  'Compliance',
  'Bill Pay',
  'Condition Reports',
  'Renewals',
];

const fieldFocusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const fieldSurfaceClass = `inline-flex h-11 w-full items-center justify-between rounded-md border border-border bg-background px-3 text-left text-sm text-foreground transition-colors ${fieldFocusRing}`;
const inputFieldClass = `w-full h-11 px-3 rounded-md border border-border bg-background text-sm text-foreground transition-colors ${fieldFocusRing}`;
const inputFieldWithSuffixClass = `${inputFieldClass} pr-10`;
const eyebrowLabelClass = 'eyebrow-label';
const metricValueClass = 'text-base font-semibold text-foreground';
const detailLabelClass = 'text-sm font-medium text-muted-foreground';
const detailValueClass = 'text-base font-medium text-foreground';

export default function PropertyBankingAndServicesCard({
  property,
  fin,
}: {
  property: any;
  fin?: {
    cash_balance?: number;
    security_deposits?: number;
    reserve?: number;
    available_balance?: number;
    as_of?: string;
  };
}) {
  const [editingBanking, setEditingBanking] = useState(false);
  const [editingServices, setEditingServices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  // Banking state
  const [reserve, setReserve] = useState<number>(property.reserve || 0);
  const [operatingId, setOperatingId] = useState<string>(property.operating_bank_account_id || '');
  const [trustId, setTrustId] = useState<string>(property.deposit_trust_account_id || '');

  // Banking accounts state
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [showCreateBank, setShowCreateBank] = useState(false);
  const [createTarget, setCreateTarget] = useState<'operating' | 'trust' | null>(null);

  // Management services state
  const [management_scope, setManagementScope] = useState<MgmtScope | ''>(
    (property as any)?.management_scope || '',
  );
  const [service_assignment, setServiceAssignment] = useState<AssignmentLevel | ''>(
    (property as any)?.service_assignment || '',
  );
  const [service_plan, setServicePlan] = useState<ServicePlan | ''>(
    (property as any)?.service_plan || '',
  );
  const [active_services, setActiveServices] = useState<ServiceName[]>(
    Array.isArray((property as any)?.active_services) ? (property as any).active_services : [],
  );
  const [fee_assignment, setFeeAssignment] = useState<FeeAssignment | ''>(
    (property as any)?.fee_assignment || '',
  );
  const [fee_type, setFeeType] = useState<FeeType | ''>((property as any)?.fee_type || '');
  const [fee_percentage, setFeePercentage] = useState<number | ''>(() => {
    const pct = (property as any)?.fee_percentage;
    const fee = (property as any)?.management_fee;
    return (property as any)?.fee_type === 'Percentage'
      ? Number(pct ?? fee) || ''
      : typeof pct === 'number'
        ? pct
        : '';
  });
  const [management_fee, setManagementFee] = useState<number | ''>(() => {
    const fee = (property as any)?.management_fee;
    return (property as any)?.fee_type === 'Flat Rate'
      ? Number(fee) || ''
      : typeof fee === 'number'
        ? fee
        : '';
  });
  const [billing_frequency, setBillingFrequency] = useState<BillingFrequency | ''>(
    (property as any)?.billing_frequency || '',
  );

  useEffect(() => {
    if (!editingBanking) return;
    let cancelled = false;
    const load = async () => {
      try {
        setLoadingAccounts(true);
        const res = await fetch('/api/bank-accounts');
        if (!res.ok) throw new Error('Failed to load bank accounts');
        const data = await res.json();
        if (!cancelled) setBankAccounts(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load bank accounts');
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [editingBanking]);

  // Fetch CSRF when entering edit mode
  useEffect(() => {
    if (!editingBanking && !editingServices) return;
    let cancelled = false;
    const fetchToken = async () => {
      try {
        const res = await fetch('/api/csrf', { credentials: 'include' });
        const j = await res.json().catch(() => ({}) as any);
        if (!cancelled) setCsrfToken(j?.token || null);
      } catch {
        if (!cancelled) setCsrfToken(null);
      }
    };
    fetchToken();
    return () => {
      cancelled = true;
    };
  }, [editingBanking, editingServices]);

  // Auto-select all active services when selecting Full plan
  useEffect(() => {
    if (service_plan === 'Full') {
      setActiveServices([...ALL_SERVICES]);
    }
  }, [service_plan]);

  const operatingAccount = useMemo(() => property.operating_account, [property]);
  const trustAccount = useMemo(() => property.deposit_trust_account, [property]);
  const requiresFees = useMemo(() => fee_assignment === 'Building', [fee_assignment]);
  const sectionLabelClass = 'eyebrow-label';
  const isEditing = editingBanking || editingServices;

  function validateServices(): string | null {
    if (!service_assignment) return 'Service assignment is required';
    if (!service_plan) return 'Service plan is required';
    if (requiresFees) {
      if (!fee_type) return 'Fee type is required';
      if (fee_type === 'Percentage' && (fee_percentage === '' || fee_percentage == null))
        return 'Fee percentage is required';
      if (fee_type === 'Flat Rate' && (management_fee === '' || management_fee == null))
        return 'Management fee is required';
      if (!billing_frequency) return 'Billing frequency is required';
    }
    return null;
  }

  async function onSaveBanking() {
    if (!csrfToken) {
      setError('CSRF token not found');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`/api/properties/${property.id}/banking`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reserve,
          operating_bank_account_id: operatingId || null,
          deposit_trust_account_id: trustId || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}) as any);
        throw new Error(j?.error || 'Failed to update banking details');
      }
      setEditingBanking(false);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update banking details');
    } finally {
      setSaving(false);
    }
  }

  async function onSaveServices() {
    const msg = validateServices();
    if (msg) {
      setError(msg);
      return;
    }
    if (!csrfToken) {
      setError('CSRF token not found');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const body: any = {
        // Required by API
        name: property.name,
        address_line1: property.address_line1,
        city: property.city,
        state: property.state,
        postal_code: property.postal_code,
        country: property.country || 'United States',
        status: property.status || 'Active',
        property_type: (property as any).property_type ?? null,
        // Management/services/fees
        management_scope: management_scope || null,
        service_assignment: service_assignment || null,
        service_plan: service_plan || null,
        active_services:
          Array.isArray(active_services) && active_services.length ? active_services : null,
        fee_assignment: fee_assignment || null,
        fee_type: fee_type || null,
        fee_percentage:
          fee_type === 'Percentage' && typeof fee_percentage === 'number' ? fee_percentage : null,
        management_fee:
          fee_type === 'Flat Rate' && typeof management_fee === 'number'
            ? management_fee
            : fee_type === 'Percentage' && typeof fee_percentage === 'number'
              ? fee_percentage
              : null,
        billing_frequency: billing_frequency || null,
      };
      const res = await fetch(`/api/properties/${property.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}) as any);
        throw new Error(j?.error || 'Failed to save management services');
      }
      setEditingServices(false);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save management services');
    } finally {
      setSaving(false);
    }
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const view = (
    <div className="space-y-3">
      {/* Banking Section */}
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h4 className="text-foreground text-lg font-semibold">Banking &amp; Financials</h4>
          <Button
            variant="link"
            className="text-primary hover:text-primary/80 px-1 text-sm font-semibold"
            onClick={() => setEditingBanking(true)}
          >
            Edit
          </Button>
        </div>

        <div className="space-y-2.5 rounded-2xl bg-transparent p-1">
          <div className="space-y-1">
            <p className={eyebrowLabelClass}>Cash balance</p>
            <p className={`${metricValueClass} text-[var(--color-brand-900)]`}>
              {formatCurrency(fin?.cash_balance ?? 0)}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-6">
              <p className={detailLabelClass}>Security deposits &amp; early payments</p>
              <p className={metricValueClass}>{formatCurrency(fin?.security_deposits ?? 0)}</p>
            </div>
            <div className="flex items-baseline justify-between gap-6">
              <p className={detailLabelClass}>Property reserve</p>
              <p className={metricValueClass}>
                {formatCurrency(fin?.reserve ?? (property.reserve || 0))}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-6">
              <p className={detailLabelClass}>Available balance</p>
              <p className={metricValueClass}>{formatCurrency(fin?.available_balance ?? 0)}</p>
            </div>
            <p className="text-muted-foreground text-xs font-medium">
              As of {new Date(fin?.as_of || new Date()).toLocaleDateString()}
            </p>
          </div>

          <div className="card-divider space-y-1 border-t pt-1 pb-1">
            <div className="flex items-baseline justify-between gap-4">
              <p className={detailLabelClass}>Operating account</p>
              <p className={detailValueClass}>
                {operatingAccount ? (
                  <Link
                    className="text-primary focus-visible:ring-offset-background rounded underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:outline-none"
                    href={`/bank-accounts/${operatingAccount.id}`}
                  >
                    {`${operatingAccount.name}${operatingAccount.last4 ? ' ****' + operatingAccount.last4 : ''}`}
                  </Link>
                ) : (
                  'Setup'
                )}
              </p>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <p className={detailLabelClass}>Deposit trust account</p>
              <p className={detailValueClass}>
                {trustAccount ? (
                  <Link
                    className="text-primary focus-visible:ring-offset-background rounded underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:outline-none"
                    href={`/bank-accounts/${trustAccount.id}`}
                  >
                    {`${trustAccount.name}${trustAccount.last4 ? ' ****' + trustAccount.last4 : ''}`}
                  </Link>
                ) : (
                  'Setup'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card-divider border-t pt-2">
        {/* Management Services Section */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h4 className="text-foreground text-lg font-semibold">Management Services</h4>
          <Button
            variant="link"
            className="text-primary hover:text-primary/80 px-1 text-sm font-semibold"
            onClick={() => setEditingServices(true)}
          >
            Edit
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className={sectionLabelClass}>Assignment Level</p>
            <p className="text-foreground mt-0.5 text-sm font-medium">
              {(service_assignment as string) || '—'}
            </p>
          </div>
          <div>
            <p className={sectionLabelClass}>Service Plan</p>
            <p className="text-foreground mt-0.5 text-sm font-medium">
              {(service_plan as string) || '—'}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className={sectionLabelClass}>Active Services</p>
            <p className="text-foreground mt-0.5 text-sm font-medium">
              {active_services.length ? active_services.join(', ') : '—'}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className={sectionLabelClass}>Management Fee</p>
            <p className="text-foreground mt-1 text-sm font-medium">
              {(() => {
                const type = fee_type as FeeType | '';
                if (type === 'Percentage' && typeof fee_percentage === 'number')
                  return `${fee_percentage}%`;
                if (type === 'Flat Rate' && typeof management_fee === 'number')
                  return formatCurrency(management_fee);
                return '—';
              })()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const editBanking = (
    <div className="relative space-y-4">
      {error ? (
        <div
          role="alert"
          className="rounded border border-red-300/80 bg-red-100 p-3 text-sm font-medium text-red-700 shadow-sm dark:border-red-800 dark:bg-red-900/40 dark:text-red-300"
        >
          {error}
        </div>
      ) : null}

      {/* Banking Edit Section */}
      <div className="space-y-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h4 className="text-foreground text-base font-semibold">Banking &amp; Financials</h4>
          <div className="ml-auto flex flex-wrap items-center gap-3 sm:flex-nowrap">
            <Button
              variant="ghost"
              onClick={() => {
                setEditingBanking(false);
                setError(null);
              }}
              className="min-h-[2.75rem]"
            >
              Cancel
            </Button>
            <Button onClick={onSaveBanking} disabled={saving} className="min-h-[2.75rem]">
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">
              Property Reserve ($)
            </label>
            <div className="relative">
              <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
                $
              </span>
              <input
                type="number"
                value={reserve}
                onChange={(e) => setReserve(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                className={`border-border bg-background text-foreground h-11 w-full rounded-md border pr-3 pl-7 text-sm transition-colors ${fieldFocusRing}`}
                placeholder="e.g., 50000.00"
                step={0.01}
                min={0}
              />
            </div>
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">
              Operating Bank Account
            </label>
            <Dropdown
              value={operatingId}
              onChange={(value) => {
                if (value === 'create-new-account') {
                  setCreateTarget('operating');
                  setShowCreateBank(true);
                  return;
                }
                setOperatingId(value);
              }}
              options={[
                ...(bankAccounts || []).map((a) => ({
                  value: a.id,
                  label: `${a.name} - ${a.account_number ? `****${String(a.account_number).slice(-4)}` : 'No account number'}`,
                })),
                { value: 'create-new-account', label: '✓ Create New Bank Account' },
              ]}
              placeholder={loadingAccounts ? 'Loading...' : 'Select a bank account...'}
              className={fieldSurfaceClass}
            />
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">
              Deposit Trust Account
            </label>
            <Dropdown
              value={trustId}
              onChange={(value) => {
                if (value === 'create-new-account') {
                  setCreateTarget('trust');
                  setShowCreateBank(true);
                  return;
                }
                setTrustId(value);
              }}
              options={[
                ...(bankAccounts || []).map((a) => ({
                  value: a.id,
                  label: `${a.name} - ${a.account_number ? `****${String(a.account_number).slice(-4)}` : 'No account number'}`,
                })),
                { value: 'create-new-account', label: '✓ Create New Bank Account' },
              ]}
              placeholder={loadingAccounts ? 'Loading...' : 'Select a bank account...'}
              className={fieldSurfaceClass}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const editServices = (
    <div className="relative space-y-4">
      {error ? (
        <div
          role="alert"
          className="rounded border border-red-300/80 bg-red-100 p-3 text-sm font-medium text-red-700 shadow-sm dark:border-red-800 dark:bg-red-900/40 dark:text-red-300"
        >
          {error}
        </div>
      ) : null}

      {/* Management Services Edit Section */}
      <div className="space-y-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h4 className="text-foreground text-base font-semibold">Management Services</h4>
          <div className="ml-auto flex flex-wrap items-center gap-3 sm:flex-nowrap">
            <Button
              variant="ghost"
              onClick={() => {
                setEditingServices(false);
                setError(null);
              }}
              className="min-h-[2.75rem]"
            >
              Cancel
            </Button>
            <Button
              onClick={onSaveServices}
              disabled={saving || !!validateServices()}
              className="min-h-[2.75rem]"
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">
              Management Scope
            </label>
            <SelectWithDescription
              value={management_scope || ''}
              onChange={(v) => setManagementScope((v || '') as MgmtScope | '')}
              options={[
                { value: 'Building', label: 'Building', description: 'Manage entire property' },
                { value: 'Unit', label: 'Unit', description: 'Manage specific units' },
              ]}
              placeholder="Select scope..."
              triggerClassName={fieldSurfaceClass}
            />
          </div>
          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">
              Service Assignment *
            </label>
            <SelectWithDescription
              value={service_assignment || ''}
              onChange={(v) => setServiceAssignment((v || '') as AssignmentLevel | '')}
              options={[
                { value: 'Property Level', label: 'Property Level' },
                { value: 'Unit Level', label: 'Unit Level' },
              ]}
              placeholder="Select level..."
              triggerClassName={fieldSurfaceClass}
            />
          </div>
          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">Service Plan *</label>
            <SelectWithDescription
              value={service_plan || ''}
              onChange={(v) => setServicePlan((v || '') as ServicePlan | '')}
              options={[
                { value: 'Full', label: 'Full' },
                { value: 'Basic', label: 'Basic' },
                { value: 'A-la-carte', label: 'A-la-carte' },
              ]}
              placeholder="Select plan..."
              triggerClassName={fieldSurfaceClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-foreground mb-1 block text-sm font-medium">
              Active Services
            </label>
            <div className="border-border bg-muted/20 dark:bg-muted/10 grid grid-cols-1 gap-2 rounded-md border p-3 shadow-inner sm:grid-cols-2">
              {ALL_SERVICES.map((svc) => {
                const checked = (active_services || []).includes(svc);
                return (
                  <label key={svc} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      className="border-border accent-primary h-4 w-4 rounded"
                      onChange={(e) => {
                        const curr = new Set(active_services || []);
                        if (e.target.checked) curr.add(svc);
                        else curr.delete(svc);
                        setActiveServices(Array.from(curr) as ServiceName[]);
                      }}
                    />
                    <span>{svc}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        <div className="border-border border-t pt-6">
          <h4 className="text-foreground mb-3 text-sm font-semibold tracking-[0.05em]">
            Management Fees
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-foreground mb-1 block text-sm font-medium">
                Fee Assignment *
              </label>
              <SelectWithDescription
                value={fee_assignment || ''}
                onChange={(v) => setFeeAssignment((v || '') as FeeAssignment | '')}
                options={[
                  { value: 'Building', label: 'Building' },
                  { value: 'Unit', label: 'Unit' },
                ]}
                placeholder="Select assignment..."
                triggerClassName={fieldSurfaceClass}
              />
            </div>
            {fee_assignment === 'Building' && (
              <>
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    Fee Type *
                  </label>
                  <SelectWithDescription
                    value={fee_type || ''}
                    onChange={(v) => setFeeType((v || '') as FeeType | '')}
                    options={[
                      { value: 'Percentage', label: 'Percentage of rent' },
                      { value: 'Flat Rate', label: 'Flat Rate' },
                    ]}
                    placeholder="Select type..."
                    triggerClassName={fieldSurfaceClass}
                  />
                </div>
                {fee_type === 'Percentage' && (
                  <div>
                    <label className="text-foreground mb-1 block text-sm font-medium">
                      Fee Percentage *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={fee_percentage}
                        onChange={(e) =>
                          setFeePercentage(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        className={`${inputFieldWithSuffixClass} placeholder:text-muted-foreground`}
                        placeholder="e.g., 8"
                        step={0.01}
                        min={0}
                        max={100}
                      />
                      <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
                        %
                      </span>
                    </div>
                  </div>
                )}
                {fee_type === 'Flat Rate' && (
                  <div>
                    <label className="text-foreground mb-1 block text-sm font-medium">
                      Management Fee *
                    </label>
                    <div className="relative">
                      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
                        $
                      </span>
                      <input
                        type="number"
                        value={management_fee}
                        onChange={(e) =>
                          setManagementFee(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        className={`${inputFieldClass} placeholder:text-muted-foreground pr-3 pl-8`}
                        placeholder="e.g., 100.00"
                        step={0.01}
                        min={0}
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    Billing Frequency *
                  </label>
                  <SelectWithDescription
                    value={billing_frequency || ''}
                    onChange={(v) => setBillingFrequency((v || '') as BillingFrequency | '')}
                    options={[
                      { value: 'Monthly', label: 'Monthly' },
                      { value: 'Annual', label: 'Annual' },
                    ]}
                    placeholder="Select frequency..."
                    triggerClassName={fieldSurfaceClass}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div
        className={`surface-card surface-card--muted relative p-6 text-sm ${
          isEditing ? 'ring-primary/25 ring-2' : ''
        }`}
      >
        {isEditing && (
          <div className="bg-primary/80 absolute top-5 bottom-5 left-0 w-[2px] rounded-r-sm" />
        )}
        {editingBanking ? editBanking : editingServices ? editServices : view}
      </div>

      <CreateBankAccountModal
        isOpen={showCreateBank}
        onClose={() => {
          setShowCreateBank(false);
          setCreateTarget(null);
        }}
        onSuccess={(newAccount: any) => {
          const id = String(newAccount?.id ?? newAccount?.bankAccount?.id ?? '');
          const name = newAccount?.name ?? newAccount?.bankAccount?.name ?? 'New Bank Account';
          const account_number =
            newAccount?.account_number ?? newAccount?.bankAccount?.account_number ?? null;
          setBankAccounts((prev) => [
            { id, name, account_number },
            ...prev.filter((a) => a.id !== id),
          ]);
          if (createTarget === 'operating') setOperatingId(id);
          if (createTarget === 'trust') setTrustId(id);
          setCreateTarget(null);
        }}
      />
    </>
  );
}
