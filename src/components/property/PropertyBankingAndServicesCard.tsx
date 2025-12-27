'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dropdown } from '@/components/ui/Dropdown';
import CreateBankAccountModal from '@/components/CreateBankAccountModal';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type BankAccount = { id: string; name: string; account_number?: string | null; last4?: string | null };

type GlBalanceResponse = {
  success?: boolean;
  orgId?: string;
  asOfDate?: string;
  source?: 'cache' | 'live';
  data?: Array<{
    glAccountId: string;
    propertyId: string | null;
    balance: number;
  }>;
  error?: string;
};

// Management Services Types
type MgmtScope = 'Building' | 'Unit';
type AssignmentLevel = 'Property Level' | 'Unit Level';
type PropertyBanking = {
  id: string;
  reserve?: number | null;
  operating_bank_gl_account_id?: string | null;
  deposit_trust_gl_account_id?: string | null;
  management_scope?: MgmtScope | '' | null;
  service_assignment?: AssignmentLevel | '' | null;
  operating_account?: BankAccount | null;
  deposit_trust_account?: BankAccount | null;
};

const fieldFocusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const fieldSurfaceClass = `inline-flex h-11 w-full items-center justify-between rounded-md border border-border bg-background px-3 text-left text-sm text-foreground transition-colors ${fieldFocusRing}`;
const eyebrowLabelClass = 'eyebrow-label';
const metricValueClass = 'text-base font-semibold text-foreground';
const detailLabelClass = 'text-sm font-medium text-muted-foreground';
const detailValueClass = 'text-base font-medium text-foreground';
type CreateBankAccountResult =
  | BankAccount
  | {
      id?: string | number | null;
      name?: string | null;
      account_number?: string | null;
      last4?: string | null;
      bankAccount?: BankAccount | null;
    };

const normalizeAccount = (input: CreateBankAccountResult): BankAccount => {
  if (input && typeof input === 'object' && 'bankAccount' in input && input.bankAccount) {
    const acc = input.bankAccount;
    return {
      id: String(acc?.id ?? ''),
      name: acc?.name ?? 'New Bank Account',
      account_number: acc?.account_number ?? null,
      last4: acc?.last4 ?? null,
    };
  }
  const acc = input as BankAccount;
  return {
    id: String(acc?.id ?? ''),
    name: acc?.name ?? 'New Bank Account',
    account_number: acc?.account_number ?? null,
    last4: acc?.last4 ?? null,
  };
};

export default function PropertyBankingAndServicesCard({
  property,
  fin,
  showBanking = true,
  showServices = true,
}: {
  property: PropertyBanking;
  fin?: {
    cash_balance?: number;
    security_deposits?: number;
    reserve?: number;
    available_balance?: number;
    as_of?: string;
  };
  showBanking?: boolean;
  showServices?: boolean;
}) {
  const [editingBanking, setEditingBanking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  // Banking state
  const [reserve, setReserve] = useState<number>(property.reserve || 0);
  const [operatingId, setOperatingId] = useState<string>(property.operating_bank_gl_account_id || '');
  const [trustId, setTrustId] = useState<string>(property.deposit_trust_gl_account_id || '');

  // Banking accounts state
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [showCreateBank, setShowCreateBank] = useState(false);
  const [createTarget, setCreateTarget] = useState<'operating' | 'trust' | null>(null);

  // GL balances (as-of)
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [trustBalance, setTrustBalance] = useState<number | null>(null);

  // Management services state
  const management_scope = property?.management_scope || '';
  const service_assignment = property?.service_assignment || '';
  const [assignedPlanName, setAssignedPlanName] = useState<string | null>(null);

  useEffect(() => {
    if (!editingBanking) return;
    let cancelled = false;
    const load = async () => {
      try {
        setLoadingAccounts(true);
        const res = await fetch('/api/gl-accounts/bank-accounts');
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

  useEffect(() => {
    let cancelled = false;
    const asOfDate =
      typeof fin?.as_of === 'string' && fin.as_of.length >= 10
        ? fin.as_of.slice(0, 10)
        : new Date().toISOString().slice(0, 10);

    const fetchOne = async (glAccountId: string): Promise<number | null> => {
      const url = new URL('/api/gl-accounts/balances', window.location.origin);
      url.searchParams.set('asOfDate', asOfDate);
      url.searchParams.set('propertyId', String(property.id));
      url.searchParams.set('glAccountId', glAccountId);
      url.searchParams.set('useCache', 'true');
      const res = await fetch(url.toString(), { credentials: 'include' });
      const json = (await res.json().catch(() => ({}))) as GlBalanceResponse;
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to load GL balances');
      }
      const first = Array.isArray(json?.data) ? json.data[0] : null;
      const balance =
        first && typeof first.balance === 'number' && Number.isFinite(first.balance)
          ? first.balance
          : null;
      return balance;
    };

    const load = async () => {
      try {
        if (!property?.id) return;
        if (!trustId) return;
        setLoadingBalances(true);

        const tr = await fetchOne(trustId);

        if (cancelled) return;
        setTrustBalance(tr);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load GL balances');
      } finally {
        if (!cancelled) setLoadingBalances(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [property?.id, trustId, fin?.as_of]);

  useEffect(() => {
    let cancelled = false;
    const loadAssignment = async () => {
      try {
        if (property?.service_assignment === 'Unit Level') {
          if (!cancelled) setAssignedPlanName(null);
          return;
        }

        const res = await fetch(
          `/api/services/assignments?propertyId=${encodeURIComponent(property.id)}`,
        );
        const json = await res.json();
        if (cancelled) return;
        if (Array.isArray(json?.data) && json.data.length) {
          setAssignedPlanName(json.data[0]?.plan_name ? String(json.data[0].plan_name) : null);
        } else {
          setAssignedPlanName(null);
        }
      } catch (error) {
        if (!cancelled)
          setError(error instanceof Error ? error.message : 'Failed to load assignment services');
      }
    };
    loadAssignment();
    return () => {
      cancelled = true;
    };
  }, [property]);

  // Fetch CSRF when entering edit mode
  useEffect(() => {
    if (!editingBanking) return;
    let cancelled = false;
    const fetchToken = async () => {
      try {
        const res = await fetch('/api/csrf', { credentials: 'include' });
        const j = (await res.json().catch(() => ({}))) as { token?: string };
        if (!cancelled) setCsrfToken(j?.token || null);
      } catch {
        if (!cancelled) setCsrfToken(null);
      }
    };
    fetchToken();
    return () => {
      cancelled = true;
    };
  }, [editingBanking]);

  const operatingAccount = useMemo(() => property.operating_account, [property]);
  const trustAccount = useMemo(() => property.deposit_trust_account, [property]);
  const sectionLabelClass = 'eyebrow-label';
  const isEditing = showBanking && editingBanking;

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
          operating_bank_gl_account_id: operatingId || null,
          deposit_trust_gl_account_id: trustId || null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
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

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const view = (
    <div className="space-y-3">
      {/* Banking Section */}
      {showBanking && (
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

            {trustId && (
              <div className="space-y-1">
                <div className="flex items-baseline justify-between gap-6">
                  <p className={detailLabelClass}>Trust account balance (as of)</p>
                  <p className={metricValueClass}>
                    {loadingBalances ? '—' : formatCurrency(trustBalance ?? 0)}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-baseline justify-between gap-6">
                <p className={detailLabelClass}>Available balance</p>
                <p className={metricValueClass}>{formatCurrency(fin?.available_balance ?? 0)}</p>
              </div>
              <p className="text-muted-foreground text-xs font-medium">
                As of{' '}
                {fin?.as_of
                  ? (() => {
                      // Format YYYY-MM-DD to MM/DD/YYYY without timezone conversion
                      const [year, month, day] = fin.as_of.split('-');
                      return `${month}/${day}/${year}`;
                    })()
                  : new Date().toLocaleDateString()}
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
      )}

      {showServices && (
        <div className="card-divider border-t pt-2">
          {/* Management Services Section */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h4 className="text-foreground text-lg font-semibold">Management Services</h4>
            <Button
              asChild
              variant="link"
              className="text-primary hover:text-primary/80 px-1 text-sm font-semibold"
            >
              <Link href={`/properties/${property.id}/services`}>Manage</Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className={sectionLabelClass}>Management Scope</p>
              <p className="text-foreground mt-0.5 text-sm font-medium">
                {(management_scope as string) || '—'}
              </p>
            </div>
            <div>
              <p className={sectionLabelClass}>Service Assignment</p>
              <p className="text-foreground mt-0.5 text-sm font-medium">
                {(service_assignment as string) || '—'}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className={sectionLabelClass}>Service Plan</p>
              <p className="text-foreground mt-0.5 text-sm font-medium">
                {service_assignment === 'Unit Level'
                  ? 'Unit level (set per-unit)'
                  : assignedPlanName || '—'}
              </p>
            </div>
          </div>
        </div>
      )}
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
        {showBanking && editingBanking ? editBanking : view}
      </div>

      <CreateBankAccountModal
        isOpen={showCreateBank}
        onClose={() => {
          setShowCreateBank(false);
          setCreateTarget(null);
        }}
        onSuccess={(newAccount: CreateBankAccountResult) => {
          const account = normalizeAccount(newAccount);
          const id = account.id;
          const name = account.name;
          const account_number = account.account_number ?? null;
          setBankAccounts((prev) => [
            { id, name, account_number, last4: account.last4 ?? null },
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
