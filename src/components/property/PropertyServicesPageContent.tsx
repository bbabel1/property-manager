'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

type AssignmentSummary = {
  assignment_id?: string | null;
  id?: string | null;
  plan_id?: string | null;
  plan_name?: string | null;
  plan_fee_amount?: number | null;
  plan_fee_percent?: number | null;
  plan_fee_frequency?: string | null;
};

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

const DEFAULT_PLAN_AMOUNT_TYPE = 'flat';
const DEFAULT_PLAN_PERCENT_BASIS = 'lease_rent_amount';

export type AssignmentLevel = 'Property Level' | 'Unit Level';

function parseNumberValue(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numbersEqual(a: number | null | undefined, b: number | null | undefined) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 0.0001;
}

export function AssignmentServicesEditor({
  propertyId,
  unitId,
  readOnly = false,
  title,
}: {
  propertyId: string;
  unitId?: string | null;
  readOnly?: boolean;
  title?: string;
}) {
  const [plans, setPlans] = useState<Array<{ id: string; name: string }>>([]);
  const [plansById, setPlansById] = useState<Record<string, ServicePlanRow>>({});
  const [offerings, setOfferings] = useState<ServiceOffering[]>([]);
  const [assignment, setAssignment] = useState<AssignmentSummary | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [overrideGlobalValues, setOverrideGlobalValues] = useState(false);
  const [saving, setSaving] = useState(false);

  const [planDetails, setPlanDetails] = useState<ServicePlanDetails | null>(null);
  const [planOfferingIds, setPlanOfferingIds] = useState<string[]>([]);
  const [planFeeFrequency, setPlanFeeFrequency] = useState<string>('Monthly');
  const [planFeeAmount, setPlanFeeAmount] = useState<string>('');
  const [planFeePercent, setPlanFeePercent] = useState<string>('');
  const [aLaCarteQuery, setALaCarteQuery] = useState('');
  const [aLaCarteSelections, setALaCarteSelections] = useState<
    Record<
      string,
      {
        selected: boolean;
        override: boolean;
        is_active: boolean;
        amount: string;
        frequency: string;
      }
    >
  >({});
  const [includedServiceStatuses, setIncludedServiceStatuses] = useState<Record<string, boolean>>({});
  const [aLaCarteAssignedRows, setALaCarteAssignedRows] = useState<
    Array<{
      offering_id: string;
      is_active: boolean;
      override_amount: boolean;
      override_frequency: boolean;
      amount: number | null;
      frequency: string | null;
    }>
  >([]);
  const [savingServiceToggle, setSavingServiceToggle] = useState<string | null>(null);
  const [isServiceEditDialogOpen, setIsServiceEditDialogOpen] = useState(false);
  const [editingOfferingId, setEditingOfferingId] = useState<string | null>(null);
  const [serviceEditForm, setServiceEditForm] = useState<{
    is_active: boolean;
    override: boolean;
    amount: string;
    frequency: string;
  }>({ is_active: true, override: false, amount: '', frequency: 'monthly' });

  const selectedPlanName = useMemo(() => {
    if (!selectedPlanId) return '';
    return plans.find((p) => p.id === selectedPlanId)?.name || '';
  }, [plans, selectedPlanId]);

  const selectedPlanLooksLikeLegacyOverride = useMemo(
    () => /\(override\s+/i.test(selectedPlanName),
    [selectedPlanName],
  );

  const resetDialogState = useCallback(() => {
    setOverrideGlobalValues(false);
    setPlanDetails(null);
    setPlanOfferingIds([]);
    setPlanFeeFrequency('Monthly');
    setPlanFeeAmount('');
    setPlanFeePercent('');
    setALaCarteQuery('');
    setALaCarteSelections({});
    setIncludedServiceStatuses({});
  }, []);

  const hydratePlanForDisplay = useCallback((plan: ServicePlanRow) => {
    setPlanDetails(plan);
    setPlanOfferingIds(Array.isArray(plan.offering_ids) ? plan.offering_ids : []);
  }, []);

  const hydratePlanForDialog = useCallback(
    (plan: ServicePlanRow, planId: string, currentAssignment: AssignmentSummary | null) => {
      hydratePlanForDisplay(plan);

      const amountType = String(plan.amount_type || DEFAULT_PLAN_AMOUNT_TYPE);
      const defaultAmount = plan.default_fee_amount != null ? plan.default_fee_amount : null;
      const defaultPercent = plan.default_fee_percent != null ? plan.default_fee_percent : null;

      const isEditingCurrentAssignment = currentAssignment?.plan_id === planId;
      const assignmentAmount =
        currentAssignment?.plan_fee_amount != null ? Number(currentAssignment.plan_fee_amount) : null;
      const assignmentPercent =
        currentAssignment?.plan_fee_percent != null ? Number(currentAssignment.plan_fee_percent) : null;

      const isOverridden =
        isEditingCurrentAssignment &&
        (amountType === 'flat'
          ? !numbersEqual(assignmentAmount, defaultAmount)
          : !numbersEqual(assignmentPercent, defaultPercent));

      setOverrideGlobalValues(isOverridden);
      setPlanFeeFrequency(
        isEditingCurrentAssignment ? currentAssignment?.plan_fee_frequency || 'Monthly' : 'Monthly',
      );

      if (amountType === 'flat') {
        setPlanFeeAmount(
          isOverridden
            ? assignmentAmount != null
              ? String(assignmentAmount)
              : ''
            : defaultAmount != null
              ? String(defaultAmount)
              : '',
        );
        setPlanFeePercent('');
      } else {
        setPlanFeePercent(
          isOverridden
            ? assignmentPercent != null
              ? String(assignmentPercent)
              : ''
            : defaultPercent != null
              ? String(defaultPercent)
              : '',
        );
        setPlanFeeAmount('');
      }
    },
    [hydratePlanForDisplay],
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const assignmentQuery = unitId
        ? `/api/services/assignments?unitId=${encodeURIComponent(unitId)}`
        : `/api/services/assignments?propertyId=${encodeURIComponent(propertyId)}`;

      const [plansRes, assignmentRes, offeringsRes] = await Promise.all([
        fetch('/api/services/plans'),
        fetch(assignmentQuery),
        fetch('/api/services/catalog'),
      ]);

      const plansJson = await plansRes.json().catch(() => ({}));
      const assignmentJson = await assignmentRes.json().catch(() => ({}));
      const offeringsJson = await offeringsRes.json().catch(() => ({}));

      if (!plansRes.ok) {
        throw new Error('Failed to load service plans');
      }
      if (!offeringsRes.ok) {
        throw new Error('Failed to load service catalog');
      }

      const allPlanRows: ServicePlanRow[] = Array.isArray(plansJson?.data)
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
      for (const row of allPlanRows) nextPlansById[row.id] = row;
      setPlansById(nextPlansById);

      const filteredPlans = allPlanRows
        .filter((p) => !/\(override\s+/i.test(p.name))
        .map((p) => ({ id: p.id, name: p.name }));

      const offeringRows: ServiceOffering[] = Array.isArray(offeringsJson?.data)
        ? offeringsJson.data.map((o: any) => ({
            id: String(o.id),
            name: String(o.name || ''),
            category: String(o.category || 'Other'),
            is_active: Boolean(o.is_active ?? true),
            default_rate: o.default_rate != null ? Number(o.default_rate) : null,
            default_freq: o.default_freq != null ? String(o.default_freq) : null,
            fee_type: o.fee_type != null ? String(o.fee_type) : null,
          }))
        : [];
      setOfferings(offeringRows);

      const assignmentRow = Array.isArray(assignmentJson?.data)
        ? (assignmentJson.data[0] as AssignmentSummary | undefined)
        : undefined;

      if (assignmentRow) {
        setAssignment(assignmentRow);
        const assignedPlanId = assignmentRow.plan_id || null;
        setSelectedPlanId(assignedPlanId);

        const nextSelectPlans = assignedPlanId && !filteredPlans.some((p) => p.id === assignedPlanId)
          ? [
              {
                id: assignedPlanId,
                name:
                  nextPlansById[assignedPlanId]?.name ||
                  assignmentRow.plan_name ||
                  'Assigned plan',
              },
              ...filteredPlans,
            ]
          : filteredPlans;
        setPlans(nextSelectPlans);

        if (assignedPlanId) {
          const plan = nextPlansById[assignedPlanId];
          if (plan) hydratePlanForDisplay(plan);
        }
      } else {
        setAssignment(null);
        setSelectedPlanId(null);
        setPlans(filteredPlans);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services');
    } finally {
      setLoading(false);
    }
  }, [propertyId, unitId, hydratePlanForDisplay]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const assignmentId = useMemo(
    () => assignment?.assignment_id || assignment?.id || null,
    [assignment],
  );

  const isALaCarte = useMemo(() => {
    const name = (planDetails?.name || selectedPlanName || '').trim();
    return name === 'A-la-carte';
  }, [planDetails?.name, selectedPlanName]);

  const assignmentPlanName = useMemo(
    () => assignment?.plan_name || selectedPlanName || '',
    [assignment?.plan_name, selectedPlanName],
  );

  const isALaCarteAssigned = useMemo(
    () => assignmentPlanName.trim() === 'A-la-carte',
    [assignmentPlanName],
  );

  const frequencyOptions = useMemo(
    () => [
      { value: 'monthly', label: 'Monthly' },
      { value: 'annually', label: 'Annually' },
      { value: 'quarterly', label: 'Quarterly' },
      { value: 'one_time', label: 'One-time' },
      { value: 'per_event', label: 'Per event' },
      { value: 'per_job', label: 'Per job' },
      // Backward-compat labels seen in some schemas
      { value: 'Monthly', label: 'Monthly' },
      { value: 'Annual', label: 'Annual' },
    ],
    [],
  );

  const formatOfferingDefault = useCallback((offering: ServiceOffering) => {
    const rate = offering.default_rate;
    const freq = offering.default_freq || 'monthly';
    const feeType = (offering.fee_type || 'Flat Rate').toLowerCase();
    const formattedRate =
      rate == null
        ? '—'
        : feeType.includes('percent')
          ? `${rate}%`
          : `$${Number(rate).toFixed(2)}`;
    return `${formattedRate} • ${String(freq).replace(/_/g, ' ')}`;
  }, []);

  const loadALaCarteAssignedServices = useCallback(async () => {
    if (!assignmentId) return;
    try {
      const res = await fetch(
        `/api/services/assignment-services?assignmentId=${encodeURIComponent(assignmentId)}`,
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error?.message || json?.error || 'Failed to load selected services');
      }
      const rows = Array.isArray(json?.data) ? json.data : [];
      setALaCarteAssignedRows(
        rows
          .map((row: any) => ({
            offering_id: String(row.offering_id),
            is_active: row.is_active === undefined ? true : Boolean(row.is_active),
            override_amount: Boolean(row.override_amount),
            override_frequency: Boolean(row.override_frequency),
            amount: row.amount != null ? Number(row.amount) : null,
            frequency: row.frequency != null ? String(row.frequency) : null,
          }))
          .filter((row: any) => row.offering_id),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load selected services';
      toast.error(message);
    }
  }, [assignmentId]);

  const loadALaCarteSelections = useCallback(async () => {
    if (!assignmentId) return;
    try {
      const res = await fetch(
        `/api/services/assignment-services?assignmentId=${encodeURIComponent(assignmentId)}`,
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error?.message || json?.error || 'Failed to load selected services');
      }
      const rows = Array.isArray(json?.data) ? json.data : [];

      setALaCarteSelections((prev) => {
        const next: typeof prev = {};
        for (const row of rows) {
          const offeringId = row?.offering_id ? String(row.offering_id) : null;
          if (!offeringId) continue;
          const offering = offerings.find((o) => o.id === offeringId);
          const override =
            Boolean(row?.override_amount) || Boolean(row?.override_frequency) || false;
          const defaultAmount =
            offering?.default_rate != null ? String(offering.default_rate) : '';
          const defaultFrequency = offering?.default_freq != null ? offering.default_freq : 'monthly';
          next[offeringId] = {
            selected: true,
            override,
            is_active: row?.is_active === undefined ? true : Boolean(row.is_active),
            amount: override && row?.amount != null ? String(row.amount) : defaultAmount,
            frequency: override && row?.frequency ? String(row.frequency) : String(defaultFrequency),
          };
        }
        // Preserve any unsaved local changes for offerings not returned from the API.
        for (const [key, value] of Object.entries(prev)) {
          if (!next[key]) next[key] = value;
        }
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load selected services';
      toast.error(message);
    }
  }, [assignmentId, offerings]);

  useEffect(() => {
    if (!isDialogOpen) return;
    if (!isALaCarte) return;
    if (!assignmentId) return;
    if (assignment?.plan_id !== selectedPlanId) return;
    loadALaCarteSelections();
  }, [isDialogOpen, isALaCarte, assignmentId, assignment?.plan_id, selectedPlanId, loadALaCarteSelections]);

  useEffect(() => {
    if (!selectedPlanId) {
      setPlanDetails(null);
      setPlanOfferingIds([]);
      return;
    }
    const plan = plansById[selectedPlanId];
    if (!plan) return;
    if (isDialogOpen) {
      hydratePlanForDialog(plan, selectedPlanId, assignment);
    } else {
      hydratePlanForDisplay(plan);
    }
  }, [assignment, hydratePlanForDialog, hydratePlanForDisplay, isDialogOpen, plansById, selectedPlanId]);

  useEffect(() => {
    if (!assignmentId) {
      setALaCarteAssignedRows([]);
      return;
    }
    loadALaCarteAssignedServices();
  }, [assignmentId, loadALaCarteAssignedServices]);

  const openAddPlanDialog = () => {
    if (readOnly) return;
    resetDialogState();
    setSelectedPlanId(null);
    setIsDialogOpen(true);
  };

  const openEditPlanDialog = () => {
    resetDialogState();
    const planId = assignment?.plan_id || null;
    setSelectedPlanId(planId);
    if (planId) {
      const plan = plansById[planId];
      if (plan) hydratePlanForDialog(plan, planId, assignment);
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (readOnly) return;
      setSaving(true);
      setError(null);

      if (!selectedPlanId) {
        throw new Error('Select a plan.');
      }

      if (!planDetails) {
        throw new Error('Plan details are not loaded yet.');
      }

      if (isALaCarte) {
        const assignmentPayload: {
          property_id: string;
          unit_id?: string | null;
          plan_id: string;
          plan_fee_amount: number | null;
          plan_fee_percent: number | null;
          plan_fee_frequency: string;
          assignment_id?: string | null;
        } = {
          property_id: propertyId,
          plan_id: selectedPlanId,
          // A-la-carte has no plan-level fee
          plan_fee_amount: null,
          plan_fee_percent: 0,
          plan_fee_frequency: 'Monthly',
        };
        if (unitId) assignmentPayload.unit_id = unitId;

        const existingAssignmentId = assignment?.assignment_id || assignment?.id || null;
        const method = existingAssignmentId ? 'PATCH' : 'POST';
        if (existingAssignmentId) assignmentPayload.assignment_id = existingAssignmentId;

        const res = await fetch('/api/services/assignments', {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(assignmentPayload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error?.message || json?.error || 'Failed to save service plan');
        }

        const savedAssignmentId = String(json?.data?.id || existingAssignmentId || '');
        if (!savedAssignmentId) {
          throw new Error('Assignment could not be determined.');
        }

        const selectedOfferingIds = Object.entries(aLaCarteSelections)
          .filter(([, v]) => v.selected)
          .map(([offeringId]) => offeringId);

	        const servicesPayload = selectedOfferingIds.map((offeringId) => {
	          const row = aLaCarteSelections[offeringId];
	          const offering = offerings.find((o) => o.id === offeringId);
	          const fallbackFreq = offering?.default_freq != null ? offering.default_freq : 'monthly';
	          const override = Boolean(row?.override);
	          return {
	            offering_id: offeringId,
	            is_active: row?.is_active ?? true,
	            override_amount: override,
	            override_frequency: override,
	            amount: override ? row.amount : null,
	            frequency: override ? row.frequency || fallbackFreq : null,
	          };
	        });

        const servicesRes = await fetch('/api/services/assignment-services', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignment_id: savedAssignmentId, services: servicesPayload }),
        });
        const servicesJson = await servicesRes.json().catch(() => ({}));
        if (!servicesRes.ok) {
          throw new Error(
            servicesJson?.error?.message ||
              servicesJson?.error ||
              'Failed to save selected services',
          );
        }

        toast.success('A-la-carte services saved');
        setIsDialogOpen(false);
        await loadData();
        return;
      }

      const amountType = String(planDetails.amount_type || DEFAULT_PLAN_AMOUNT_TYPE);
      const planDefaultAmount =
        planDetails.default_fee_amount != null ? Number(planDetails.default_fee_amount) : null;
      const planDefaultPercent =
        planDetails.default_fee_percent != null ? Number(planDetails.default_fee_percent) : null;

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

      const assignmentPayload: {
        property_id: string;
        unit_id?: string | null;
        plan_id: string;
        plan_fee_amount: number | null;
        plan_fee_percent: number | null;
        plan_fee_frequency: string;
        assignment_id?: string | null;
      } = {
        property_id: propertyId,
        plan_id: selectedPlanId,
        plan_fee_amount: nextPlanFeeAmount,
        plan_fee_percent: nextPlanFeePercent,
        plan_fee_frequency: planFeeFrequency || 'Monthly',
      };
      if (unitId) assignmentPayload.unit_id = unitId;

      const existingAssignmentId = assignment?.assignment_id || assignment?.id || null;
      const method = existingAssignmentId ? 'PATCH' : 'POST';
      if (existingAssignmentId) assignmentPayload.assignment_id = existingAssignmentId;

      const res = await fetch('/api/services/assignments', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignmentPayload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error?.message || json?.error || 'Failed to save service plan');
      }

      const savedAssignmentId = String(json?.data?.id || existingAssignmentId || '');
      if (!savedAssignmentId) {
        throw new Error('Assignment could not be determined.');
      }

      if (overrideGlobalValues && planOfferingIds.length) {
        const servicesPayload = planOfferingIds.map((offeringId) => {
          const row = aLaCarteAssignedRows.find((r) => r.offering_id === offeringId);
          const isActive = includedServiceStatuses[offeringId] ?? row?.is_active ?? true;
          return {
            offering_id: offeringId,
            is_active: isActive,
            override_amount: false,
            override_frequency: false,
            amount: null,
            frequency: null,
          };
        });

        const servicesRes = await fetch('/api/services/assignment-services', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignment_id: savedAssignmentId, services: servicesPayload }),
        });
        const servicesJson = await servicesRes.json().catch(() => ({}));
        if (!servicesRes.ok) {
          throw new Error(
            servicesJson?.error?.message || servicesJson?.error || 'Failed to save service statuses',
          );
        }
      }

      toast.success('Service plan saved');
      setIsDialogOpen(false);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save service plan';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const activeOfferings = useMemo(
    () => offerings.filter((offering) => offering.is_active),
    [offerings],
  );

  const offeringAssignmentsById = useMemo(() => {
    const map = new Map<string, (typeof aLaCarteAssignedRows)[number]>();
    for (const row of aLaCarteAssignedRows) map.set(row.offering_id, row);
    return map;
  }, [aLaCarteAssignedRows]);

  useEffect(() => {
    if (!planOfferingIds.length) {
      setIncludedServiceStatuses({});
      return;
    }
    setIncludedServiceStatuses((prev) => {
      const next: Record<string, boolean> = {};
      for (const id of planOfferingIds) {
        const prevValue = prev[id];
        const assignmentActive = offeringAssignmentsById.get(id)?.is_active;
        next[id] = prevValue ?? (assignmentActive === undefined ? true : Boolean(assignmentActive));
      }
      return next;
    });
  }, [offeringAssignmentsById, planOfferingIds]);

  const resolveServiceActive = useCallback(
    (offeringId: string, defaultWhenMissing: boolean = true) =>
      offeringAssignmentsById.get(offeringId)?.is_active ?? defaultWhenMissing,
    [offeringAssignmentsById],
  );

  const updateServiceAssignment = useCallback(
    async (
      offeringId: string,
      update: Partial<{
        is_active: boolean;
        override_amount: boolean;
        override_frequency: boolean;
        amount: string | number | null;
        frequency: string | null;
      }>,
    ) => {
      if (!assignmentId) throw new Error('Assignment is not available.');
      const res = await fetch('/api/services/assignment-services', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignmentId,
          offering_id: offeringId,
          ...update,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json?.error?.message || json?.error || 'Failed to update service assignment',
        );
      }
    },
    [assignmentId],
  );

  const handleToggleServiceActive = useCallback(
    async (offeringId: string, nextActive: boolean) => {
      try {
        if (readOnly) return;
        setSavingServiceToggle(offeringId);
        await updateServiceAssignment(offeringId, { is_active: nextActive });
        setALaCarteAssignedRows((prev) => {
          const next = prev.slice();
          const idx = next.findIndex((r) => r.offering_id === offeringId);
          if (idx >= 0) {
            next[idx] = { ...next[idx], is_active: nextActive };
            return next;
          }
          return [
            ...next,
            {
              offering_id: offeringId,
              is_active: nextActive,
              override_amount: false,
              override_frequency: false,
              amount: null,
              frequency: null,
            },
          ];
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update service status';
        toast.error(message);
      } finally {
        setSavingServiceToggle(null);
      }
    },
    [readOnly, updateServiceAssignment],
  );

  const openEditServiceDialog = useCallback(
    (offeringId: string) => {
      if (readOnly) return;
      const row = offeringAssignmentsById.get(offeringId);
      const offering = offerings.find((o) => o.id === offeringId);
      if (!offering) return;

      const override = Boolean(row?.override_amount || row?.override_frequency);
      setEditingOfferingId(offeringId);
      setServiceEditForm({
        is_active: row?.is_active ?? true,
        override,
        amount: override
          ? row?.amount != null
            ? String(row.amount)
            : ''
          : offering.default_rate != null
            ? String(offering.default_rate)
            : '',
        frequency: override
          ? row?.frequency || offering.default_freq || 'monthly'
          : offering.default_freq || 'monthly',
      });
      setIsServiceEditDialogOpen(true);
    },
    [readOnly, offeringAssignmentsById, offerings],
  );

  const saveServiceEdit = useCallback(async () => {
    if (!editingOfferingId) return;
    try {
      if (readOnly) return;
      setSaving(true);
      const offering = offerings.find((o) => o.id === editingOfferingId);
      if (!offering) throw new Error('Service offering not found.');

      const override = Boolean(serviceEditForm.override);
      await updateServiceAssignment(editingOfferingId, {
        is_active: Boolean(serviceEditForm.is_active),
        override_amount: override,
        override_frequency: override,
        amount: override ? serviceEditForm.amount : null,
        frequency: override ? serviceEditForm.frequency : null,
      });

      await loadALaCarteAssignedServices();
      toast.success('Service updated');
      setIsServiceEditDialogOpen(false);
      setEditingOfferingId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update service';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [
    readOnly,
    editingOfferingId,
    offerings,
    serviceEditForm.amount,
    serviceEditForm.frequency,
    serviceEditForm.is_active,
    serviceEditForm.override,
    updateServiceAssignment,
    loadALaCarteAssignedServices,
  ]);

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

  if (loading) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6 text-center">Loading…</CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-destructive">{error}</CardContent>
      </Card>
    );
  }

  const planSummary = assignmentPlanName || 'No plan assigned';

  const feeAmount = assignment?.plan_fee_amount ?? null;
  const feePercent = assignment?.plan_fee_percent ?? null;
  const feeFrequency = assignment?.plan_fee_frequency || 'Monthly';
  const planFeeSummary =
    planSummary === 'A-la-carte'
      ? 'No plan fee'
      : feeAmount != null
      ? `$${Number(feeAmount).toFixed(2)} ${feeFrequency}`
      : feePercent != null
        ? `${feePercent}% ${feeFrequency}`
        : 'No fee configured';

  const assignedOfferings = activeOfferings
    .filter((o) => planOfferingIds.includes(o.id))
    .sort(
      (a, b) =>
        (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name),
    );

  const cardTitle = title ?? (unitId ? 'Unit Services' : 'Property Services');
  const scopeNoun = unitId ? 'Unit' : 'Property';
  const scopeNounLower = unitId ? 'unit' : 'property';

  return (
    <>
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-xl">{cardTitle}</CardTitle>
          <CardDescription>Assign a service plan and view included services.</CardDescription>
          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Active Plan</p>
                <p className="text-lg font-semibold">{planSummary}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Plan Fee</p>
                <p className="text-lg font-semibold">{planFeeSummary}</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignment?.plan_id ? (
            <div className="rounded-lg border p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">Services</p>
                <p className="text-muted-foreground text-xs">
                  {isALaCarteAssigned ? 'Selected services' : 'Included services'}
                </p>
              </div>

              {isALaCarteAssigned ? (
                aLaCarteAssignedRows.length ? (
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {aLaCarteAssignedRows.map((row) => {
                      const offering = offerings.find((o) => o.id === row.offering_id);
                      if (!offering) return null;
                      const overridden = row.override_amount || row.override_frequency;
                      const isActive = row.is_active ?? true;
                      const displayAmount = overridden
                        ? row.amount != null
                          ? (offering.fee_type || '').toLowerCase().includes('percent')
                            ? `${row.amount}%`
                            : `$${Number(row.amount).toFixed(2)}`
                          : '—'
                        : formatOfferingDefault(offering).split(' • ')[0];
                      const displayFrequency = overridden
                        ? row.frequency || offering.default_freq || 'monthly'
                        : offering.default_freq || 'monthly';
                      return (
                        <li key={row.offering_id} className="rounded-md border px-3 py-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">{offering.name}</p>
                              <p className="text-muted-foreground text-xs">
                                {displayAmount} • {String(displayFrequency).replace(/_/g, ' ')}
                                {overridden ? ' (override)' : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-xs">
                                  {isActive ? 'Active' : 'Inactive'}
                                </span>
                                <Switch
                                  checked={isActive}
                                  onCheckedChange={(checked) =>
                                    handleToggleServiceActive(row.offering_id, checked)
                                  }
                                  disabled={readOnly || savingServiceToggle === row.offering_id}
                                  aria-label={`Set ${offering.name} ${isActive ? 'inactive' : 'active'}`}
                                />
                              </div>
                              {!readOnly ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditServiceDialog(row.offering_id)}
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
                  <p className="text-muted-foreground mt-3 text-sm">
                    No services selected yet.
                  </p>
                )
              ) : assignedOfferings.length ? (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {assignedOfferings.map((offering) => {
                    const isActive = resolveServiceActive(offering.id);
                    return (
                      <li key={offering.id} className="rounded-md border px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{offering.name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">
                              {isActive ? 'Active' : 'Inactive'}
                            </span>
                            <Switch
                              checked={isActive}
                              onCheckedChange={(checked) =>
                                handleToggleServiceActive(offering.id, checked)
                              }
                              disabled={readOnly || savingServiceToggle === offering.id}
                              aria-label={`Set ${offering.name} ${isActive ? 'inactive' : 'active'}`}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-muted-foreground mt-3 text-sm">
                  No services are assigned to this plan.
                </p>
              )}

            </div>
          ) : null}

          <div className="flex justify-end">
            {assignment?.plan_id ? (
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
                    <p className="text-sm font-medium">{offering.name}</p>
                    <p className="text-muted-foreground text-xs">Default: {defaultSummary}</p>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Active</p>
                      <p className="text-muted-foreground text-xs">
                        Controls whether this service applies to this {scopeNounLower}.
                      </p>
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
                        When enabled, set custom amount/frequency for this {scopeNounLower}.
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
                        {saving ? 'Saving…' : 'Save'}
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
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetDialogState();
        }}
      >
        <DialogContent className="w-[980px] max-w-[980px]">
          <DialogHeader>
            <DialogTitle>
              {assignment?.plan_id ? `Edit ${scopeNoun} Service Plan` : `Add ${scopeNoun} Service Plan`}
            </DialogTitle>
            <DialogDescription>
              Select a plan template to prefill defaults. Enable overrides to customize this {scopeNounLower}’s management fee values.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Service Plan</Label>
              <Select
                value={selectedPlanId ?? ''}
                onValueChange={(value) => setSelectedPlanId(value || null)}
              >
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
              {isALaCarte ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium">A-la-carte mode</p>
                  <p className="text-muted-foreground text-xs">
                    No plan-level fee. Select services below and optionally override each service’s
                    pricing.
                  </p>
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
                          planDetails.default_fee_amount != null
                            ? String(planDetails.default_fee_amount)
                            : '',
                        );
                        setPlanFeePercent('');
                        return;
                      }

                      setPlanFeePercent(
                        planDetails.default_fee_percent != null
                          ? String(planDetails.default_fee_percent)
                          : '',
                      );
                      setPlanFeeAmount('');
                    }}
                    disabled={readOnly}
                    id="override-global-values"
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="override-global-values">Override global values</Label>
                    <p className="text-muted-foreground text-xs">
                      When enabled, you can override the management fee values for this {scopeNounLower} without
                      creating a new global plan.
                    </p>
                  </div>
                </>
              )}
            </div>

            {selectedPlanLooksLikeLegacyOverride ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                This plan looks like a legacy property override plan. Property-level overrides should
                be done with the checkbox above instead of creating new global plans.
              </div>
            ) : null}

            {isALaCarte ? (
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
                      <p className="text-sm font-medium">Available</p>
                      <p className="text-muted-foreground text-xs">
                        Select services to include for this {scopeNounLower}.
                      </p>
                    </div>
                    <div className="max-h-[360px] overflow-auto p-2">
                      <div className="space-y-1">
                        {visibleOfferings.map((offering) => {
                          const value = aLaCarteSelections[offering.id];
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
                                    setALaCarteSelections((prev) => {
                                      const nextState = { ...prev };
                                      const defaultAmount =
                                        offering.default_rate != null
                                          ? String(offering.default_rate)
                                          : '';
                                      const defaultFrequency =
                                        offering.default_freq != null
                                          ? String(offering.default_freq)
                                          : 'monthly';
                                      nextState[offering.id] = {
                                        selected,
                                        override: prev[offering.id]?.override ?? false,
                                        is_active: prev[offering.id]?.is_active ?? true,
                                        amount: prev[offering.id]?.amount ?? defaultAmount,
                                        frequency: prev[offering.id]?.frequency ?? defaultFrequency,
                                      };
                                      if (!selected) {
                                        nextState[offering.id] = {
                                          ...nextState[offering.id],
                                          selected: false,
                                        };
                                      }
                                      return nextState;
                                    });
                                  }}
                                />
                                <div>
                                  <p className="text-sm font-medium">{offering.name}</p>
                                  <p className="text-muted-foreground text-xs">{offering.category}</p>
                                </div>
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {formatOfferingDefault(offering)}
                              </div>
                            </label>
                          );
                        })}
                        {!visibleOfferings.length ? (
                          <p className="text-muted-foreground px-2 py-3 text-sm">No services found.</p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border">
                    <div className="border-b px-3 py-2">
                      <p className="text-sm font-medium">Selected</p>
                      <p className="text-muted-foreground text-xs">
                        Override pricing per service when needed.
                      </p>
                    </div>
                    <div className="max-h-[360px] overflow-auto p-3">
                      {Object.entries(aLaCarteSelections)
                        .filter(([, v]) => v.selected)
                        .map(([offeringId, row]) => {
                          const offering = offerings.find((o) => o.id === offeringId);
                          if (!offering) return null;
                          const override = Boolean(row.override);
                          return (
                            <div key={offeringId} className="space-y-2 rounded-lg border p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium">{offering.name}</p>
                                  <p className="text-muted-foreground text-xs">
                                    Default: {formatOfferingDefault(offering)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={override}
                                  disabled={readOnly}
                                  onCheckedChange={(checked) => {
                                    if (readOnly) return;
                                    const next = Boolean(checked);
                                    setALaCarteSelections((prev) => ({
                                      ...prev,
                                      [offeringId]: { ...prev[offeringId], override: next },
                                    }));
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
                                      setALaCarteSelections((prev) => ({
                                        ...prev,
                                        [offeringId]: { ...prev[offeringId], amount: e.target.value },
                                      }))
                                    }
                                    disabled={readOnly || !override}
                                    placeholder={
                                      (offering.fee_type || '').toLowerCase().includes('percent')
                                        ? 'e.g. 10 (percent)'
                                        : 'e.g. 100.00'
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label>Frequency</Label>
                                  <Select
                                    value={row.frequency}
                                    onValueChange={(value) =>
                                      setALaCarteSelections((prev) => ({
                                        ...prev,
                                        [offeringId]: { ...prev[offeringId], frequency: value },
                                      }))
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
                      {!Object.values(aLaCarteSelections).some((v) => v.selected) ? (
                        <p className="text-muted-foreground text-sm">
                          No services selected yet.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={saving}
                  >
                    {readOnly ? 'Close' : 'Cancel'}
                  </Button>
                  {!readOnly ? (
                    <Button
                      type="button"
                      onClick={handleSave}
                      disabled={saving || !selectedPlanId || !planDetails}
                    >
                      {saving ? 'Saving…' : assignment?.plan_id ? 'Save Changes' : 'Assign Plan'}
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
                      <Select
                        value={String(planDetails?.amount_type || DEFAULT_PLAN_AMOUNT_TYPE)}
                        disabled
                      >
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
                      <Select
                        value={String(planDetails?.percent_basis || DEFAULT_PLAN_PERCENT_BASIS)}
                        disabled
                      >
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
                    <p className="text-sm font-medium">Included Services</p>
                    <p className="text-muted-foreground text-xs">
                      Services are configured on the Service Catalog plan. Toggle statuses when overriding to activate or deactivate individual services.
                    </p>
                  </div>

                  <div className="rounded-lg border p-3">
                    {assignedOfferings.length ? (
                      <ul className="grid gap-1 sm:grid-cols-2">
                        {assignedOfferings.map((offering) => {
                          const isActive =
                            includedServiceStatuses[offering.id] ?? resolveServiceActive(offering.id);
                          return (
                            <li key={offering.id} className="rounded border px-3 py-2">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-medium">{offering.name}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground text-xs">
                                    {isActive ? 'Active' : 'Inactive'}
                                  </span>
                                  {overrideGlobalValues && !readOnly ? (
                                    <Switch
                                      checked={isActive}
                                      onCheckedChange={(checked) =>
                                        setIncludedServiceStatuses((prev) => ({
                                          ...prev,
                                          [offering.id]: checked,
                                        }))
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
                      <p className="text-muted-foreground text-sm">
                        No services are assigned to this plan.
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      disabled={saving}
                    >
                      {readOnly ? 'Close' : 'Cancel'}
                    </Button>
                    {!readOnly ? (
                      <Button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !selectedPlanId || !planDetails}
                      >
                        {saving ? 'Saving…' : assignment?.plan_id ? 'Save Changes' : 'Assign Plan'}
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

export default function PropertyServicesPageContent({
  propertyId,
  initialServiceAssignment,
}: {
  propertyId: string;
  initialServiceAssignment?: AssignmentLevel | null;
}) {
  const [serviceAssignment, setServiceAssignment] = useState<AssignmentLevel | null>(
    initialServiceAssignment ?? null,
  );
  const [assignmentChangeDialogOpen, setAssignmentChangeDialogOpen] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<AssignmentLevel | null>(null);
  const [changingAssignment, setChangingAssignment] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const current = serviceAssignment ?? 'Property Level';

  const requestChange = (next: AssignmentLevel) => {
    if (next === current) return;
    setPendingAssignment(next);
    setAssignmentChangeDialogOpen(true);
  };

  const confirmChange = async () => {
    if (!pendingAssignment) return;
    try {
      setChangingAssignment(true);
      const res = await fetch('/api/services/assignment-level', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          service_assignment: pendingAssignment,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error?.message || json?.error || 'Failed to update assignment level');
      }
      setServiceAssignment(pendingAssignment);
      setRefreshKey((k) => k + 1);
      toast.success('Assignment level updated');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update assignment level';
      toast.error(message);
    } finally {
      setChangingAssignment(false);
      setAssignmentChangeDialogOpen(false);
      setPendingAssignment(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">Assignment Level</CardTitle>
                <CardDescription className="hidden text-xs sm:block">
                  Changing this clears existing plan assignments and selected services.
                </CardDescription>
              </div>
              <CardDescription className="text-xs sm:hidden">
                Changing this clears existing plan assignments and selected services.
              </CardDescription>
            </div>
            <Select value={current} onValueChange={(v) => requestChange(v as AssignmentLevel)}>
              <SelectTrigger className="w-full sm:w-[220px]" aria-label="Assignment level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Property Level">Property Level</SelectItem>
                <SelectItem value="Unit Level">Unit Level</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {current === 'Unit Level' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Property Services</CardTitle>
            <CardDescription>
              This property is set to Unit Level assignments. Configure services on each unit’s Services tab.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Assigning a plan at the property level is disabled while Unit Level is selected.
            </p>
          </CardContent>
        </Card>
      ) : (
        <AssignmentServicesEditor key={refreshKey} propertyId={propertyId} />
      )}

      <Dialog open={assignmentChangeDialogOpen} onOpenChange={setAssignmentChangeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change assignment level?</DialogTitle>
            <DialogDescription>
              Changing the assignment level clears existing configured plan assignments and selected services for this property (including any unit-level configurations).
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssignmentChangeDialogOpen(false)}
              disabled={changingAssignment}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmChange} disabled={changingAssignment}>
              {changingAssignment ? 'Updating…' : 'Confirm'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
