'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SelectWithDescription } from '@/components/ui/SelectWithDescription';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

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

const fieldSurfaceClass =
  'border border-[var(--surface-highlight-border)] shadow-sm bg-[var(--surface-highlight)] backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-colors';
const inputFieldClass = `w-full h-9 px-3 rounded-md text-sm text-foreground focus-visible:outline-none ${fieldSurfaceClass}`;
const inputFieldWithSuffixClass = `${inputFieldClass} pr-10`;
const textAreaFieldClass =
  'w-full min-h-[120px] rounded-md border border-[var(--surface-highlight-border)] shadow-sm bg-[var(--surface-highlight)] p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-colors';

interface UnitFinancialServicesCardProps {
  fin?: {
    cash_balance?: number;
    security_deposits?: number;
    reserve?: number;
    available_balance?: number;
    prepayments?: number;
  };
  rent?: number | null;
  prepayments?: number | null;
  property: any;
  unit?: any;
  leaseId?: string | null;
}

export default function UnitFinancialServicesCard({
  fin,
  rent,
  prepayments,
  property,
  unit,
  leaseId,
}: UnitFinancialServicesCardProps) {
  const [editingServices, setEditingServices] = useState(false);
  const [editingFees, setEditingFees] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingServices, setSavingServices] = useState(false);
  const [savingFees, setSavingFees] = useState(false);

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
    const fee = (property as any)?.fee_dollar_amount;
    return (property as any)?.fee_type === 'Percentage'
      ? Number(pct ?? fee) || ''
      : typeof pct === 'number'
        ? pct
        : '';
  });
  const [feeDollarAmount, setFeeDollarAmount] = useState<number | ''>(() => {
    const fee = (property as any)?.fee_dollar_amount;
    return (property as any)?.fee_type === 'Flat Rate'
      ? Number(fee) || ''
      : typeof fee === 'number'
        ? fee
        : '';
  });
  const [billing_frequency, setBillingFrequency] = useState<BillingFrequency | ''>(
    (property as any)?.billing_frequency || '',
  );
  const [billPayList, setBillPayList] = useState<string>(() => {
    const unitValue = (unit as any)?.bill_pay_list ?? (unit as any)?.billPayList;
    if (typeof unitValue === 'string') return unitValue;
    const propertyValue = (property as any)?.bill_pay_list ?? (property as any)?.billPayList;
    return typeof propertyValue === 'string' ? propertyValue : '';
  });
  const [billPayNotes, setBillPayNotes] = useState<string>(() => {
    const unitValue = (unit as any)?.bill_pay_notes ?? (unit as any)?.billPayNotes;
    if (typeof unitValue === 'string') return unitValue;
    const propertyValue = (property as any)?.bill_pay_notes ?? (property as any)?.billPayNotes;
    return typeof propertyValue === 'string' ? propertyValue : '';
  });
  const initialPropertyRef = useRef(property);
  const initialUnitRef = useRef(unit);

  useEffect(() => {
    if (editingServices || editingFees) return;
    if (initialPropertyRef.current === property && initialUnitRef.current === unit) return;
    initialPropertyRef.current = property;
    initialUnitRef.current = unit;
    setManagementScope(((property as any)?.management_scope || '') as MgmtScope | '');
    setServiceAssignment(((property as any)?.service_assignment || '') as AssignmentLevel | '');
    setServicePlan(((property as any)?.service_plan || '') as ServicePlan | '');
    setActiveServices(
      Array.isArray((property as any)?.active_services) ? (property as any).active_services : [],
    );
    setFeeAssignment(((property as any)?.fee_assignment || '') as FeeAssignment | '');
    setFeeType(((property as any)?.fee_type || '') as FeeType | '');
    setFeePercentage(() => {
      const pct = (property as any)?.fee_percentage;
      const fee = (property as any)?.fee_dollar_amount;
      return (property as any)?.fee_type === 'Percentage'
        ? Number(pct ?? fee) || ''
        : typeof pct === 'number'
          ? pct
          : '';
    });
    setFeeDollarAmount(() => {
      const fee = (property as any)?.fee_dollar_amount;
      return (property as any)?.fee_type === 'Flat Rate'
        ? Number(fee) || ''
        : typeof fee === 'number'
          ? fee
          : '';
    });
    setBillingFrequency(((property as any)?.billing_frequency || '') as BillingFrequency | '');
    const nextList = (() => {
      const unitValue = (unit as any)?.bill_pay_list ?? (unit as any)?.billPayList;
      if (typeof unitValue === 'string') return unitValue;
      const propertyValue = (property as any)?.bill_pay_list ?? (property as any)?.billPayList;
      return typeof propertyValue === 'string' ? propertyValue : '';
    })();
    setBillPayList(nextList);
    const nextNotes = (() => {
      const unitValue = (unit as any)?.bill_pay_notes ?? (unit as any)?.billPayNotes;
      if (typeof unitValue === 'string') return unitValue;
      const propertyValue = (property as any)?.bill_pay_notes ?? (property as any)?.billPayNotes;
      return typeof propertyValue === 'string' ? propertyValue : '';
    })();
    setBillPayNotes(nextNotes);
  }, [property, unit, editingServices, editingFees]);

  const fmt = (n?: number | null) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);

  // Fetch CSRF when entering edit mode
  useEffect(() => {
    if (!editingServices && !editingFees) return;
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
  }, [editingServices, editingFees]);

  // Auto-select all active services when selecting Full plan
  useEffect(() => {
    if (service_plan === 'Full') {
      setActiveServices([...ALL_SERVICES]);
    }
  }, [service_plan]);

  const hasBillPay = useMemo(() => (active_services || []).includes('Bill Pay'), [active_services]);
  const feeValueDisplay = useMemo(() => {
    if (fee_type === 'Percentage' && typeof fee_percentage === 'number')
      return `${fee_percentage}%`;
    if (fee_type === 'Flat Rate' && typeof feeDollarAmount === 'number')
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(feeDollarAmount);
    return null;
  }, [fee_type, fee_percentage, feeDollarAmount]);
  const feeValueLabel = useMemo(() => {
    if (!fee_type) return 'FEE VALUE';
    return fee_type.toLowerCase().includes('percent') ? 'FEE PERCENTAGE' : 'FEE DOLLAR AMOUNT';
  }, [fee_type]);

  const hasManagementServices = useMemo(
    () =>
      Boolean(
        service_assignment ||
          service_plan ||
          (active_services || []).length ||
          (hasBillPay && (billPayList.trim().length || billPayNotes.trim().length)),
      ),
    [service_assignment, service_plan, active_services, hasBillPay, billPayList, billPayNotes],
  );

  const hasManagementFees = useMemo(
    () => Boolean(fee_assignment || fee_type || feeValueDisplay || billing_frequency),
    [fee_assignment, fee_type, feeValueDisplay, billing_frequency],
  );

  function validateServices(): string | null {
    if (!service_assignment) return 'Service assignment is required';
    if (!service_plan) return 'Service plan is required';
    return null;
  }

  function validateFees(): string | null {
    if (!fee_assignment) return 'Fee assignment is required';
    if (fee_assignment === 'Building') {
      if (!fee_type) return 'Fee type is required';
      if (fee_type === 'Percentage' && (fee_percentage === '' || fee_percentage == null))
        return 'Fee percentage is required';
      if (fee_type === 'Flat Rate' && (feeDollarAmount === '' || feeDollarAmount == null))
        return 'Fee dollar amount is required';
      if (!billing_frequency) return 'Billing frequency is required';
    }
    return null;
  }

  function buildBasePropertyPayload() {
    return {
      name: property.name,
      address_line1: property.address_line1,
      address_line2: property.address_line2 || null,
      address_line3: property.address_line3 || null,
      city: property.city,
      state: property.state,
      postal_code: property.postal_code,
      country: property.country || 'United States',
      status: property.status || 'Active',
      property_type: (property as any).property_type ?? null,
      reserve: property.reserve ?? 0,
      year_built: property.year_built ?? null,
    };
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
      setSavingServices(true);
      setError(null);
      const body: any = {
        ...buildBasePropertyPayload(),
        management_scope: management_scope || null,
        service_assignment: service_assignment || null,
        service_plan: service_plan || null,
        active_services:
          Array.isArray(active_services) && active_services.length ? active_services : null,
        bill_pay_list: hasBillPay && billPayList.trim().length ? billPayList.trim() : null,
        bill_pay_notes: hasBillPay && billPayNotes.trim().length ? billPayNotes.trim() : null,
      };
      const res = await fetch(`/api/properties/${property.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => null as Record<string, unknown> | null);
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to save management services');
      }
      if (payload && typeof payload === 'object') {
        const updated = payload as any;
        setManagementScope((updated?.management_scope || '') as MgmtScope | '');
        setServiceAssignment((updated?.service_assignment || '') as AssignmentLevel | '');
        setServicePlan((updated?.service_plan || '') as ServicePlan | '');
        setActiveServices(Array.isArray(updated?.active_services) ? updated.active_services : []);
        setFeeAssignment((updated?.fee_assignment || '') as FeeAssignment | '');
        setFeeType((updated?.fee_type || '') as FeeType | '');
        setFeePercentage(() => {
          const pct = updated?.fee_percentage;
          const fee = updated?.fee_dollar_amount;
          return updated?.fee_type === 'Percentage'
            ? Number(pct ?? fee) || ''
            : typeof pct === 'number'
              ? pct
              : '';
        });
        setFeeDollarAmount(() => {
          const fee = updated?.fee_dollar_amount;
          return updated?.fee_type === 'Flat Rate'
            ? Number(fee) || ''
            : typeof fee === 'number'
              ? fee
              : '';
        });
        setBillingFrequency((updated?.billing_frequency || '') as BillingFrequency | '');
        setBillPayList(updated?.bill_pay_list || '');
        setBillPayNotes(updated?.bill_pay_notes || '');
      }
      setEditingServices(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save management services');
    } finally {
      setSavingServices(false);
    }
  }

  async function onSaveFees() {
    const msg = validateFees();
    if (msg) {
      setError(msg);
      return;
    }
    if (!csrfToken) {
      setError('CSRF token not found');
      return;
    }
    try {
      setSavingFees(true);
      setError(null);
      const body: any = {
        ...buildBasePropertyPayload(),
        fee_assignment: fee_assignment || null,
        fee_type: fee_type || null,
        fee_percentage:
          fee_type === 'Percentage' && typeof fee_percentage === 'number' ? fee_percentage : null,
        fee_dollar_amount:
          fee_type === 'Flat Rate' && typeof feeDollarAmount === 'number' ? feeDollarAmount : null,
        billing_frequency: billing_frequency || null,
      };
      const res = await fetch(`/api/properties/${property.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => null as Record<string, unknown> | null);
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to save management fees');
      }
      if (payload && typeof payload === 'object') {
        const updated = payload as any;
        setFeeAssignment((updated?.fee_assignment || '') as FeeAssignment | '');
        setFeeType((updated?.fee_type || '') as FeeType | '');
        setFeePercentage(() => {
          const pct = updated?.fee_percentage;
          const fee = updated?.fee_dollar_amount;
          return updated?.fee_type === 'Percentage'
            ? Number(pct ?? fee) || ''
            : typeof pct === 'number'
              ? pct
              : '';
        });
        setFeeDollarAmount(() => {
          const fee = updated?.fee_dollar_amount;
          return updated?.fee_type === 'Flat Rate'
            ? Number(fee) || ''
            : typeof fee === 'number'
              ? fee
              : '';
        });
        setBillingFrequency((updated?.billing_frequency || '') as BillingFrequency | '');
      }
      setEditingFees(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save management fees');
    } finally {
      setSavingFees(false);
    }
  }

  const showFinancials = !editingServices && !editingFees;
  const financialSection = showFinancials ? (
    <div className="border-border mb-4 border-b pb-4">
      <div className="mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Balance:</span>
          <span className="text-foreground text-sm">
            {fmt(fin?.available_balance ?? fin?.cash_balance)}
          </span>
        </div>
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <span>Deposits held:</span>
          <span>{fmt(fin?.security_deposits)}</span>
        </div>
      </div>
      {leaseId && (
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" className="text-xs">
            Receive payment
          </Button>
          <Link href={`/leases/${leaseId}`} className="text-primary text-sm hover:underline">
            Lease ledger
          </Link>
        </div>
      )}
    </div>
  ) : null;

  const managementServicesView = (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-foreground text-base font-semibold">Management Services</h3>
        <button
          onClick={() => {
            setError(null);
            setEditingFees(false);
            setEditingServices(true);
          }}
          className="text-primary text-sm hover:underline"
        >
          Edit
        </button>
      </div>
      {hasManagementServices ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              ASSIGNMENT LEVEL
            </p>
            <p className="text-foreground mt-1 text-sm">{(service_assignment as string) || '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              SERVICE PLAN
            </p>
            <p className="text-foreground mt-1 text-sm">{(service_plan as string) || '—'}</p>
          </div>
          {active_services.length ? (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                ACTIVE SERVICES
              </p>
              <p className="text-foreground mt-1 text-sm">{active_services.join(', ')}</p>
            </div>
          ) : null}
          {hasBillPay && billPayList.trim().length ? (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                BILL PAY LIST
              </p>
              <p className="text-foreground mt-1 text-sm whitespace-pre-line">{billPayList}</p>
            </div>
          ) : null}
          {hasBillPay && billPayNotes.trim().length ? (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                BILL PAY NOTES
              </p>
              <p className="text-foreground mt-1 text-sm whitespace-pre-line">{billPayNotes}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Management services not configured</p>
      )}
    </div>
  );

  const managementFeesView = (
    <div className="border-border mt-6 border-t pt-4">
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-foreground text-base font-semibold">Management Fees</h3>
        <button
          onClick={() => {
            setError(null);
            setEditingServices(false);
            setEditingFees(true);
          }}
          className="text-primary text-sm hover:underline"
        >
          Edit
        </button>
      </div>
      {hasManagementFees ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fee_assignment ? (
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                FEE ASSIGNMENT
              </p>
              <p className="text-foreground mt-1 text-sm">{fee_assignment}</p>
            </div>
          ) : null}
          {fee_type ? (
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                FEE TYPE
              </p>
              <p className="text-foreground mt-1 text-sm">{fee_type}</p>
            </div>
          ) : null}
          {feeValueDisplay ? (
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {feeValueLabel}
              </p>
              <p className="text-foreground mt-1 text-sm">{feeValueDisplay}</p>
            </div>
          ) : null}
          {billing_frequency ? (
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                BILLING FREQUENCY
              </p>
              <p className="text-foreground mt-1 text-sm">{billing_frequency}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Management fees not configured</p>
      )}
    </div>
  );

  const managementServicesEdit = (
    <div className="relative space-y-4">
      {error ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <div className="space-y-6">
        <div className="mb-3 flex items-center gap-2">
          <h4 className="font-medium text-gray-900">Management Services</h4>
          <div className="ml-auto flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                setEditingServices(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={onSaveServices} disabled={savingServices || !!validateServices()}>
              {savingServices ? 'Saving…' : 'Save'}
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
            <div className="grid grid-cols-1 gap-2 rounded-md border border-[var(--surface-highlight-border)] bg-[var(--surface-highlight)] p-3 shadow-inner sm:grid-cols-2">
              {ALL_SERVICES.map((svc) => {
                const checked = (active_services || []).includes(svc);
                return (
                  <label key={svc} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      className="accent-primary h-4 w-4 rounded border-blue-300/70"
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
          {hasBillPay ? (
            <>
              <div className="sm:col-span-2">
                <label className="text-foreground mb-1 block text-sm font-medium">
                  Bill Pay List
                </label>
                <textarea
                  value={billPayList}
                  onChange={(e) => setBillPayList(e.target.value)}
                  className={textAreaFieldClass}
                  placeholder="List the bills to be paid for this unit..."
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-foreground mb-1 block text-sm font-medium">
                  Bill Pay Notes
                </label>
                <textarea
                  value={billPayNotes}
                  onChange={(e) => setBillPayNotes(e.target.value)}
                  className={textAreaFieldClass}
                  placeholder="Add any Bill Pay instructions or notes for this unit..."
                />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );

  const managementFeesEdit = (
    <div className="relative space-y-4">
      {error ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <div className="space-y-6">
        <div className="mb-3 flex items-center gap-2">
          <h4 className="font-medium text-gray-900">Management Fees</h4>
          <div className="ml-auto flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                setEditingFees(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={onSaveFees} disabled={savingFees || !!validateFees()}>
              {savingFees ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>

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
          {fee_assignment === 'Building' ? (
            <>
              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">Fee Type *</label>
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
              {fee_type === 'Percentage' ? (
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
                    <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2">
                      %
                    </span>
                  </div>
                </div>
              ) : null}
              {fee_type === 'Flat Rate' ? (
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    Fee Dollar Amount *
                  </label>
                  <div className="relative">
                    <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">
                      $
                    </span>
                    <input
                      type="number"
                      value={feeDollarAmount}
                      onChange={(e) =>
                        setFeeDollarAmount(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      className={`${inputFieldClass} placeholder:text-muted-foreground pr-3 pl-8`}
                      placeholder="e.g., 100.00"
                      step={0.01}
                      min={0}
                    />
                  </div>
                </div>
              ) : null}
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
          ) : null}
        </div>
      </div>
    </div>
  );

  const view = (
    <div>
      {financialSection}
      {managementServicesView}
      {managementFeesView}
    </div>
  );

  const servicesEditView = (
    <div>
      {financialSection}
      {managementServicesEdit}
    </div>
  );

  const feesEditView = (
    <div>
      {financialSection}
      {managementFeesEdit}
    </div>
  );

  return (
    <div
      className={`border-primary/30 relative rounded-lg border p-4 text-sm ${editingServices || editingFees ? 'bg-white shadow-lg' : 'bg-primary/5'}`}
    >
      {editingServices && (
        <div className="bg-primary absolute top-2 bottom-2 left-0 w-0.5 rounded-r-sm" />
      )}
      {editingFees && (
        <div className="bg-primary absolute top-2 bottom-2 left-0 w-0.5 rounded-r-sm" />
      )}
      {editingServices ? servicesEditView : editingFees ? feesEditView : view}
    </div>
  );
}
