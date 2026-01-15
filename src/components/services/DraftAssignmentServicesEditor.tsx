'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label as FormLabel } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/transactions/formatting';
import { Body, Heading, Label } from '@/ui/typography';

type ServiceOffering = {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
  default_rate?: number | null;
  default_freq?: string | null;
  fee_type?: string | null;
};

type ServicePlanDetails = {
  id: string;
  name: string;
  amount_type: string | null;
  percent_basis: string | null;
  is_active: boolean | null;
  gl_account_id: string | null;
  default_fee_amount: number | null;
  default_fee_percent: number | null;
};

type ServicePlanRow = ServicePlanDetails & { offering_ids: string[] };

export type DraftServiceOfferingSelection = {
  selected: boolean;
  override: boolean;
  is_active: boolean;
  amount: string;
  frequency: string;
};

export type DraftServiceAssignment = {
  configured: boolean;
  plan_id: string | null;
  plan_name: string | null;
  override_global_values: boolean;
  plan_fee_frequency: string;
  plan_fee_amount: string;
  plan_fee_percent: string;
  resolved_plan_fee_amount: number | null;
  resolved_plan_fee_percent: number | null;
  a_la_carte_selections: Record<string, DraftServiceOfferingSelection>;
  included_service_active_overrides: Record<string, boolean>;
};

const DEFAULT_PLAN_AMOUNT_TYPE = 'flat';
const DEFAULT_PLAN_PERCENT_BASIS = 'lease_rent_amount';

function parseNumberValue(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isALaCartePlanName(name: string | null | undefined) {
  return (
    String(name || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '') === 'alacarte'
  );
}

const frequencyOptions = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'annually', label: 'Annually' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'one_time', label: 'One-time' },
  { value: 'per_event', label: 'Per event' },
  { value: 'per_job', label: 'Per job' },
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Annual', label: 'Annual' },
];

function formatOfferingDefault(offering: ServiceOffering) {
  const rate = offering.default_rate;
  const freq = offering.default_freq || 'monthly';
  const feeType = (offering.fee_type || 'Flat Rate').toLowerCase();
  const formattedRate =
    rate == null
      ? '—'
      : feeType.includes('percent')
        ? `${rate}%`
        : formatCurrency(Number(rate) || 0);
  return `${formattedRate} • ${String(freq).replace(/_/g, ' ')}`;
}

export const INITIAL_DRAFT_SERVICE_ASSIGNMENT: DraftServiceAssignment = {
  configured: false,
  plan_id: null,
  plan_name: null,
  override_global_values: false,
  plan_fee_frequency: 'Monthly',
  plan_fee_amount: '',
  plan_fee_percent: '',
  resolved_plan_fee_amount: null,
  resolved_plan_fee_percent: null,
  a_la_carte_selections: {},
  included_service_active_overrides: {},
};

export default function DraftAssignmentServicesEditor({
  draft,
  onChange,
  readOnly = false,
  title = 'Property Services',
}: {
  draft: DraftServiceAssignment;
  onChange: (next: DraftServiceAssignment) => void;
  readOnly?: boolean;
  title?: string;
}) {
  const [plans, setPlans] = useState<Array<{ id: string; name: string }>>([]);
  const [plansById, setPlansById] = useState<Record<string, ServicePlanRow>>({});
  const [offerings, setOfferings] = useState<ServiceOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planDetails, setPlanDetails] = useState<ServicePlanDetails | null>(null);
  const [planOfferingIds, setPlanOfferingIds] = useState<string[]>([]);
  const [overrideGlobalValues, setOverrideGlobalValues] = useState(false);
  const [planFeeFrequency, setPlanFeeFrequency] = useState('Monthly');
  const [planFeeAmount, setPlanFeeAmount] = useState('');
  const [planFeePercent, setPlanFeePercent] = useState('');
  const [aLaCarteQuery, setALaCarteQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const [isServiceEditDialogOpen, setIsServiceEditDialogOpen] = useState(false);
  const [editingOfferingId, setEditingOfferingId] = useState<string | null>(null);
  const [serviceEditForm, setServiceEditForm] = useState<{
    is_active: boolean;
    override: boolean;
    amount: string;
    frequency: string;
  }>({ is_active: true, override: false, amount: '', frequency: 'monthly' });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [plansRes, offeringsRes] = await Promise.all([
        fetch('/api/services/plans'),
        fetch('/api/services/catalog'),
      ]);

      const plansJson = await plansRes.json().catch(() => ({}));
      const offeringsJson = await offeringsRes.json().catch(() => ({}));

      if (!plansRes.ok) throw new Error('Failed to load service plans');
      if (!offeringsRes.ok) throw new Error('Failed to load service catalog');

      const allPlans: ServicePlanRow[] = Array.isArray(plansJson?.data)
        ? plansJson.data.map((p: any) => ({
            id: String(p.id),
            name: String(p.name || ''),
            amount_type: p.amount_type != null ? String(p.amount_type) : null,
            percent_basis: p.percent_basis != null ? String(p.percent_basis) : null,
            is_active: p.is_active === undefined ? true : Boolean(p.is_active),
            gl_account_id: p.gl_account_id != null ? String(p.gl_account_id) : null,
            default_fee_amount: p.default_fee_amount != null ? Number(p.default_fee_amount) : null,
            default_fee_percent:
              p.default_fee_percent != null ? Number(p.default_fee_percent) : null,
            offering_ids: Array.isArray(p.offering_ids)
              ? p.offering_ids.map((id: any) => String(id))
              : [],
          }))
        : [];

      const nextPlansById: Record<string, ServicePlanRow> = {};
      for (const row of allPlans) nextPlansById[row.id] = row;

      setPlans(
        allPlans
          .filter((p) => p.is_active !== false)
          .map((p) => ({ id: p.id, name: p.name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setPlansById(nextPlansById);

      const nextOfferings: ServiceOffering[] = Array.isArray(offeringsJson?.data)
        ? offeringsJson.data.map((row: any) => ({
            id: String(row.id),
            name: String(row.name || ''),
            category: String(row.category || ''),
            is_active: row.is_active === undefined ? true : Boolean(row.is_active),
            default_rate: row.default_rate != null ? Number(row.default_rate) : null,
            default_freq: row.default_freq != null ? String(row.default_freq) : null,
            fee_type: row.fee_type != null ? String(row.fee_type) : null,
          }))
        : [];

      setOfferings(nextOfferings);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load services';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const planName = useMemo(() => {
    if (draft.plan_name) return draft.plan_name;
    if (!draft.plan_id) return null;
    const row = plansById[draft.plan_id];
    return row?.name ?? null;
  }, [draft.plan_id, draft.plan_name, plansById]);

  const isALaCarte = useMemo(() => isALaCartePlanName(planName), [planName]);

  const activeOfferings = useMemo(
    () => offerings.filter((offering) => offering.is_active),
    [offerings],
  );

  const visibleOfferings = useMemo(() => {
    const q = aLaCarteQuery.trim().toLowerCase();
    const base = activeOfferings.slice().sort(
      (a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name),
    );
    if (!q) return base;
    return base.filter((offering) =>
      `${offering.name} ${offering.category}`.toLowerCase().includes(q),
    );
  }, [activeOfferings, aLaCarteQuery]);

  const selectedPlanOfferingIds = useMemo(() => {
    if (!draft.plan_id) return [];
    const row = plansById[draft.plan_id];
    return Array.isArray(row?.offering_ids) ? row.offering_ids : [];
  }, [draft.plan_id, plansById]);

  const assignedOfferings = useMemo(() => {
    const ids = new Set(selectedPlanOfferingIds);
    return activeOfferings
      .filter((o) => ids.has(o.id))
      .sort(
        (a, b) =>
          (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name),
      );
  }, [activeOfferings, selectedPlanOfferingIds]);

  const aLaCarteSelectedOfferings = useMemo(() => {
    return Object.entries(draft.a_la_carte_selections)
      .filter(([, v]) => v.selected)
      .map(([id]) => id);
  }, [draft.a_la_carte_selections]);

  const openAddPlanDialog = () => {
    if (readOnly) return;
    setSelectedPlanId(null);
    setPlanDetails(null);
    setPlanOfferingIds([]);
    setOverrideGlobalValues(false);
    setPlanFeeFrequency('Monthly');
    setPlanFeeAmount('');
    setPlanFeePercent('');
    setALaCarteQuery('');
    setIsPlanDialogOpen(true);
  };

  const openEditPlanDialog = () => {
    setSelectedPlanId(draft.plan_id);
    setOverrideGlobalValues(Boolean(draft.override_global_values));
    setPlanFeeFrequency(draft.plan_fee_frequency || 'Monthly');
    setPlanFeeAmount(draft.plan_fee_amount || '');
    setPlanFeePercent(draft.plan_fee_percent || '');
    setALaCarteQuery('');
    setIsPlanDialogOpen(true);
  };

  useEffect(() => {
    if (!isPlanDialogOpen) return;
    if (!selectedPlanId) {
      setPlanDetails(null);
      setPlanOfferingIds([]);
      return;
    }
    const row = plansById[selectedPlanId];
    if (!row) return;

    setPlanDetails(row);
    setPlanOfferingIds(Array.isArray(row.offering_ids) ? row.offering_ids : []);

    const isEditingExisting = draft.plan_id === selectedPlanId && draft.configured;
    const amountType = String(row.amount_type || DEFAULT_PLAN_AMOUNT_TYPE);
    if (isEditingExisting) return;

    setOverrideGlobalValues(false);
    setPlanFeeFrequency('Monthly');
    if (amountType === 'flat') {
      setPlanFeeAmount(row.default_fee_amount != null ? String(row.default_fee_amount) : '');
      setPlanFeePercent('');
    } else {
      setPlanFeePercent(row.default_fee_percent != null ? String(row.default_fee_percent) : '');
      setPlanFeeAmount('');
    }
  }, [draft.configured, draft.plan_id, isPlanDialogOpen, plansById, selectedPlanId]);

  const resolveIncludedServiceActive = useCallback(
    (offeringId: string) => draft.included_service_active_overrides[offeringId] ?? true,
    [draft.included_service_active_overrides],
  );

  const toggleIncludedServiceActive = useCallback(
    (offeringId: string, nextActive: boolean) => {
      onChange({
        ...draft,
        included_service_active_overrides: {
          ...draft.included_service_active_overrides,
          [offeringId]: nextActive,
        },
      });
    },
    [draft, onChange],
  );

  const openEditServiceDialog = useCallback(
    (offeringId: string) => {
      const current = draft.a_la_carte_selections[offeringId];
      const offering = offerings.find((o) => o.id === offeringId);
      const defaultAmount = offering?.default_rate != null ? String(offering.default_rate) : '';
      const defaultFrequency = offering?.default_freq != null ? String(offering.default_freq) : 'monthly';

      setEditingOfferingId(offeringId);
      setServiceEditForm({
        is_active: current?.is_active ?? true,
        override: current?.override ?? false,
        amount: current?.amount ?? defaultAmount,
        frequency: current?.frequency ?? defaultFrequency,
      });
      setIsServiceEditDialogOpen(true);
    },
    [draft.a_la_carte_selections, offerings],
  );

  const saveServiceEdit = useCallback(() => {
    if (!editingOfferingId) return;
    onChange({
      ...draft,
      a_la_carte_selections: {
        ...draft.a_la_carte_selections,
        [editingOfferingId]: {
          ...(draft.a_la_carte_selections[editingOfferingId] || {
            selected: true,
          }),
          selected: true,
          is_active: serviceEditForm.is_active,
          override: serviceEditForm.override,
          amount: serviceEditForm.amount,
          frequency: serviceEditForm.frequency,
        },
      },
    });
    setIsServiceEditDialogOpen(false);
    setEditingOfferingId(null);
  }, [draft, editingOfferingId, onChange, serviceEditForm]);

  const handleSavePlan = async () => {
    try {
      if (readOnly) return;
      setSaving(true);
      setError(null);

      if (!selectedPlanId) throw new Error('Select a plan.');
      const row = plansById[selectedPlanId];
      if (!row) throw new Error('Plan details are not loaded yet.');

      const isNextALaCarte = isALaCartePlanName(row.name);
      const planOfferingIdsForSave = Array.isArray(row.offering_ids) ? row.offering_ids : [];
      const nextDraftBase: DraftServiceAssignment = {
        ...draft,
        configured: true,
        plan_id: selectedPlanId,
        plan_name: row.name,
        override_global_values: isNextALaCarte ? false : overrideGlobalValues,
        plan_fee_frequency: isNextALaCarte ? 'Monthly' : planFeeFrequency || 'Monthly',
        plan_fee_amount: isNextALaCarte ? '' : planFeeAmount,
        plan_fee_percent: isNextALaCarte ? '' : planFeePercent,
        resolved_plan_fee_amount: null,
        resolved_plan_fee_percent: null,
      };

      const isPlanChanged = draft.plan_id !== selectedPlanId;
      const nextSelections = isPlanChanged ? {} : nextDraftBase.a_la_carte_selections;
      const nextIncludedOverrides = isNextALaCarte
        ? {}
        : planOfferingIdsForSave.reduce<Record<string, boolean>>((acc, id) => {
            const active = draft.included_service_active_overrides[id];
            acc[id] = active === undefined ? true : active;
            return acc;
          }, {});

      if (isNextALaCarte) {
        const selectedIds = Object.entries(nextSelections)
          .filter(([, v]) => v.selected)
          .map(([id]) => id);
        if (!selectedIds.length) {
          throw new Error('Select at least one service for A-la-carte.');
        }
        for (const id of selectedIds) {
          const sel = nextSelections[id];
          if (!sel) continue;
          if (sel.override) {
            const n = parseNumberValue(sel.amount);
            if (n == null || n <= 0) throw new Error('Override amount must be a positive number.');
            if (!sel.frequency) throw new Error('Override frequency is required.');
          }
        }

        onChange({
          ...nextDraftBase,
          a_la_carte_selections: nextSelections,
          included_service_active_overrides: nextIncludedOverrides,
          resolved_plan_fee_amount: null,
          resolved_plan_fee_percent: 0,
        });
        toast.success('A-la-carte plan configured');
        setIsPlanDialogOpen(false);
        return;
      }

      const amountType = String(row.amount_type || DEFAULT_PLAN_AMOUNT_TYPE);
      const planDefaultAmount = row.default_fee_amount != null ? Number(row.default_fee_amount) : null;
      const planDefaultPercent = row.default_fee_percent != null ? Number(row.default_fee_percent) : null;

      const nextPlanFeeAmount =
        amountType === 'flat'
          ? overrideGlobalValues
            ? parseNumberValue(planFeeAmount)
            : planDefaultAmount
          : null;
      const nextPlanFeePercent =
        amountType === 'percent'
          ? overrideGlobalValues
            ? parseNumberValue(planFeePercent)
            : planDefaultPercent
          : null;

      if (amountType === 'flat' && (nextPlanFeeAmount == null || nextPlanFeeAmount <= 0)) {
        throw new Error('Flat amount is required.');
      }
      if (amountType === 'percent' && (nextPlanFeePercent == null || nextPlanFeePercent <= 0)) {
        throw new Error('Percent value is required.');
      }

      onChange({
        ...nextDraftBase,
        a_la_carte_selections: nextSelections,
        included_service_active_overrides: nextIncludedOverrides,
        resolved_plan_fee_amount: nextPlanFeeAmount,
        resolved_plan_fee_percent: nextPlanFeePercent,
      });

      toast.success('Service plan configured');
      setIsPlanDialogOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save service plan';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const planSummary = planName || (draft.plan_id ? 'Selected plan' : 'No plan configured');
  const feeFrequency = draft.plan_fee_frequency || 'Monthly';
  const planFeeSummary =
    isALaCarte
      ? 'No plan fee'
      : draft.resolved_plan_fee_amount != null
        ? `${formatCurrency(Number(draft.resolved_plan_fee_amount) || 0)} ${feeFrequency}`
        : draft.resolved_plan_fee_percent != null
          ? `${draft.resolved_plan_fee_percent}% ${feeFrequency}`
          : 'No fee configured';

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <Body as="p" size="sm" tone="muted">
            Loading…
          </Body>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-destructive">
          <Body as="p" size="sm" className="text-destructive">
            {error}
          </Body>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle headingAs="h2" headingSize="h4">
            {title}
          </CardTitle>
          <CardDescription>
            Assign a service plan and view included services.
          </CardDescription>
          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Body as="p" size="sm" tone="muted">
                  Active Plan
                </Body>
                <Heading as="p" size="h4" className="font-semibold leading-tight">
                  {planSummary}
                </Heading>
              </div>
              <div className="text-right">
                <Body as="p" size="sm" tone="muted">
                  Plan Fee
                </Body>
                <Heading as="p" size="h4" className="font-semibold leading-tight">
                  {planFeeSummary}
                </Heading>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {draft.plan_id ? (
            <div className="rounded-lg border p-4">
              <div className="flex items-baseline justify-between gap-3">
                <Heading as="p" size="h5" className="font-medium">
                  Services
                </Heading>
                <Body as="p" size="sm" tone="muted" className="text-xs">
                  {isALaCarte ? 'Selected services' : 'Included services'}
                </Body>
              </div>

              {isALaCarte ? (
                aLaCarteSelectedOfferings.length ? (
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {aLaCarteSelectedOfferings.map((offeringId) => {
                      const offering = offerings.find((o) => o.id === offeringId);
                      const row = draft.a_la_carte_selections[offeringId];
                      if (!offering || !row) return null;
                      const overridden = Boolean(row.override);
                      const isPercent = (offering.fee_type || '').toLowerCase().includes('percent');
                      const displayAmount = overridden
                        ? row.amount
                          ? isPercent
                            ? `${row.amount}%`
                            : formatCurrency(Number(row.amount) || 0)
                          : '—'
                        : formatOfferingDefault(offering).split(' • ')[0];
                      const displayFrequency = overridden
                        ? row.frequency || offering.default_freq || 'monthly'
                        : offering.default_freq || 'monthly';
                      return (
                        <li key={offeringId} className="rounded-md border px-3 py-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <Label as="p" size="sm">
                                {offering.name}
                              </Label>
                              <Body as="p" size="xs" tone="muted">
                                {displayAmount} • {String(displayFrequency).replace(/_/g, ' ')}
                                {overridden ? ' (override)' : ''}
                              </Body>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <Body as="span" size="xs" tone="muted">
                                  {row.is_active ? 'Active' : 'Inactive'}
                                </Body>
                                <Switch
                                  checked={row.is_active}
                                  onCheckedChange={(checked) =>
                                    onChange({
                                      ...draft,
                                      a_la_carte_selections: {
                                        ...draft.a_la_carte_selections,
                                        [offeringId]: { ...row, is_active: checked },
                                      },
                                    })
                                  }
                                  disabled={readOnly}
                                  aria-label={`Set ${offering.name} ${row.is_active ? 'inactive' : 'active'}`}
                                />
                              </div>
                              {!readOnly ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditServiceDialog(offeringId)}
                                >
                                  Edit
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-muted-foreground mt-3 text-sm">No services selected yet.</p>
                )
              ) : assignedOfferings.length ? (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {assignedOfferings.map((offering) => {
                    const isActive = resolveIncludedServiceActive(offering.id);
                    return (
                      <li key={offering.id} className="rounded-md border px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <Label as="p" size="sm">
                            {offering.name}
                          </Label>
                          <div className="flex items-center gap-2">
                            <Body as="span" size="xs" tone="muted">
                              {isActive ? 'Active' : 'Inactive'}
                            </Body>
                            <Switch
                              checked={isActive}
                              onCheckedChange={(checked) => toggleIncludedServiceActive(offering.id, checked)}
                              disabled={readOnly}
                              aria-label={`Set ${offering.name} ${isActive ? 'inactive' : 'active'}`}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-muted-foreground mt-3 text-sm">No services are assigned to this plan.</p>
              )}
            </div>
          ) : null}

          <div className="flex justify-end">
            {draft.plan_id ? (
              <Button onClick={openEditPlanDialog} variant="outline">
                {readOnly ? 'View Plan' : 'View / Edit Plan'}
              </Button>
            ) : readOnly ? null : (
              <Button onClick={openAddPlanDialog}>Add Plan</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isServiceEditDialogOpen}
        onOpenChange={(open) => {
          setIsServiceEditDialogOpen(open);
          if (!open) setEditingOfferingId(null);
        }}
      >
        <DialogContent className="w-[640px] max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
            <DialogDescription>Modify service status and optional pricing overrides.</DialogDescription>
          </DialogHeader>

          {editingOfferingId ? (
            (() => {
              const offering = offerings.find((o) => o.id === editingOfferingId);
              if (!offering) return null;
              const defaultSummary = formatOfferingDefault(offering);
              const isPercent = (offering.fee_type || '').toLowerCase().includes('percent');
              return (
                <div className="space-y-4">
                  <div className="rounded-lg border p-3">
                    <Label as="p" size="sm">
                      {offering.name}
                    </Label>
                    <Body as="p" size="xs" tone="muted">
                      Default: {defaultSummary}
                    </Body>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <Label as="p" size="sm">
                        Active
                      </Label>
                      <Body as="p" size="xs" tone="muted">
                        Controls whether this service applies to this property.
                      </Body>
                    </div>
                    <Switch
                      checked={serviceEditForm.is_active}
                      onCheckedChange={(checked) =>
                        setServiceEditForm((prev) => ({ ...prev, is_active: checked }))
                      }
                      disabled={readOnly}
                    />
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border p-3">
                    <Checkbox
                      checked={serviceEditForm.override}
                      onCheckedChange={(checked) => {
                        if (readOnly) return;
                        setServiceEditForm((prev) => ({ ...prev, override: Boolean(checked) }));
                      }}
                      id="service-override"
                      disabled={readOnly}
                    />
                    <div className="space-y-0.5">
                      <Label htmlFor="service-override">Override default values</Label>
                      <p className="text-muted-foreground text-xs">
                        When enabled, set custom amount/frequency for this property.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Amount</Label>
                      <Input
                        inputMode="decimal"
                        value={serviceEditForm.amount}
                        onChange={(e) =>
                          setServiceEditForm((prev) => ({ ...prev, amount: e.target.value }))
                        }
                        disabled={readOnly || !serviceEditForm.override}
                        placeholder={isPercent ? 'e.g. 10 (percent)' : 'e.g. 100.00'}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Frequency</Label>
                      <Select
                        value={serviceEditForm.frequency}
                        onValueChange={(value) =>
                          setServiceEditForm((prev) => ({ ...prev, frequency: value }))
                        }
                        disabled={readOnly || !serviceEditForm.override}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {frequencyOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsServiceEditDialogOpen(false)}
                      disabled={saving}
                    >
                      {readOnly ? 'Close' : 'Cancel'}
                    </Button>
                    {!readOnly ? (
                      <Button type="button" onClick={saveServiceEdit} disabled={saving}>
                        Save
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })()
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isPlanDialogOpen}
        onOpenChange={(open) => {
          setIsPlanDialogOpen(open);
          if (!open) {
            setSelectedPlanId(null);
            setPlanDetails(null);
            setPlanOfferingIds([]);
            setOverrideGlobalValues(false);
            setPlanFeeFrequency('Monthly');
            setPlanFeeAmount('');
            setPlanFeePercent('');
            setALaCarteQuery('');
          }
        }}
      >
        <DialogContent className="w-[980px] max-w-[980px]">
          <DialogHeader>
            <DialogTitle>{draft.plan_id ? 'Edit Property Service Plan' : 'Add Property Service Plan'}</DialogTitle>
            <DialogDescription>
              Select a plan template to prefill defaults. Enable overrides to customize this property’s management fee values.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Service Plan</Label>
              <Select value={selectedPlanId ?? ''} onValueChange={(value) => setSelectedPlanId(value || null)}>
                <SelectTrigger disabled={readOnly}>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start gap-3 rounded-lg border p-3">
              {isALaCartePlanName(planDetails?.name) ? (
                <div className="space-y-1">
                  <Label as="p" size="sm">
                    A-la-carte mode
                  </Label>
                  <Body as="p" size="xs" tone="muted">
                    No plan-level fee. Select services below and optionally override each service’s pricing.
                  </Body>
                </div>
              ) : (
                <>
                  <Checkbox
                    checked={overrideGlobalValues}
                    onCheckedChange={(checked) => {
                      if (readOnly) return;
                      const next = Boolean(checked);
                      setOverrideGlobalValues(next);
                      if (!planDetails) return;
                      const amountType = String(planDetails.amount_type || DEFAULT_PLAN_AMOUNT_TYPE);
                      if (next) return;
                      if (amountType === 'flat') {
                        setPlanFeeAmount(
                          planDetails.default_fee_amount != null ? String(planDetails.default_fee_amount) : '',
                        );
                        setPlanFeePercent('');
                        return;
                      }
                      setPlanFeePercent(
                        planDetails.default_fee_percent != null ? String(planDetails.default_fee_percent) : '',
                      );
                      setPlanFeeAmount('');
                    }}
                    disabled={readOnly}
                    id="override-global-values"
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="override-global-values">Override global values</Label>
                    <p className="text-muted-foreground text-xs">
                      When enabled, override management fee values for this property without creating a new global plan.
                    </p>
                  </div>
                </>
              )}
            </div>

            {isALaCartePlanName(planDetails?.name) ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="a-la-carte-search">Select Services</Label>
                  <Input
                    id="a-la-carte-search"
                    value={aLaCarteQuery}
                    onChange={(e) => setALaCarteQuery(e.target.value)}
                    placeholder="Search services…"
                    disabled={readOnly}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border">
                    <div className="border-b px-3 py-2">
                      <Label as="p" size="sm">
                        Available
                      </Label>
                      <Body as="p" size="xs" tone="muted">
                        Select services to include for this property.
                      </Body>
                    </div>
                    <div className="max-h-[360px] overflow-auto p-2">
                      <div className="space-y-1">
                        {visibleOfferings.map((offering) => {
                          const value = draft.a_la_carte_selections[offering.id];
                          const checked = Boolean(value?.selected);
                          return (
                            <label
                              key={offering.id}
                              className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-muted/40"
                            >
                              <div className="flex items-start gap-2">
                                <Checkbox
                                  checked={checked}
                                  disabled={readOnly}
                                  onCheckedChange={(next) => {
                                    if (readOnly) return;
                                    const selected = Boolean(next);
                                    onChange({
                                      ...draft,
                                      a_la_carte_selections: {
                                        ...draft.a_la_carte_selections,
                                        [offering.id]: {
                                          selected,
                                          override: draft.a_la_carte_selections[offering.id]?.override ?? false,
                                          is_active: draft.a_la_carte_selections[offering.id]?.is_active ?? true,
                                          amount:
                                            draft.a_la_carte_selections[offering.id]?.amount ??
                                            (offering.default_rate != null ? String(offering.default_rate) : ''),
                                          frequency:
                                            draft.a_la_carte_selections[offering.id]?.frequency ??
                                            (offering.default_freq != null ? String(offering.default_freq) : 'monthly'),
                                        },
                                      },
                                    });
                                  }}
                                />
                                <div>
                                  <Label as="p" size="sm">
                                    {offering.name}
                                  </Label>
                                  <Body as="p" size="xs" tone="muted">
                                    {offering.category}
                                  </Body>
                                </div>
                              </div>
                              <div className="text-muted-foreground text-xs">{formatOfferingDefault(offering)}</div>
                            </label>
                          );
                        })}
                        {!visibleOfferings.length ? (
                          <Body as="p" size="sm" tone="muted" className="px-2 py-3">
                            No services found.
                          </Body>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border">
                    <div className="border-b px-3 py-2">
                      <Label as="p" size="sm">
                        Selected
                      </Label>
                      <Body as="p" size="xs" tone="muted">
                        Override pricing per service when needed.
                      </Body>
                    </div>
                    <div className="max-h-[360px] overflow-auto p-3">
                      {Object.entries(draft.a_la_carte_selections)
                        .filter(([, v]) => v.selected)
                        .map(([offeringId, row]) => {
                          const offering = offerings.find((o) => o.id === offeringId);
                          if (!offering) return null;
                          const override = Boolean(row.override);
                          return (
                            <div key={offeringId} className="space-y-2 rounded-lg border p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <Label as="p" size="sm">
                                    {offering.name}
                                  </Label>
                                  <Body as="p" size="xs" tone="muted">
                                    Default: {formatOfferingDefault(offering)}
                                  </Body>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={override}
                                    disabled={readOnly}
                                    onCheckedChange={(checked) => {
                                      if (readOnly) return;
                                      const next = Boolean(checked);
                                      onChange({
                                        ...draft,
                                        a_la_carte_selections: {
                                          ...draft.a_la_carte_selections,
                                          [offeringId]: { ...draft.a_la_carte_selections[offeringId], override: next },
                                        },
                                      });
                                    }}
                                    id={`override-${offeringId}`}
                                  />
                                  <Label htmlFor={`override-${offeringId}`}>Override</Label>
                                </div>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                  <Label>Amount</Label>
                                  <Input
                                    inputMode="decimal"
                                    value={row.amount}
                                    onChange={(e) =>
                                      onChange({
                                        ...draft,
                                        a_la_carte_selections: {
                                          ...draft.a_la_carte_selections,
                                          [offeringId]: { ...draft.a_la_carte_selections[offeringId], amount: e.target.value },
                                        },
                                      })
                                    }
                                    disabled={readOnly || !override}
                                    placeholder={(offering.fee_type || '').toLowerCase().includes('percent') ? 'e.g. 10 (percent)' : 'e.g. 100.00'}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label>Frequency</Label>
                                  <Select
                                    value={row.frequency}
                                    onValueChange={(value) =>
                                      onChange({
                                        ...draft,
                                        a_la_carte_selections: {
                                          ...draft.a_la_carte_selections,
                                          [offeringId]: { ...draft.a_la_carte_selections[offeringId], frequency: value },
                                        },
                                      })
                                    }
                                    disabled={readOnly || !override}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {frequencyOptions.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                          {opt.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      {!Object.values(draft.a_la_carte_selections).some((v) => v.selected) ? (
                        <p className="text-muted-foreground text-sm">No services selected yet.</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsPlanDialogOpen(false)} disabled={saving}>
                    {readOnly ? 'Close' : 'Cancel'}
                  </Button>
                  {!readOnly ? (
                    <Button type="button" onClick={handleSavePlan} disabled={saving || !selectedPlanId}>
                      {saving ? 'Saving…' : draft.plan_id ? 'Save Changes' : 'Assign Plan'}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Amount Type</Label>
                      <Select value={String(planDetails?.amount_type || DEFAULT_PLAN_AMOUNT_TYPE)} disabled>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="flat">Flat</SelectItem>
                          <SelectItem value="percent">Percent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Billing Frequency</Label>
                      <Select
                        value={planFeeFrequency}
                        onValueChange={setPlanFeeFrequency}
                        disabled={readOnly || !overrideGlobalValues}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Monthly">Monthly</SelectItem>
                          <SelectItem value="Annually">Annually</SelectItem>
                          <SelectItem value="Quarterly">Quarterly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {String(planDetails?.amount_type || DEFAULT_PLAN_AMOUNT_TYPE) === 'flat' ? (
                    <div className="space-y-2">
                      <Label>Flat Amount</Label>
                      <Input
                        inputMode="decimal"
                        value={planFeeAmount}
                        onChange={(e) => setPlanFeeAmount(e.target.value)}
                        placeholder="e.g. 100.00"
                        disabled={readOnly || !overrideGlobalValues}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Percent Basis</Label>
                      <Select value={String(planDetails?.percent_basis || DEFAULT_PLAN_PERCENT_BASIS)} disabled>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lease_rent_amount">Lease rent amount</SelectItem>
                          <SelectItem value="collected_rent">Collected rent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {String(planDetails?.amount_type || DEFAULT_PLAN_AMOUNT_TYPE) === 'percent' ? (
                    <div className="space-y-2">
                      <Label>Percent</Label>
                      <Input
                        inputMode="decimal"
                        value={planFeePercent}
                        onChange={(e) => setPlanFeePercent(e.target.value)}
                        placeholder="e.g. 8.5"
                        disabled={readOnly || !overrideGlobalValues}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <div>
                    <Label as="p" size="sm">
                      Included Services
                    </Label>
                    <Body as="p" size="xs" tone="muted">
                      Services are configured on the Service Catalog plan. Toggle statuses when overriding to activate or deactivate individual services.
                    </Body>
                  </div>

                  <div className="rounded-lg border p-3">
                    {planOfferingIds.length ? (
                      <ul className="grid gap-1 sm:grid-cols-2">
                        {planOfferingIds.map((offeringId) => {
                          const offering = offerings.find((o) => o.id === offeringId);
                          if (!offering) return null;
                          const isActive = resolveIncludedServiceActive(offeringId);
                          return (
                            <li key={offeringId} className="rounded border px-3 py-2">
                              <div className="flex items-center justify-between gap-3">
                                <Label as="span" size="sm">
                                  {offering.name}
                                </Label>
                                <div className="flex items-center gap-2">
                                  <Body as="span" size="xs" tone="muted">
                                    {isActive ? 'Active' : 'Inactive'}
                                  </Body>
                                  {overrideGlobalValues && !readOnly ? (
                                    <Switch
                                      checked={isActive}
                                      onCheckedChange={(checked) =>
                                        toggleIncludedServiceActive(offeringId, checked)
                                      }
                                      disabled={saving}
                                      aria-label={`Set ${offering.name} ${isActive ? 'inactive' : 'active'}`}
                                    />
                                  ) : null}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground text-sm">No services are assigned to this plan.</p>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsPlanDialogOpen(false)}
                      disabled={saving}
                    >
                      {readOnly ? 'Close' : 'Cancel'}
                    </Button>
                    {!readOnly ? (
                      <Button
                        type="button"
                        onClick={handleSavePlan}
                        disabled={saving || !selectedPlanId || !planDetails}
                      >
                        {saving ? 'Saving…' : draft.plan_id ? 'Save Changes' : 'Assign Plan'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
